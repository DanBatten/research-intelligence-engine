import { S9OutputSchema } from "../schemas/s9-cross-topic-synthesis.js";
import type { StageDefinition, TopicState, S9Output } from "../types.js";

const SYSTEM_PROMPT = `You are a strategic synthesist.

Integrate insights across all research topics into a coherent, evidence-grounded understanding of the strategic landscape.

Rules:
- Do not propose strategies or positioning.
- Weight insights by decision relevance.
- Make conflicts explicit.

Output:
1. Reinforcing Insight Constellations — Label, Included insights, Shared reality described.
2. Cross-Topic Tensions — Tension statement, Topics involved, Why it matters.
3. Non-Negotiable Constraints — Truths that would break the effort if ignored.
4. Open Strategic Questions — 5–7 unavoidable questions strategy must answer.

Final paragraph: Describe the dominant "shape of the problem."`;

export const stage9: StageDefinition<
  { allTopicResults: TopicState[]; brandOverview: string },
  S9Output
> = {
  id: 9,
  name: "Cross-Topic Synthesis",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S9OutputSchema,
  buildUserMessage: (input) => {
    const topicSummaries = input.allTopicResults
      .map((t) => {
        const topicTitle = t.topic.title;
        const disposition = t.insights?.topicDisposition ?? "unknown";

        const decisionCritical =
          t.scoring?.topDecisionCritical?.join("\n  - ") ?? "N/A";

        const insights =
          t.insights?.insights
            .map(
              (ins) =>
                `- ${ins.statement} (Evidence: ${ins.evidenceBasis.join(", ")})`
            )
            .join("\n") ?? "N/A";

        const tensions =
          t.tensions?.structuralTensions
            .map((ten) => `- ${ten.tensionStatement}`)
            .join("\n") ?? "N/A";

        const scoredInsights =
          t.scoring?.scoredInsights
            .map((si) => {
              const s = si.scores;
              const total =
                s.positioningImpact +
                s.trustAndProofImpact +
                s.economicImpact +
                s.gtmFeasibilityImpact +
                s.riskSeverity;
              return `- ${si.insightStatement} [Total: ${total}/25]`;
            })
            .join("\n") ?? "N/A";

        return `=== TOPIC: ${topicTitle} ===\nDisposition: ${disposition}\n\nTop Decision-Critical Insights:\n  - ${decisionCritical}\n\nAll Insights:\n${insights}\n\nKey Tensions:\n${tensions}\n\nScored Insights:\n${scoredInsights}\n\nCommon Mistake: ${t.scoring?.commonDownstreamMistake ?? "N/A"}`;
      })
      .join("\n\n---\n\n");

    return `Brand Overview:\n${input.brandOverview}\n\n${topicSummaries}`;
  },
};
