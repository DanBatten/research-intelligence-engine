import { z } from "zod";

export const AtomicUnitSchema = z.object({
  number: z.number().int().min(1).max(15),
  claim: z.string().describe("Single factual claim that cannot be subdivided"),
  supportingEvidence: z.string().describe("Quote, stat, or observation"),
  sourceType: z.string(),
  confidenceLevel: z.enum(["Explicit", "Inferred"]),
  domain: z.string(),
});

export const S3OutputSchema = z.object({
  units: z.array(AtomicUnitSchema).length(15),
});

export type S3Output = z.infer<typeof S3OutputSchema>;
