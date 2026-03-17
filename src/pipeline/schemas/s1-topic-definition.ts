import { z } from "zod";

export const ResearchTopicSchema = z.object({
  title: z.string().describe("4-8 word topic title"),
  whatWeAreTryingToLearn: z.string().describe("What we are trying to learn"),
  keyUnknowns: z.string().describe("Key unknowns or questions"),
  decisionsInformed: z
    .string()
    .describe("What decisions this will inform later"),
  exampleSourceTypes: z.array(z.string()).min(2).max(4),
});

export const S1OutputSchema = z.object({
  topics: z.array(ResearchTopicSchema).length(6),
  overlapCheck: z
    .string()
    .describe("One sentence confirming how each topic differs"),
});

export type ResearchTopic = z.infer<typeof ResearchTopicSchema>;
export type S1Output = z.infer<typeof S1OutputSchema>;
