import { config } from "../config.js";
import { logger } from "./logger.js";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  logger.debug({ query }, "Tavily search");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: config.TAVILY_SEARCH_DEPTH,
      max_results: config.TAVILY_MAX_RESULTS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.warn(`Tavily API error: ${response.status} ${body}`);
    throw new Error(`Tavily search failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { results: TavilyResult[] };
  logger.debug({ resultCount: data.results.length }, "Tavily search complete");
  return data.results;
}
