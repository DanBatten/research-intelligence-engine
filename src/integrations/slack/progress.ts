import type { WebClient } from "@slack/web-api";
import type { ProgressEvent } from "../../pipeline/types.js";
import { logger } from "../../lib/logger.js";

const STAGE_NAMES: Record<number, string> = {
  1: "Topic Definition",
  2: "Deep Research",
  3: "Atomic Unit Extraction",
  4: "Normalize & Tag",
  5: "Cross-Unit Clustering",
  6: "Tension & Contradiction Mapping",
  7: "Insight Synthesis",
  8: "Decision Relevance Scoring",
  9: "Cross-Topic Synthesis",
};

export async function postProgress(
  client: WebClient,
  channel: string,
  threadTs: string,
  event: ProgressEvent
): Promise<void> {
  const stageName = STAGE_NAMES[event.stageId] ?? event.stageName;
  const topicLabel =
    event.topicIndex !== undefined
      ? ` [Topic ${event.topicIndex + 1}/6]`
      : "";

  let emoji: string;
  let statusText: string;

  switch (event.status) {
    case "started":
      // Don't post for started — too noisy
      return;
    case "completed":
      emoji = "\u2713";
      statusText = `Stage ${event.stageId}/9: ${stageName}${topicLabel} ${emoji}`;
      break;
    case "retrying":
      emoji = "\u26A0\uFE0F";
      statusText = `Stage ${event.stageId}/9: ${stageName}${topicLabel} — retrying (${event.error})`;
      break;
    case "failed":
      emoji = "\u2717";
      statusText = `Stage ${event.stageId}/9: ${stageName}${topicLabel} ${emoji} FAILED: ${event.error}`;
      break;
  }

  try {
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: statusText,
    });
  } catch (err) {
    logger.warn(
      { error: (err as Error).message },
      "Failed to post progress to Slack"
    );
  }
}
