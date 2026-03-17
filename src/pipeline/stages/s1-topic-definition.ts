import { S1OutputSchema } from "../schemas/s1-topic-definition.js";
import type { StageDefinition, S1Output } from "../types.js";

const SYSTEM_PROMPT = `You are a research director.

Using only the brand overview and target market, define exactly 6 deep-research topics that would create the strongest possible information foundation for brand strategy and GTM.

Rules:
- Topics must be decision-critical (research will change what we do).
- Topics must be non-overlapping.
- Topics must be researchable with real sources.
- Topics must NOT be execution outputs (no brand voice, messaging, content, ads).
- Topics must cover both demand-side truth and supply-side constraints.

For each topic, output ONE paragraph in this format:
1) **[Topic Title — 4–8 words]**:
3–5 sentences explaining:
(a) what we are trying to learn,
(b) key unknowns or questions,
(c) what decisions this will inform later,
(d) 2–4 example source types.

End with:
"Overlap Check:" one sentence confirming how each topic differs from the others.`;

export const stage1: StageDefinition<{ brandOverview: string }, S1Output> = {
  id: 1,
  name: "Topic Definition",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S1OutputSchema,
  buildUserMessage: (input) => input.brandOverview,
};
