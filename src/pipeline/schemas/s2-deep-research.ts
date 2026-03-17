import { z } from "zod";

export const CoreFindingSchema = z.object({
  finding: z.string().describe("Specific, falsifiable finding"),
  evidenceType: z.string().describe("Type of evidence used"),
});

export const S2OutputSchema = z.object({
  coreFindings: z.array(CoreFindingSchema).min(8).max(12),
  tensionsAndContradictions: z
    .array(z.string())
    .describe("Where evidence disagrees"),
  unclearOrUnderResearched: z
    .array(z.string())
    .describe("Important unanswered questions"),
  earlyImplications: z
    .array(z.string())
    .describe("Non-prescriptive: what decisions this may influence"),
});

export type S2Output = z.infer<typeof S2OutputSchema>;
