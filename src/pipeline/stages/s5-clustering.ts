import { S5OutputSchema } from "../schemas/s5-clustering.js";
import type { StageDefinition, S4Output, S5Output } from "../types.js";

const SYSTEM_PROMPT = `You are a research synthesist.

Group the normalized atomic units into 3–6 non-overlapping clusters that represent distinct underlying phenomena.

Rules:
- Each Unit ID appears exactly once.
- Do not rewrite claims.
- Clusters must be descriptive, not strategic.

For each cluster: Cluster Label (3–6 words), What links these units (1 sentence), Included Unit IDs, Dominant Domain, Polarity Mix, Evidence Strength Mix.

Confirm all 15 units are accounted for.`;

export const stage5: StageDefinition<{ normalizedUnits: S4Output }, S5Output> =
  {
    id: 5,
    name: "Cross-Unit Clustering",
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: S5OutputSchema,
    buildUserMessage: (input) => {
      const units = input.normalizedUnits.units
        .map(
          (u) =>
            `${u.unitId}: ${u.normalizedClaim}\n  Domain: ${u.primaryDomain} | Polarity: ${u.polarity} | Evidence: ${u.evidenceStrength}${u.secondaryTag ? ` | Tag: ${u.secondaryTag}` : ""}`
        )
        .join("\n\n");

      return `Topic Slug: ${input.normalizedUnits.topicSlug}\n\nNormalized Atomic Units:\n${units}`;
    },
  };
