import * as path from "node:path";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { PipelineRunner } from "./pipeline/runner.js";
import { parseFile, combineDocuments } from "./parsers/index.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: tsx src/index.ts <brand overview text or file path> [additional files...]");
    console.log("");
    console.log("Examples:");
    console.log('  tsx src/index.ts "My brand overview text"');
    console.log("  tsx src/index.ts brand-brief.pdf extra-data.xlsx");
    console.log('  tsx src/index.ts "Research this brand" brand-brief.pdf');
    process.exit(1);
  }

  // Determine user message and files
  let userMessage = "";
  const filePaths: string[] = [];

  for (const arg of args) {
    // If arg looks like a file path (has extension or starts with / or ./), treat as file
    if (
      arg.includes(".") &&
      !arg.startsWith('"') &&
      (arg.includes("/") ||
        arg.endsWith(".pdf") ||
        arg.endsWith(".docx") ||
        arg.endsWith(".xlsx") ||
        arg.endsWith(".csv") ||
        arg.endsWith(".txt") ||
        arg.endsWith(".md"))
    ) {
      filePaths.push(path.resolve(arg));
    } else {
      userMessage += (userMessage ? " " : "") + arg;
    }
  }

  // Parse files
  const docs = [];
  for (const fp of filePaths) {
    try {
      const doc = await parseFile(fp);
      docs.push(doc);
      logger.info({ file: fp }, "Parsed document");
    } catch (err) {
      logger.warn({ file: fp, error: (err as Error).message }, "Failed to parse file, skipping");
    }
  }

  // Build brand overview
  const brandOverview = combineDocuments(userMessage, docs);

  if (!brandOverview.trim()) {
    console.error("Error: No brand overview content provided.");
    process.exit(1);
  }

  // Create session
  const sessionId = `cli-${Date.now()}`;
  const sessionDir = path.join(config.SESSIONS_DIR, sessionId);

  logger.info({ sessionDir }, "Starting pipeline");

  const runner = new PipelineRunner(
    { projectName: "CLI Research", brandOverview },
    {
      sessionDir,
      onProgress: (event) => {
        const topicLabel =
          event.topicIndex !== undefined
            ? ` [Topic ${event.topicIndex + 1}/6]`
            : "";
        const symbol =
          event.status === "completed"
            ? "\u2713"
            : event.status === "failed"
              ? "\u2717"
              : event.status === "retrying"
                ? "\u21BB"
                : "\u25B6";
        console.log(
          `${symbol} Stage ${event.stageId}/9: ${event.stageName}${topicLabel} — ${event.status}${event.error ? ` (${event.error})` : ""}`
        );
      },
    }
  );

  const result = await runner.run();

  console.log("\nPipeline complete!");
  console.log(`Results saved to: ${sessionDir}`);
  console.log(`Topics completed: ${result.topicResults?.length ?? 0}/6`);

  if (result.synthesis) {
    console.log("\n--- Shape of the Problem ---");
    console.log(result.synthesis.shapeOfTheProblem);
  }
}

main().catch((err) => {
  logger.fatal(err, "Pipeline failed");
  process.exit(1);
});
