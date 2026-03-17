import { S7OutputSchema } from "../schemas/s7-insight-synthesis.js";
import type {
  StageDefinition,
  S4Output,
  S5Output,
  S6Output,
  S7Output,
} from "../types.js";

const SYSTEM_PROMPT = `You are a research synthesist.

Produce 5–7 non-obvious insights grounded in the evidence.

Rules:
- No strategy, positioning, or solutions.
- Each insight must cite at least 2 Unit IDs.
- Each insight must state its limits.

For each insight: Insight statement, Evidence basis (Unit IDs), Why non-obvious, Boundary conditions, Related tensions.

End by stating whether the topic is enabling, constraining, or conditionally enabling.`;

export const stage7: StageDefinition<
  { normalizedUnits: S4Output; clusters: S5Output; tensions: S6Output },
  S7Output
> = {
  id: 7,
  name: "Insight Synthesis",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S7OutputSchema,
  buildUserMessage: (input) => {
    const units = input.normalizedUnits.units
      .map(
        (u) =>
          `${u.unitId}: ${u.normalizedClaim} [${u.polarity}, ${u.evidenceStrength}]`
      )
      .join("\n");

    const clusters = input.clusters.clusters
      .map(
        (c) =>
          `${c.label}: ${c.linkingStatement} (Units: ${c.includedUnitIds.join(", ")})`
      )
      .join("\n");

    const tensions = input.tensions.structuralTensions
      .map((t) => `- ${t.tensionStatement} (Units: ${t.unitIds.join(", ")})`)
      .join("\n");

    const contradictions = input.tensions.directContradictions
      .map(
        (c) =>
          `- ${c.description} [${c.nature}] (Units: ${c.unitIds.join(", ")})`
      )
      .join("\n");

    const boundaries = input.tensions.boundaryConditions
      .map((b) => `- ${b.description}`)
      .join("\n");

    return `Normalized Units:\n${units}\n\nClusters:\n${clusters}\n\nStructural Tensions:\n${tensions}\n\nDirect Contradictions:\n${contradictions || "None"}\n\nBoundary Conditions:\n${boundaries}\n\nDominant Risk: ${input.tensions.dominantRisk}`;
  },
};
