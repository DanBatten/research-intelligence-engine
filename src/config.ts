import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-"),
  NOTION_API_KEY: z.string().min(1),
  NOTION_PARENT_PAGE_ID: z.string().min(1),

  MODEL_STAGE_1: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_2: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_3: z.string().default("claude-sonnet-4-6"),
  MODEL_STAGE_4: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_STAGE_5: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_6: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_7: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_8: z.string().default("claude-opus-4-6"),
  MODEL_STAGE_9: z.string().default("claude-opus-4-6"),
  MODEL_INTENT_PARSE: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_IMAGE_PARSE: z.string().default("claude-haiku-4-5-20251001"),

  MAX_CONCURRENT_API_CALLS: z.coerce.number().default(3),
  MAX_RETRIES_PER_STAGE: z.coerce.number().default(2),
  RETRY_DELAY_MS: z.coerce.number().default(5000),
  GOOGLE_API_KEY: z.string().optional().default(""),
  GDRIVE_MAX_FILES: z.coerce.number().default(25),
  TAVILY_MAX_RESULTS: z.coerce.number().default(5),
  TAVILY_SEARCH_DEPTH: z.enum(["basic", "advanced"]).default("advanced"),
  SESSIONS_DIR: z.string().default("./sessions"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config = ConfigSchema.parse(process.env);
