import { S4OutputSchema } from "../schemas/s4-normalize-tag.js";
import type { StageDefinition, S3Output, S4Output } from "../types.js";

const SYSTEM_PROMPT = `You are a research systems normalizer.

First, generate a Topic Slug from the Research Topic Title:
- UPPERCASE
- 2–4 words max
- Hyphen-separated
- No brand names unless the topic is explicitly about a company

Then normalize the atomic units below.

Rules:
- Do not add or remove facts.
- Do not merge or split units.
- Do not infer strategy.
- Preserve meaning exactly.

For each unit, output:
Unit ID: [TOPIC-SLUG]-[01–15]
Normalized Claim: one precise neutral sentence
Original Claim (verbatim)
Primary Domain: choose exactly one
Secondary Tag (optional): risk / opportunity / constraint / proof requirement / adoption driver
Polarity: Enabling / Limiting / Neutral
Confidence Level: Explicit / Inferred
Evidence Strength: High / Medium / Low (based on source quality)

End with a sentence confirming no meaning was altered.`;

export const stage4: StageDefinition<
  { atomicUnits: S3Output; topicTitle: string },
  S4Output
> = {
  id: 4,
  name: "Normalize & Tag",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S4OutputSchema,
  buildUserMessage: (input) => {
    const units = input.atomicUnits.units
      .map(
        (u) =>
          `${u.number}. Claim: ${u.claim}\n   Evidence: ${u.supportingEvidence}\n   Source Type: ${u.sourceType}\n   Confidence: ${u.confidenceLevel}\n   Domain: ${u.domain}`
      )
      .join("\n\n");

    return `Research Topic Title: ${input.topicTitle}\n\nAtomic Units:\n${units}`;
  },
};
