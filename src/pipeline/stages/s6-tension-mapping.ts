import { S6OutputSchema } from "../schemas/s6-tension-mapping.js";
import type { StageDefinition, S4Output, S5Output, S6Output } from "../types.js";

const SYSTEM_PROMPT = `You are a critical research examiner.

Identify tensions and contradictions that emerge from the clustered atomic units.

Rules:
- Do not resolve tensions.
- Do not recommend actions.
- Every item must cite Unit IDs.

Output:
A. Direct Contradictions (if any) — Description, Unit IDs, Nature: Empirical / Contextual / Methodological
B. Structural Tensions & Tradeoffs (3–6) — Tension statement, Unit IDs, Type (e.g. accuracy vs usability)
C. Boundary Conditions — Where claims weaken or break.

Final check: State whether dominant risk is overconfidence, underconfidence, or misapplied generalization.`;

export const stage6: StageDefinition<
  { clusters: S5Output; normalizedUnits: S4Output },
  S6Output
> = {
  id: 6,
  name: "Tension & Contradiction Mapping",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S6OutputSchema,
  buildUserMessage: (input) => {
    const clusters = input.clusters.clusters
      .map(
        (c) =>
          `### ${c.label}\nLinks: ${c.linkingStatement}\nUnits: ${c.includedUnitIds.join(", ")}\nDomain: ${c.dominantDomain} | Polarity Mix: ${c.polarityMix} | Evidence Mix: ${c.evidenceStrengthMix}`
      )
      .join("\n\n");

    const units = input.normalizedUnits.units
      .map((u) => `${u.unitId}: ${u.normalizedClaim} [${u.polarity}, ${u.evidenceStrength}]`)
      .join("\n");

    return `Clusters:\n${clusters}\n\nAll Normalized Units:\n${units}`;
  },
};
