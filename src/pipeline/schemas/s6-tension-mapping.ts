import { z } from "zod";

export const DirectContradictionSchema = z.object({
  description: z.string(),
  unitIds: z.array(z.string()).min(2),
  nature: z.enum(["Empirical", "Contextual", "Methodological"]),
});

export const StructuralTensionSchema = z.object({
  tensionStatement: z.string(),
  unitIds: z.array(z.string()).min(2),
  type: z.string().describe("e.g. 'accuracy vs usability'"),
});

export const BoundaryConditionSchema = z.object({
  description: z.string().describe("Where claims weaken or break"),
});

export const S6OutputSchema = z.object({
  directContradictions: z.array(DirectContradictionSchema),
  structuralTensions: z.array(StructuralTensionSchema).min(3).max(6),
  boundaryConditions: z.array(BoundaryConditionSchema),
  dominantRisk: z.enum([
    "overconfidence",
    "underconfidence",
    "misapplied generalization",
  ]),
});

export type S6Output = z.infer<typeof S6OutputSchema>;
