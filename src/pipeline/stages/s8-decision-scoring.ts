import { S8OutputSchema } from "../schemas/s8-decision-scoring.js";
import type { StageDefinition, S6Output, S7Output, S8Output } from "../types.js";

const SYSTEM_PROMPT = `You are a strategic relevance assessor.

Score each insight based on impact if misunderstood or ignored.

Score 1–5 on: Positioning Impact, Trust & Proof Impact, Economic Impact, GTM Feasibility Impact, Risk Severity.

Provide 2–3 sentence justification per insight.

Final outputs:
- Top 3 Decision-Critical Insights
- Insights to Monitor
- Insights Safe to Deprioritize

End by stating the most common downstream mistake teams make on this topic.`;

export const stage8: StageDefinition<
  { insights: S7Output; tensions: S6Output },
  S8Output
> = {
  id: 8,
  name: "Decision Relevance Scoring",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S8OutputSchema,
  buildUserMessage: (input) => {
    const insights = input.insights.insights
      .map(
        (ins, i) =>
          `${i + 1}. ${ins.statement}\n   Evidence: ${ins.evidenceBasis.join(", ")}\n   Non-obvious because: ${ins.whyNonObvious}\n   Boundaries: ${ins.boundaryConditions}\n   Related tensions: ${ins.relatedTensions}`
      )
      .join("\n\n");

    const tensions = input.tensions.structuralTensions
      .map((t) => `- ${t.tensionStatement}`)
      .join("\n");

    return `Topic Disposition: ${input.insights.topicDisposition}\n\nInsights:\n${insights}\n\nKey Tensions:\n${tensions}\n\nDominant Risk: ${input.tensions.dominantRisk}`;
  },
};
