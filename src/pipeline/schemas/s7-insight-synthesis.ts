import { z } from "zod";

export const InsightSchema = z.object({
  statement: z.string(),
  evidenceBasis: z
    .array(z.string())
    .min(2)
    .describe("Unit IDs, at least 2"),
  whyNonObvious: z.string(),
  boundaryConditions: z.string(),
  relatedTensions: z.string(),
});

export const S7OutputSchema = z.object({
  insights: z.array(InsightSchema).min(5).max(7),
  topicDisposition: z.enum([
    "enabling",
    "constraining",
    "conditionally enabling",
  ]),
});

export type S7Output = z.infer<typeof S7OutputSchema>;
