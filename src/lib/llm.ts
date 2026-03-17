import Anthropic from "@anthropic-ai/sdk";
import { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { config } from "../config.js";
import { Semaphore } from "./semaphore.js";
import { logger } from "./logger.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
const apiSemaphore = new Semaphore(config.MAX_CONCURRENT_API_CALLS);

export async function callStructured<T extends ZodType>(opts: {
  model: string;
  system: string;
  userMessage: string;
  schema: T;
  schemaName: string;
  schemaDescription?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<z.infer<T>> {
  await apiSemaphore.acquire();
  try {
    const jsonSchema = zodToJsonSchema(opts.schema, { target: "openApi3" });
    // Remove $schema key if present — Anthropic API rejects it
    delete (jsonSchema as Record<string, unknown>)["$schema"];

    logger.debug({ model: opts.model, schemaName: opts.schemaName }, "Calling structured LLM");

    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: [{ role: "user", content: opts.userMessage }],
      tools: [
        {
          name: opts.schemaName,
          description: opts.schemaDescription ?? "Return structured output",
          input_schema: jsonSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: opts.schemaName },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(
        `Stage ${opts.schemaName}: model did not return tool_use block`
      );
    }
    return opts.schema.parse(toolUse.input);
  } finally {
    apiSemaphore.release();
  }
}

export async function callFreeform(opts: {
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  await apiSemaphore.acquire();
  try {
    logger.debug({ model: opts.model }, "Calling freeform LLM");

    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: [{ role: "user", content: opts.userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Model did not return a text block");
    }
    return textBlock.text;
  } finally {
    apiSemaphore.release();
  }
}
