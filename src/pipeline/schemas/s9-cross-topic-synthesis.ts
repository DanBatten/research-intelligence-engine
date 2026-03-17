import { z } from "zod";

export const InsightConstellationSchema = z.object({
  label: z.string(),
  includedInsights: z
    .array(z.string())
    .describe("Insight statements from various topics"),
  sharedReality: z.string(),
});

export const CrossTopicTensionSchema = z.object({
  tensionStatement: z.string(),
  topicsInvolved: z.array(z.string()).describe("Topic titles"),
  whyItMatters: z.string(),
});

export const S9OutputSchema = z.object({
  reinforcingConstellations: z.array(InsightConstellationSchema),
  crossTopicTensions: z.array(CrossTopicTensionSchema),
  nonNegotiableConstraints: z
    .array(z.string())
    .describe("Truths that would break the effort if ignored"),
  openStrategicQuestions: z.array(z.string()).min(5).max(7),
  shapeOfTheProblem: z
    .string()
    .describe(
      "Final paragraph describing the dominant shape of the problem"
    ),
});

export type S9Output = z.infer<typeof S9OutputSchema>;
