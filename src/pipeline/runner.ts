import * as fs from "node:fs/promises";
import * as path from "node:path";
import { callStructured } from "../lib/llm.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { stage1 } from "./stages/s1-topic-definition.js";
import { stage2 } from "./stages/s2-deep-research.js";
import { stage3 } from "./stages/s3-atomic-extraction.js";
import { stage4 } from "./stages/s4-normalize-tag.js";
import { stage5 } from "./stages/s5-clustering.js";
import { stage6 } from "./stages/s6-tension-mapping.js";
import { stage7 } from "./stages/s7-insight-synthesis.js";
import { stage8 } from "./stages/s8-decision-scoring.js";
import { stage9 } from "./stages/s9-cross-topic-synthesis.js";
import type { NotionExporter } from "../integrations/notion/exporter.js";
import type {
  PipelineState,
  TopicState,
  StageDefinition,
  ProgressCallback,
  PipelineRunnerOptions,
  ResearchTopic,
} from "./types.js";

const modelForStage: Record<number, string> = {
  1: config.MODEL_STAGE_1,
  2: config.MODEL_STAGE_2,
  3: config.MODEL_STAGE_3,
  4: config.MODEL_STAGE_4,
  5: config.MODEL_STAGE_5,
  6: config.MODEL_STAGE_6,
  7: config.MODEL_STAGE_7,
  8: config.MODEL_STAGE_8,
  9: config.MODEL_STAGE_9,
};

export class PipelineRunner {
  private state: PipelineState;
  private sessionDir: string;
  private onProgress: ProgressCallback;
  private maxRetries: number;
  private retryDelayMs: number;
  private notion: NotionExporter | undefined;

  constructor(state: PipelineState, opts: PipelineRunnerOptions) {
    this.state = state;
    this.sessionDir = opts.sessionDir;
    this.onProgress = opts.onProgress ?? (() => {});
    this.maxRetries = opts.maxRetries ?? config.MAX_RETRIES_PER_STAGE;
    this.retryDelayMs = opts.retryDelayMs ?? config.RETRY_DELAY_MS;
    this.notion = opts.notion;
  }

  static async resume(
    sessionDir: string,
    opts?: Partial<PipelineRunnerOptions>
  ): Promise<PipelineRunner> {
    const raw = await fs.readFile(
      path.join(sessionDir, "state.json"),
      "utf-8"
    );
    return new PipelineRunner(JSON.parse(raw), {
      sessionDir,
      ...opts,
    });
  }

  private async save(): Promise<void> {
    await fs.mkdir(this.sessionDir, { recursive: true });
    // Persist Notion page IDs so resume can continue exporting
    if (this.notion) {
      this.state.notionPageIds = this.notion.getPageIds();
    }
    await fs.writeFile(
      path.join(this.sessionDir, "state.json"),
      JSON.stringify(this.state, null, 2)
    );
  }

  private async saveStageOutput(
    stageId: number,
    output: unknown,
    topicIndex?: number
  ): Promise<void> {
    await fs.mkdir(this.sessionDir, { recursive: true });
    const name =
      topicIndex !== undefined
        ? `stage-${stageId}-topic-${topicIndex}.json`
        : `stage-${stageId}.json`;
    await fs.writeFile(
      path.join(this.sessionDir, name),
      JSON.stringify(output, null, 2)
    );
  }

  private async saveError(
    stageId: number,
    error: unknown,
    topicIndex?: number
  ): Promise<void> {
    const errDir = path.join(this.sessionDir, "errors");
    await fs.mkdir(errDir, { recursive: true });
    const name =
      topicIndex !== undefined
        ? `stage-${stageId}-topic-${topicIndex}.json`
        : `stage-${stageId}.json`;
    await fs.writeFile(
      path.join(errDir, name),
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }

  private async notionStatus(text: string, done?: boolean): Promise<void> {
    try {
      await this.notion?.updateStatus(text, done);
    } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion status update failed");
    }
  }

  private async executeStage<TIn, TOut>(
    stage: StageDefinition<TIn, TOut>,
    input: TIn,
    topicIndex?: number
  ): Promise<TOut> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.onProgress({
          stageId: stage.id,
          stageName: stage.name,
          topicIndex,
          status: "started",
        });

        let result: TOut;

        if (stage.execute) {
          result = await stage.execute(input, this.state);
        } else {
          result = await callStructured({
            model: modelForStage[stage.id] ?? config.MODEL_STAGE_1,
            system: stage.systemPrompt,
            userMessage: stage.buildUserMessage(input),
            schema: stage.outputSchema,
            schemaName: `stage_${stage.id}_output`,
          });
        }

        await this.saveStageOutput(stage.id, result, topicIndex);
        this.onProgress({
          stageId: stage.id,
          stageName: stage.name,
          topicIndex,
          status: "completed",
        });
        return result;
      } catch (err) {
        await this.saveError(stage.id, err, topicIndex);

        if (attempt < this.maxRetries) {
          logger.warn(
            {
              stage: stage.name,
              attempt: attempt + 1,
              error: (err as Error).message,
            },
            "Stage failed, retrying"
          );
          this.onProgress({
            stageId: stage.id,
            stageName: stage.name,
            topicIndex,
            status: "retrying",
            error: (err as Error).message,
          });
          await new Promise((r) =>
            setTimeout(r, this.retryDelayMs * (attempt + 1))
          );
        } else {
          logger.error(
            { stage: stage.name, error: (err as Error).message },
            "Stage failed after all retries"
          );
          this.onProgress({
            stageId: stage.id,
            stageName: stage.name,
            topicIndex,
            status: "failed",
            error: (err as Error).message,
          });
          throw err;
        }
      }
    }
    throw new Error("unreachable");
  }

  private async runTopicPipeline(
    topic: ResearchTopic,
    brandOverview: string,
    topicIndex: number
  ): Promise<TopicState> {
    const state: TopicState = { topic, topicIndex };

    // Create topic page in Notion upfront
    try {
      await this.notion?.createTopicPage(topicIndex, topic.title);
    } catch (err) {
      logger.warn({ error: (err as Error).message }, "Failed to create Notion topic page");
    }

    // Stage 2: Deep Research
    state.research = await this.executeStage(
      stage2,
      { topic, brandOverview },
      topicIndex
    );
    try { await this.notion?.exportTopicResearch(topicIndex, state.research); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for research");
    }

    // Stage 3: Atomic Extraction
    state.atomicUnits = await this.executeStage(
      stage3,
      { deepResearch: state.research },
      topicIndex
    );

    // Stage 4: Normalize & Tag
    state.normalized = await this.executeStage(
      stage4,
      { atomicUnits: state.atomicUnits, topicTitle: topic.title },
      topicIndex
    );
    try { await this.notion?.exportTopicAtomicUnits(topicIndex, state.normalized); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for atomic units");
    }

    // Stage 5: Clustering
    state.clusters = await this.executeStage(
      stage5,
      { normalizedUnits: state.normalized },
      topicIndex
    );
    try { await this.notion?.exportTopicClusters(topicIndex, state.clusters); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for clusters");
    }

    // Stage 6: Tension Mapping
    state.tensions = await this.executeStage(
      stage6,
      { clusters: state.clusters, normalizedUnits: state.normalized },
      topicIndex
    );
    try { await this.notion?.exportTopicTensions(topicIndex, state.tensions); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for tensions");
    }

    // Stage 7: Insight Synthesis
    state.insights = await this.executeStage(
      stage7,
      {
        normalizedUnits: state.normalized,
        clusters: state.clusters,
        tensions: state.tensions,
      },
      topicIndex
    );
    try { await this.notion?.exportTopicInsights(topicIndex, state.insights); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for insights");
    }

    // Stage 8: Decision Scoring
    state.scoring = await this.executeStage(
      stage8,
      { insights: state.insights, tensions: state.tensions },
      topicIndex
    );
    try { await this.notion?.exportTopicScoring(topicIndex, state.scoring); } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion export failed for scoring");
    }

    return state;
  }

  async run(): Promise<PipelineState> {
    // Initialize Notion project page
    try {
      await this.notion?.initProject(this.state.projectName, this.state.brandOverview, this.state.fileNames);
    } catch (err) {
      logger.warn({ error: (err as Error).message }, "Notion init failed, continuing without Notion");
      this.notion = undefined;
    }

    // Stage 0 (passthrough — brandOverview is the input)
    await this.saveStageOutput(0, this.state.brandOverview);

    // Stage 1: Topic Definition
    if (!this.state.topics) {
      logger.info("Running Stage 1: Topic Definition");
      await this.notionStatus("Pipeline running — Stage 1/9: Topic Definition");
      const s1 = await this.executeStage(stage1, {
        brandOverview: this.state.brandOverview,
      });
      this.state.topics = s1.topics;
      this.state.overlapCheck = s1.overlapCheck;
      await this.save();

      try { await this.notion?.exportTopics(this.state.topics); } catch (err) {
        logger.warn({ error: (err as Error).message }, "Notion export failed for topics");
      }
    }

    // Stages 2-8 per topic (parallel)
    if (!this.state.topicResults) {
      this.state.topicResults = [];
    }

    const completedTopics = new Set(
      this.state.topicResults.map((t) => t.topicIndex)
    );
    const pendingTopics = this.state.topics
      .map((topic, i) => ({ topic, index: i }))
      .filter(({ index }) => !completedTopics.has(index));

    if (pendingTopics.length > 0) {
      logger.info(
        { pending: pendingTopics.length, completed: completedTopics.size },
        "Running per-topic pipelines"
      );

      await this.notionStatus(
        `Pipeline running — Stages 2-8: Researching ${pendingTopics.length} topics in parallel`
      );

      const newResults = await Promise.allSettled(
        pendingTopics.map(({ topic, index }) =>
          this.runTopicPipeline(topic, this.state.brandOverview, index)
        )
      );

      for (const result of newResults) {
        if (result.status === "fulfilled") {
          this.state.topicResults.push(result.value);
        } else {
          logger.error(
            { error: result.reason?.message },
            "Topic pipeline failed"
          );
        }
      }
      await this.save();
    }

    // Stage 9 (requires minimum 3 successful topics)
    const successfulTopics = this.state.topicResults;
    if (successfulTopics.length < 3) {
      await this.notionStatus(
        `Pipeline failed — only ${successfulTopics.length}/6 topics succeeded (minimum 3 required)`
      );
      throw new Error(
        `Only ${successfulTopics.length}/6 topics succeeded. Minimum 3 required for cross-topic synthesis.`
      );
    }

    if (!this.state.synthesis) {
      logger.info(
        { topicCount: successfulTopics.length },
        "Running Stage 9: Cross-Topic Synthesis"
      );
      await this.notionStatus(
        `Pipeline running — Stage 9/9: Cross-Topic Synthesis (${successfulTopics.length} topics)`
      );

      this.state.synthesis = await this.executeStage(stage9, {
        allTopicResults: successfulTopics,
        brandOverview: this.state.brandOverview,
      });

      try { await this.notion?.exportSynthesis(this.state.synthesis); } catch (err) {
        logger.warn({ error: (err as Error).message }, "Notion export failed for synthesis");
      }

      await this.save();
    }

    await this.notionStatus(
      `Pipeline complete — ${successfulTopics.length}/6 topics, ${this.state.synthesis.openStrategicQuestions.length} strategic questions`,
      true
    );

    return this.state;
  }
}
