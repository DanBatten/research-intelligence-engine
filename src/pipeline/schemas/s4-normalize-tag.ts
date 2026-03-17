import { z } from "zod";

export const NormalizedUnitSchema = z.object({
  unitId: z.string().describe("Format: [TOPIC-SLUG]-[01-15]"),
  normalizedClaim: z.string().describe("One precise neutral sentence"),
  originalClaim: z.string().describe("Verbatim from Stage 3"),
  primaryDomain: z.string().describe("Exactly one domain"),
  secondaryTag: z
    .enum([
      "risk",
      "opportunity",
      "constraint",
      "proof requirement",
      "adoption driver",
    ])
    .nullable()
    .describe("Optional secondary tag"),
  polarity: z.enum(["Enabling", "Limiting", "Neutral"]),
  confidenceLevel: z.enum(["Explicit", "Inferred"]),
  evidenceStrength: z.enum(["High", "Medium", "Low"]),
});

export const S4OutputSchema = z.object({
  topicSlug: z
    .string()
    .describe("UPPERCASE, 2-4 words, hyphen-separated"),
  units: z.array(NormalizedUnitSchema).length(15),
  confirmationStatement: z
    .string()
    .describe("Confirms no meaning was altered"),
});

export type S4Output = z.infer<typeof S4OutputSchema>;
