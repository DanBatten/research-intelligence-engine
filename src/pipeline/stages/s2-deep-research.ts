import { z } from "zod";
import { S2OutputSchema } from "../schemas/s2-deep-research.js";
import type { StageDefinition, ResearchTopic, S2Output } from "../types.js";
import { callStructured } from "../../lib/llm.js";
import { tavilySearch } from "../../lib/tavily.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

const SYSTEM_PROMPT = `You are a senior research analyst.

Conduct deep, decision-relevant research on the topic below in the context of the provided brand overview.

Rules:
- Separate what is known from what is inferred.
- Include contradictions and dissenting views.
- Prefer primary or close-to-primary sources.
- Avoid trend language or generalizations.
- Do NOT optimize findings to fit the brand.

Output structure:
1. Core Findings — 8–12 specific, falsifiable findings.
2. Evidence & Sources — For each finding, note evidence type used.
3. Key Tensions & Contradictions — Where evidence disagrees or breaks down.
4. What Is Unclear or Under-Researched — Important unanswered questions.
5. Early Implications (Non-Prescriptive) — What types of decisions this research may later influence.

Tone: analytical, neutral, internal research.`;

const SearchQueriesSchema = z.object({
  queries: z.array(z.string()).min(3).max(5),
});

export const stage2: StageDefinition<
  { topic: ResearchTopic; brandOverview: string },
  S2Output
> = {
  id: 2,
  name: "Deep Research",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: S2OutputSchema,
  buildUserMessage: () => "",

  async execute(input) {
    // Step 1: Generate search queries with Haiku
    const queries = await callStructured({
      model: config.MODEL_INTENT_PARSE,
      system:
        "Generate 3-5 targeted web search queries for the research topic below.",
      userMessage: `Topic: ${input.topic.title}\n${input.topic.whatWeAreTryingToLearn}`,
      schema: SearchQueriesSchema,
      schemaName: "search_queries",
    });

    logger.info(
      { topic: input.topic.title, queryCount: queries.queries.length },
      "Generated search queries"
    );

    // Step 2: Run all Tavily searches in parallel, with fallback
    let searchContext = "";
    try {
      const searchResults = await Promise.all(
        queries.queries.map(async (q) => ({
          query: q,
          results: await tavilySearch(q),
        }))
      );

      searchContext = searchResults
        .map(
          (sr) =>
            `### Query: ${sr.query}\n${sr.results
              .map((r) => `- **${r.title}** (${r.url})\n  ${r.content}`)
              .join("\n")}`
        )
        .join("\n\n");
    } catch (err) {
      logger.warn(
        { error: (err as Error).message },
        "Tavily search failed, falling back to LLM-only research"
      );
      searchContext =
        "(Web search unavailable — conduct research based on your training data.)";
    }

    // Step 3: Structured synthesis with Opus
    return callStructured({
      model: config.MODEL_STAGE_2,
      system: SYSTEM_PROMPT,
      userMessage: `Brand Overview:\n${input.brandOverview}\n\nResearch Topic: ${input.topic.title}\n${input.topic.whatWeAreTryingToLearn}\n\nKey Unknowns: ${input.topic.keyUnknowns}\n\nWeb Research Results:\n${searchContext}`,
      schema: S2OutputSchema,
      schemaName: "deep_research",
      maxTokens: 16384,
    });
  },
};
