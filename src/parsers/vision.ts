import * as fs from "node:fs/promises";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const EXT_TO_MEDIA: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function parseImageToText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = EXT_TO_MEDIA[ext];

  if (!mediaType) {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  logger.debug({ filePath }, "Parsing image with Claude Vision");

  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: config.MODEL_IMAGE_PARSE,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: "Describe the content of this image in detail. If it contains text, transcribe it. If it contains charts, graphs, or data visualizations, describe the data and any key takeaways. If it contains a logo or brand imagery, describe what you see.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Vision API did not return a text block");
  }

  return textBlock.text;
}
