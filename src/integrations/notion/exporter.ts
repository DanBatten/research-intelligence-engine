import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import type { PipelineState } from "../../pipeline/types.js";
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

  constructor() {
    this.client = new Client({ auth: config.NOTION_API_KEY });
    this.parentPageId = config.NOTION_PARENT_PAGE_ID;
  }

  private async createPage(
    parentId: string,
    title: string,
    emoji: string,
    blocks?: BlockObjectRequest[]
  ): Promise<string> {
    // Create the page with up to 100 blocks
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

    // Append remaining blocks in batches of 100
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

  async exportPipeline(state: PipelineState): Promise<string> {
    logger.info({ project: state.projectName }, "Exporting to Notion");

    // 1. Create project page
    const projectId = await this.createPage(
      this.parentPageId,
      state.projectName,
      "\uD83D\uDD0D"
    );

    // 2. Brand Overview page
    await this.createPage(
      projectId,
      "Brand Overview",
      "\uD83E\uDDE0",
      textToBlocks(state.brandOverview)
    );

    // 3. Research Topics page
    if (state.topics) {
      await this.createPage(
        projectId,
        "Research Topics",
        "\uD83C\uDFAF",
        topicsToBlocks(state.topics)
      );
    }

    // 4. Per-topic pages
    if (state.topicResults) {
      for (const topicResult of state.topicResults) {
        const topic = topicResult.topic;
        const topicPageId = await this.createPage(
          projectId,
          `${topicResult.topicIndex + 1}. ${topic.title}`,
          "\uD83D\uDCCA"
        );

        if (topicResult.research) {
          await this.createPage(
            topicPageId,
            "Deep Research",
            "\uD83D\uDD0E",
            researchToBlocks(topicResult.research)
          );
        }

        if (topicResult.normalized) {
          await this.createPage(
            topicPageId,
            "Atomic Units",
            "\u269B\uFE0F",
            atomicUnitsToBlocks(topicResult.normalized)
          );
        }

        if (topicResult.clusters) {
          await this.createPage(
            topicPageId,
            "Clusters",
            "\uD83D\uDD17",
            clustersToBlocks(topicResult.clusters)
          );
        }

        if (topicResult.tensions) {
          await this.createPage(
            topicPageId,
            "Tensions & Contradictions",
            "\u26A0\uFE0F",
            tensionsToBlocks(topicResult.tensions)
          );
        }

        if (topicResult.insights) {
          await this.createPage(
            topicPageId,
            "Insights",
            "\uD83D\uDCA1",
            insightsToBlocks(topicResult.insights)
          );
        }

        if (topicResult.scoring) {
          await this.createPage(
            topicPageId,
            "Decision Relevance",
            "\uD83D\uDCC8",
            scoringToBlocks(topicResult.scoring)
          );
        }
      }
    }

    // 5. Cross-Topic Synthesis page
    if (state.synthesis) {
      await this.createPage(
        projectId,
        "Cross-Topic Synthesis",
        "\uD83C\uDF10",
        synthesisToBlocks(state.synthesis)
      );
    }

    const notionUrl = `https://notion.so/${projectId.replace(/-/g, "")}`;
    logger.info({ notionUrl }, "Notion export complete");
    return notionUrl;
  }
}
