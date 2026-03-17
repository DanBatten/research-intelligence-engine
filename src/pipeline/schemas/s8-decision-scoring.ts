import { z } from "zod";

export const ScoresSchema = z.object({
  positioningImpact: z.number().int().min(1).max(5),
  trustAndProofImpact: z.number().int().min(1).max(5),
  economicImpact: z.number().int().min(1).max(5),
  gtmFeasibilityImpact: z.number().int().min(1).max(5),
  riskSeverity: z.number().int().min(1).max(5),
});

export const ScoredInsightSchema = z.object({
  insightStatement: z.string(),
  scores: ScoresSchema,
  justification: z.string().describe("2-3 sentence justification"),
});

export const S8OutputSchema = z.object({
  scoredInsights: z.array(ScoredInsightSchema).min(5).max(7),
  topDecisionCritical: z
    .array(z.string())
    .min(3)
    .max(3)
    .describe("Top 3 insight statements"),
  insightsToMonitor: z.array(z.string()),
  insightsToDeprioritize: z.array(z.string()),
  commonDownstreamMistake: z.string(),
});

export type S8Output = z.infer<typeof S8OutputSchema>;
