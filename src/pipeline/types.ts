import type { ZodType } from "zod";
import type { ResearchTopic, S1Output } from "./schemas/s1-topic-definition.js";
import type { S2Output } from "./schemas/s2-deep-research.js";
import type { S3Output } from "./schemas/s3-atomic-extraction.js";
import type { S4Output } from "./schemas/s4-normalize-tag.js";
import type { S5Output } from "./schemas/s5-clustering.js";
import type { S6Output } from "./schemas/s6-tension-mapping.js";
import type { S7Output } from "./schemas/s7-insight-synthesis.js";
import type { S8Output } from "./schemas/s8-decision-scoring.js";
import type { S9Output } from "./schemas/s9-cross-topic-synthesis.js";

export interface TopicState {
  topic: ResearchTopic;
  topicIndex: number;
  research?: S2Output;
  atomicUnits?: S3Output;
  normalized?: S4Output;
  clusters?: S5Output;
  tensions?: S6Output;
  insights?: S7Output;
  scoring?: S8Output;
}

export interface NotionPageIds {
  projectPageId?: string;
  statusBlockId?: string;
  topicPageIds: Record<number, string>;
}

export interface PipelineState {
  projectName: string;
  brandOverview: string;
  topics?: ResearchTopic[];
  overlapCheck?: string;
  topicResults?: TopicState[];
  synthesis?: S9Output;
  notionPageIds?: NotionPageIds;
}

export interface StageDefinition<TIn = unknown, TOut = unknown> {
  id: number;
  name: string;
  systemPrompt: string;
  outputSchema: ZodType<TOut>;
  buildUserMessage: (input: TIn) => string;
  execute?: (input: TIn, ctx: PipelineState) => Promise<TOut>;
}

export interface ProgressEvent {
  stageId: number;
  stageName: string;
  topicIndex?: number;
  status: "started" | "completed" | "retrying" | "failed";
  error?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export interface PipelineRunnerOptions {
  sessionDir: string;
  onProgress?: ProgressCallback;
  maxRetries?: number;
  retryDelayMs?: number;
  notion?: import("../integrations/notion/exporter.js").NotionExporter;
}

export type {
  ResearchTopic,
  S1Output,
  S2Output,
  S3Output,
  S4Output,
  S5Output,
  S6Output,
  S7Output,
  S8Output,
  S9Output,
};
