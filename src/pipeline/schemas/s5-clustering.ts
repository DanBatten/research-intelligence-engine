import { z } from "zod";

export const ClusterSchema = z.object({
  label: z.string().describe("3-6 word cluster label"),
  linkingStatement: z
    .string()
    .describe("What links these units - 1 sentence"),
  includedUnitIds: z.array(z.string()).min(1),
  dominantDomain: z.string(),
  polarityMix: z
    .string()
    .describe("e.g. '3 Enabling, 1 Limiting, 1 Neutral'"),
  evidenceStrengthMix: z
    .string()
    .describe("e.g. '2 High, 2 Medium, 1 Low'"),
});

export const S5OutputSchema = z.object({
  clusters: z.array(ClusterSchema).min(3).max(6),
  confirmationStatement: z
    .string()
    .describe("Confirms all 15 units are accounted for"),
});

export type S5Output = z.infer<typeof S5OutputSchema>;
