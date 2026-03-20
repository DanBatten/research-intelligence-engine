import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import type { PipelineState, TopicState, NotionPageIds } from "../../pipeline/types.js";
import {
  textToBlocks,
  topicsToBlocks,
  researchToBlocks,
  atomicUnitsToBlocks,
  clustersToBlocks,
  tensionsToBlocks,
  insightsToBlocks,
  scoringToBlocks,
  synthesisToBlocks,
} from "./blocks.js";

const BATCH_SIZE = 100;

export class NotionExporter {
  private client: Client;
  private parentPageId: string;
  private pageIds: NotionPageIds;

  constructor(existingPageIds?: NotionPageIds) {
    this.client = new Client({ auth: config.NOTION_API_KEY });
    this.parentPageId = config.NOTION_PARENT_PAGE_ID;
    this.pageIds = existingPageIds ?? { topicPageIds: {} };
  }

  getPageIds(): NotionPageIds {
    return this.pageIds;
  }

  getProjectUrl(): string | undefined {
    if (!this.pageIds.projectPageId) return undefined;
    return `https://notion.so/${this.pageIds.projectPageId.replace(/-/g, "")}`;
  }

  private async createPage(
    parentId: string,
    title: string,
    emoji: string,
    blocks?: BlockObjectRequest[]
  ): Promise<string> {
    const initialBlocks = blocks?.slice(0, BATCH_SIZE) ?? [];

    const page = await this.client.pages.create({
      parent: { page_id: parentId },
      icon: { type: "emoji", emoji: emoji as any },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
      },
      children: initialBlocks,
    });

    if (blocks && blocks.length > BATCH_SIZE) {
      const remaining = blocks.slice(BATCH_SIZE);
      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const batch = remaining.slice(i, i + BATCH_SIZE);
        await this.client.blocks.children.append({
          block_id: page.id,
          children: batch,
        });
      }
    }

    logger.debug({ title, pageId: page.id }, "Created Notion page");
    return page.id;
  }

  // --- Incremental export methods ---

  async initProject(projectName: string, brandOverview: string, fileNames?: string[]): Promise<void> {
    if (this.pageIds.projectPageId) return; // Already initialized (resume)

    // Create project page with status callout as first block
    const statusBlock: BlockObjectRequest = {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Pipeline running — Stage 1/9: Topic Definition" } }],
        icon: { type: "emoji", emoji: "\u23F3" as any },
      },
    };

    const page = await this.client.pages.create({
      parent: { page_id: this.parentPageId },
      icon: { type: "emoji", emoji: "\uD83D\uDD0D" as any },
      properties: {
        title: { title: [{ text: { content: projectName } }] },
      },
      children: [statusBlock],
    });

    this.pageIds.projectPageId = page.id;

    // Get the status block ID (first child)
    const children = await this.client.blocks.children.list({ block_id: page.id });
    this.pageIds.statusBlockId = children.results[0]!.id;

    // Create Brand Overview page with just the source file list (not raw content)
    const overviewLines = ["Source documents used for this research:\n"];
    if (fileNames && fileNames.length > 0) {
      for (const name of fileNames) {
        overviewLines.push(`- ${name}`);
      }
    } else {
      overviewLines.push("_No documents provided — research based on web sources only._");
    }
    await this.createPage(
      page.id,
      "Brand Overview",
      "\uD83E\uDDE0",
      textToBlocks(overviewLines.join("\n"))
    );

    logger.info({ projectPageId: page.id }, "Notion project initialized");
  }

  async updateStatus(text: string, done?: boolean): Promise<void> {
    if (!this.pageIds.statusBlockId) return;

    try {
      await this.client.blocks.update({
        block_id: this.pageIds.statusBlockId,
        callout: {
          rich_text: [{ type: "text", text: { content: text } }],
          icon: { type: "emoji", emoji: (done ? "\u2705" : "\u23F3") as any },
        },
      });
    } catch (err) {
      logger.warn({ error: (err as Error).message }, "Failed to update Notion status");
    }
  }

  async exportTopics(topics: Array<{ title: string; whatWeAreTryingToLearn: string; keyUnknowns: string; decisionsInformed: string; exampleSourceTypes: string[] }>): Promise<void> {
    if (!this.pageIds.projectPageId) return;

    await this.createPage(
      this.pageIds.projectPageId,
      "Research Topics",
      "\uD83C\uDFAF",
      topicsToBlocks(topics)
    );
  }

  async createTopicPage(topicIndex: number, topicTitle: string): Promise<void> {
    if (!this.pageIds.projectPageId) return;
    if (this.pageIds.topicPageIds[topicIndex]) return; // Already exists

    const topicPageId = await this.createPage(
      this.pageIds.projectPageId,
      `${topicIndex + 1}. ${topicTitle}`,
      "\uD83D\uDCCA"
    );
    this.pageIds.topicPageIds[topicIndex] = topicPageId;
  }

  async exportTopicResearch(topicIndex: number, research: TopicState["research"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !research) return;

    await this.createPage(topicPageId, "Deep Research", "\uD83D\uDD0E", researchToBlocks(research));
  }

  async exportTopicAtomicUnits(topicIndex: number, normalized: TopicState["normalized"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !normalized) return;

    await this.createPage(topicPageId, "Atomic Units", "\u269B\uFE0F", atomicUnitsToBlocks(normalized));
  }

  async exportTopicClusters(topicIndex: number, clusters: TopicState["clusters"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !clusters) return;

    await this.createPage(topicPageId, "Clusters", "\uD83D\uDD17", clustersToBlocks(clusters));
  }

  async exportTopicTensions(topicIndex: number, tensions: TopicState["tensions"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !tensions) return;

    await this.createPage(topicPageId, "Tensions & Contradictions", "\u26A0\uFE0F", tensionsToBlocks(tensions));
  }

  async exportTopicInsights(topicIndex: number, insights: TopicState["insights"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !insights) return;

    await this.createPage(topicPageId, "Insights", "\uD83D\uDCA1", insightsToBlocks(insights));
  }

  async exportTopicScoring(topicIndex: number, scoring: TopicState["scoring"]): Promise<void> {
    const topicPageId = this.pageIds.topicPageIds[topicIndex];
    if (!topicPageId || !scoring) return;

    await this.createPage(topicPageId, "Decision Relevance", "\uD83D\uDCC8", scoringToBlocks(scoring));
  }

  async exportSynthesis(synthesis: PipelineState["synthesis"]): Promise<void> {
    if (!this.pageIds.projectPageId || !synthesis) return;

    await this.createPage(
      this.pageIds.projectPageId,
      "Cross-Topic Synthesis",
      "\uD83C\uDF10",
      synthesisToBlocks(synthesis)
    );
  }

  async uploadSharedBrain(filename: string, content: Buffer): Promise<void> {
    if (!this.pageIds.projectPageId) return;

    const apiKey = config.NOTION_API_KEY;
    const baseUrl = "https://api.notion.com";

    // Step 1: Create file upload
    const createRes = await fetch(`${baseUrl}/v1/file_uploads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2024-11-15",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename }),
    });

    if (!createRes.ok) {
      throw new Error(`Notion file upload create failed: ${createRes.status} ${await createRes.text()}`);
    }

    const { id: uploadId, upload_url } = (await createRes.json()) as {
      id: string;
      upload_url: string;
    };

    // Step 2: Send file bytes
    const boundary = `----FormBoundary${Date.now()}`;
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/markdown\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(header),
      content,
      Buffer.from(footer),
    ]);

    const uploadRes = await fetch(upload_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2024-11-15",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!uploadRes.ok) {
      throw new Error(`Notion file upload send failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }

    // Step 3: Attach file block to project page (raw fetch — SDK pins old Notion-Version)
    const attachRes = await fetch(`${baseUrl}/v1/blocks/${this.pageIds.projectPageId}/children`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2024-11-15",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        children: [
          {
            object: "block",
            type: "file",
            file: {
              type: "file_upload",
              file_upload: { id: uploadId },
              caption: [
                {
                  type: "text",
                  text: { content: "Research Brain — upload to Claude Projects" },
                },
              ],
            },
          },
        ],
      }),
    });

    if (!attachRes.ok) {
      throw new Error(`Notion file attach failed: ${attachRes.status} ${await attachRes.text()}`);
    }

    logger.info({ filename, uploadId }, "Shared brain uploaded to Notion");
  }
}
