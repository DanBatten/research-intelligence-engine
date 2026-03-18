import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { callStructured } from "../../lib/llm.js";
import { parseFile, combineDocuments } from "../../parsers/index.js";
import { PipelineRunner } from "../../pipeline/runner.js";
import { NotionExporter } from "../notion/exporter.js";
import {
  extractDriveLinks,
  downloadDriveLinks,
  type DriveLink,
} from "../../lib/gdrive.js";
import { postProgress } from "./progress.js";

const IntentSchema = z.object({
  projectName: z.string(),
  projectDescription: z.string(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional(),
});

// Keyed by userId — allows concurrent pipelines across users,
// but prevents the same user from double-triggering.
const activeJobs = new Map<string, string>();

async function parseUserIntent(
  text: string,
  hasFiles: boolean
): Promise<z.infer<typeof IntentSchema>> {
  return callStructured({
    model: config.MODEL_INTENT_PARSE,
    system: `Parse this Slack message to extract a research project name and description.
If the message is unclear about what brand/project to research, set needsClarification to true.
If files are attached, the user likely wants to start research using those files as brand context.`,
    userMessage: `Message: "${text}"\nHas file attachments: ${hasFiles}`,
    schema: IntentSchema,
    schemaName: "parse_intent",
  });
}

async function downloadSlackFile(
  fileId: string,
  client: WebClient,
  destDir: string
): Promise<string> {
  const info = await client.files.info({ file: fileId });
  const file = info.file!;
  const url = file.url_private_download!;
  const filename = file.name!;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.SLACK_BOT_TOKEN}` },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const destPath = path.join(destDir, filename);
  await fs.writeFile(destPath, buffer);
  return destPath;
}

async function runPipelineAsync(
  client: WebClient,
  channel: string,
  threadTs: string,
  userId: string,
  userMessage: string,
  fileIds: string[],
  driveLinks: DriveLink[],
  projectName: string
) {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionDir = path.join(config.SESSIONS_DIR, sessionId);
  const uploadsDir = path.join(sessionDir, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    // Download files
    const filePaths: string[] = [];
    for (const fileId of fileIds) {
      try {
        const filePath = await downloadSlackFile(fileId, client, uploadsDir);
        filePaths.push(filePath);
        logger.info({ fileId, filePath }, "Downloaded file");
      } catch (err) {
        logger.warn(
          { fileId, error: (err as Error).message },
          "Failed to download file, skipping"
        );
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `Warning: Could not download a file (${(err as Error).message}). Continuing with remaining documents.`,
        });
      }
    }

    // Download Google Drive files
    logger.info(
      { driveLinksCount: driveLinks.length, hasApiKey: !!config.GOOGLE_API_KEY },
      "Drive download check"
    );
    if (driveLinks.length > 0) {
      if (!config.GOOGLE_API_KEY) {
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: "I detected a Google Drive link but no Google API key is configured. Please set `GOOGLE_API_KEY` to enable Drive downloads.",
        });
      } else {
        try {
          const driveResult = await downloadDriveLinks(driveLinks, uploadsDir);
          logger.info(
            { fileCount: driveResult.files.length, errorCount: driveResult.errors.length, truncated: driveResult.truncated },
            "Drive download complete"
          );

          for (const df of driveResult.files) {
            filePaths.push(df.filePath);
            logger.info(
              { name: df.originalName, filePath: df.filePath },
              "Downloaded Drive file"
            );
          }

          if (driveResult.truncated) {
            await client.chat.postMessage({
              channel,
              thread_ts: threadTs,
              text: `Warning: Google Drive folder contained more than ${config.GDRIVE_MAX_FILES} files. Only the first ${config.GDRIVE_MAX_FILES} were downloaded.`,
            });
          }

          for (const de of driveResult.errors) {
            await client.chat.postMessage({
              channel,
              thread_ts: threadTs,
              text: `Warning: Could not download Drive file "${de.fileName}" (${de.message}). Continuing with remaining documents.`,
            });
          }
        } catch (err) {
          logger.error(
            { error: (err as Error).message },
            "Drive download failed"
          );
          await client.chat.postMessage({
            channel,
            thread_ts: threadTs,
            text: `Warning: Google Drive download failed (${(err as Error).message}). Continuing with any other files.`,
          });
        }
      }
    }

    // Parse documents
    const docs = [];
    for (const fp of filePaths) {
      try {
        const doc = await parseFile(fp);
        docs.push(doc);
      } catch (err) {
        logger.warn(
          { file: fp, error: (err as Error).message },
          "Failed to parse file, skipping"
        );
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `Warning: Could not parse ${path.basename(fp)} (${(err as Error).message}). Continuing with remaining documents.`,
        });
      }
    }

    // Build brand overview
    const brandOverview = combineDocuments(userMessage, docs);

    // Create Notion exporter (incremental — publishes each stage as it completes)
    const notion = new NotionExporter();

    // Create pipeline runner with Notion wired in
    const runner = new PipelineRunner(
      { projectName, brandOverview },
      {
        sessionDir,
        notion,
        onProgress: (event) =>
          postProgress(client, channel, threadTs, event),
      }
    );

    // Run pipeline (Notion pages are created incrementally during the run)
    await runner.run();

    const notionUrl = notion.getProjectUrl();
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: notionUrl
        ? `Research complete for *${projectName}*!\n\nView results: ${notionUrl}`
        : `Research complete for *${projectName}*!\n\nSession data: \`${sessionDir}\``,
    });
  } catch (err) {
    logger.error(
      { error: (err as Error).message, sessionId },
      "Pipeline failed"
    );
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `Pipeline failed for *${projectName}*: ${(err as Error).message}\n\nSession data: \`${sessionDir}\``,
    });
  } finally {
    activeJobs.delete(userId);
  }
}

export function registerHandlers(app: App) {
  app.event("message", async ({ event, client }) => {
    // Ignore bot messages
    if ("bot_id" in event) return;
    // Only handle DMs (im) or messages with text
    if (!("text" in event) || !event.text) return;

    const userId =
      "user" in event ? (event.user as string) : "unknown";
    const channel = event.channel;
    const text = event.text;
    const threadTs = event.ts;

    // Check for active job per user
    if (activeJobs.has(userId)) {
      await client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `You already have a research pipeline running (*${activeJobs.get(userId)}*). Please wait for it to complete.`,
      });
      return;
    }

    // Get file IDs
    const fileIds: string[] = [];
    if ("files" in event && Array.isArray(event.files)) {
      for (const f of event.files) {
        if (f.id) fileIds.push(f.id);
      }
    }

    // Detect Google Drive links
    const driveLinks = extractDriveLinks(text);
    logger.info(
      { driveLinks, fileIds, hasApiKey: !!config.GOOGLE_API_KEY },
      "Parsed message attachments"
    );

    // Parse intent
    const hasFiles = fileIds.length > 0 || driveLinks.length > 0;
    const intent = await parseUserIntent(text, hasFiles);

    if (intent.needsClarification) {
      await client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text:
          intent.clarificationQuestion ??
          "Could you clarify what brand or project you'd like me to research?",
      });
      return;
    }

    // Mark as active for this user
    activeJobs.set(userId, intent.projectName);

    // Acknowledge
    const ackParts = [`Research queued for *${intent.projectName}*.`];
    if (driveLinks.length > 0 && config.GOOGLE_API_KEY) {
      const folderCount = driveLinks.filter((l) => l.type === "folder").length;
      const fileCount = driveLinks.filter((l) => l.type === "file").length;
      const linkDesc = [
        folderCount > 0 ? `${folderCount} Drive folder${folderCount > 1 ? "s" : ""}` : "",
        fileCount > 0 ? `${fileCount} Drive file${fileCount > 1 ? "s" : ""}` : "",
      ].filter(Boolean).join(" and ");
      ackParts.push(`Downloading ${linkDesc}...`);
    }
    if (fileIds.length > 0) {
      ackParts.push(`Processing ${fileIds.length} uploaded file${fileIds.length > 1 ? "s" : ""}...`);
    }
    ackParts.push("Starting 10-stage pipeline...\n\nI'll post progress updates here.");
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: ackParts.join(" "),
    });

    // Fire and forget — don't await
    runPipelineAsync(
      client,
      channel,
      threadTs,
      userId,
      text,
      fileIds,
      driveLinks,
      intent.projectName
    ).catch((err) => {
      logger.error(err, "Unhandled error in pipeline async");
    });
  });
}
