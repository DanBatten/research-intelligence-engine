import { S3OutputSchema } from "../schemas/s3-atomic-extraction.js";
import type { StageDefinition, S2Output, S3Output } from "../types.js";

const SYSTEM_PROMPT = `You are a research systems analyst.

Break the research below into exactly 15 atomic units of information.

Definition:
An atomic unit is a single factual claim that cannot be subdivided.
If it contains "and", "because", or implies a recommendation, it is not atomic.

Rules:
- No synthesis or interpretation.
- No combining multiple facts.
- Prefer specificity over strength.
- Include weak or contested facts if needed.

For each unit, output: Claim, Supporting Evidence (quote, stat, or observation), Source Type, Confidence Level (Explicit / Inferred), Domain.

List units numerically 1–15.`;

export const stage3: StageDefinition<{ deepResearch: S2Output }, S3Output> = {
  id: 3,
  name: "Atomic Unit Extraction",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S3OutputSchema,
  buildUserMessage: (input) => {
    const r = input.deepResearch;
    const findings = r.coreFindings
      .map((f, i) => `${i + 1}. ${f.finding} [Evidence: ${f.evidenceType}]`)
      .join("\n");
    const tensions = r.tensionsAndContradictions.join("\n- ");
    const unclear = r.unclearOrUnderResearched.join("\n- ");
    const implications = r.earlyImplications.join("\n- ");

    return `Core Findings:\n${findings}\n\nTensions & Contradictions:\n- ${tensions}\n\nUnclear / Under-Researched:\n- ${unclear}\n\nEarly Implications:\n- ${implications}`;
  },
};
