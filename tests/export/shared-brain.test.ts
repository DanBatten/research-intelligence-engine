import { describe, it, expect } from "vitest";
import { compileSharedBrain } from "../../src/export/shared-brain.js";
import type { PipelineState, TopicState } from "../../src/pipeline/types.js";
import type { S6Output } from "../../src/pipeline/schemas/s6-tension-mapping.js";
import type { S7Output } from "../../src/pipeline/schemas/s7-insight-synthesis.js";
import type { S8Output } from "../../src/pipeline/schemas/s8-decision-scoring.js";
import type { S9Output } from "../../src/pipeline/schemas/s9-cross-topic-synthesis.js";

function makeTopic(index: number, title = `Topic ${index + 1}`) {
  return {
    title,
    whatWeAreTryingToLearn: `Learning about ${title}`,
    keyUnknowns: "Unknown",
    decisionsInformed: "Decisions",
    exampleSourceTypes: ["Reports", "Papers"],
  };
}

function makeTensions(): S6Output {
  return {
    directContradictions: [],
    structuralTensions: [
      { tensionStatement: "Speed vs quality", unitIds: ["A", "B"], type: "speed vs quality" },
      { tensionStatement: "Cost vs coverage", unitIds: ["C", "D"], type: "cost vs coverage" },
      { tensionStatement: "Scale vs depth", unitIds: ["E", "F"], type: "scale vs depth" },
    ],
    boundaryConditions: [{ description: "Only applies in B2B contexts" }],
    dominantRisk: "overconfidence",
  };
}

function makeInsights(): S7Output {
  return {
    insights: [
      {
        statement: "Insight A is non-obvious",
        evidenceBasis: ["U1", "U2"],
        whyNonObvious: "Because most assume otherwise",
        boundaryConditions: "Only in enterprise",
        relatedTensions: "speed vs quality",
      },
      {
        statement: "Insight B challenges assumptions",
        evidenceBasis: ["U3", "U4"],
        whyNonObvious: "Counter to conventional wisdom",
        boundaryConditions: "Markets above $1B",
        relatedTensions: "cost vs coverage",
      },
    ],
    topicDisposition: "enabling",
  };
}

function makeScoring(): S8Output {
  return {
    scoredInsights: [
      {
        insightStatement: "Insight A",
        scores: { positioningImpact: 5, trustAndProofImpact: 4, economicImpact: 3, gtmFeasibilityImpact: 4, riskSeverity: 2 },
        justification: "High impact insight.",
      },
    ],
    topDecisionCritical: ["Critical insight 1", "Critical insight 2", "Critical insight 3"],
    insightsToMonitor: ["Monitor this"],
    insightsToDeprioritize: ["Deprioritize this"],
    commonDownstreamMistake: "Assuming the market is homogeneous",
  };
}

function makeSynthesis(): S9Output {
  return {
    reinforcingConstellations: [
      {
        label: "Trust Cluster",
        includedInsights: ["Insight A", "Insight B"],
        sharedReality: "Trust is the foundation",
      },
    ],
    crossTopicTensions: [
      {
        tensionStatement: "Growth vs trust",
        topicsInvolved: ["Topic 1", "Topic 2"],
        whyItMatters: "These pull in opposite directions",
      },
    ],
    nonNegotiableConstraints: ["Must maintain data privacy"],
    openStrategicQuestions: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    shapeOfTheProblem: "The problem is fundamentally about balancing growth with trust.",
  };
}

function makeTopicState(index: number, opts?: { partial?: boolean }): TopicState {
  const base: TopicState = {
    topic: makeTopic(index),
    topicIndex: index,
  };

  if (opts?.partial) return base;

  return {
    ...base,
    tensions: makeTensions(),
    insights: makeInsights(),
    scoring: makeScoring(),
  };
}

function makeFullState(): PipelineState {
  const topics = Array.from({ length: 6 }, (_, i) => makeTopic(i));
  return {
    projectName: "Acme Corp",
    brandOverview: "Acme Corp brand overview...",
    topics,
    topicResults: Array.from({ length: 6 }, (_, i) => makeTopicState(i)),
    synthesis: makeSynthesis(),
  };
}

describe("compileSharedBrain", () => {
  it("compiles with full PipelineState and has expected headers", () => {
    const state = makeFullState();
    const { content, filename } = compileSharedBrain(state);
    const md = content.toString("utf-8");

    expect(filename).toBe("Acme-Corp-research-brain.md");
    expect(md).toContain("# Acme Corp — Research Brain");
    expect(md).toContain("## Research Overview");
    expect(md).toContain("## Cross-Topic Synthesis");
    expect(md).toContain("### The Shape of the Problem");
    expect(md).toContain("### Non-Negotiable Constraints");
    expect(md).toContain("### Reinforcing Insight Constellations");
    expect(md).toContain("### Cross-Topic Tensions");
    expect(md).toContain("### Open Strategic Questions");
    expect(md).toContain("## Topic 1:");
    expect(md).toContain("### Decision-Critical Insights");
    expect(md).toContain("### Key Insights");
    expect(md).toContain("### Structural Tensions");
    expect(md).toContain("### Boundary Conditions");
    expect(md).toContain("### Watch Out");
  });

  it("synthesis appears before topic deep-dives", () => {
    const state = makeFullState();
    const md = compileSharedBrain(state).content.toString("utf-8");

    const synthPos = md.indexOf("## Cross-Topic Synthesis");
    const topicPos = md.indexOf("## Topic 1:");
    expect(synthPos).toBeGreaterThan(-1);
    expect(topicPos).toBeGreaterThan(-1);
    expect(synthPos).toBeLessThan(topicPos);
  });

  it("handles partially failed topics (missing scoring/insights)", () => {
    const state = makeFullState();
    state.topicResults = [
      makeTopicState(0),
      makeTopicState(1, { partial: true }), // no insights/tensions/scoring
      makeTopicState(2),
    ];

    const { content } = compileSharedBrain(state);
    const md = content.toString("utf-8");

    // Topic 2 should still appear but without insight/tension sections
    expect(md).toContain("## Topic 2: Topic 2");
    // Should not crash and should include other topics normally
    expect(md).toContain("## Topic 1:");
    expect(md).toContain("## Topic 3:");
  });

  it("sanitizes filename with spaces and special chars", () => {
    const state = makeFullState();
    state.projectName = "My Brand! (2024) / Test";
    const { filename } = compileSharedBrain(state);
    expect(filename).toBe("My-Brand-2024-Test-research-brain.md");
    expect(filename).not.toMatch(/[!/()\s]/);
  });

  it("sorts topics by topicIndex", () => {
    const state = makeFullState();
    // Reverse the order of topic results
    state.topicResults = [
      makeTopicState(5),
      makeTopicState(2),
      makeTopicState(0),
      makeTopicState(3),
      makeTopicState(1),
      makeTopicState(4),
    ];

    const md = compileSharedBrain(state).content.toString("utf-8");

    const pos0 = md.indexOf("## Topic 1:");
    const pos1 = md.indexOf("## Topic 2:");
    const pos2 = md.indexOf("## Topic 3:");
    const pos3 = md.indexOf("## Topic 4:");

    expect(pos0).toBeLessThan(pos1);
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });

  it("handles missing synthesis gracefully", () => {
    const state = makeFullState();
    state.synthesis = undefined;

    const { content } = compileSharedBrain(state);
    const md = content.toString("utf-8");

    expect(md).toContain("# Acme Corp — Research Brain");
    expect(md).not.toContain("### The Shape of the Problem");
  });

  it("handles missing topics gracefully", () => {
    const state: PipelineState = {
      projectName: "Empty Project",
      brandOverview: "Overview",
    };

    const { content, filename } = compileSharedBrain(state);
    const md = content.toString("utf-8");

    expect(filename).toBe("Empty-Project-research-brain.md");
    expect(md).toContain("# Empty Project — Research Brain");
  });

  it("includes topic disposition from S7", () => {
    const state = makeFullState();
    const md = compileSharedBrain(state).content.toString("utf-8");
    expect(md).toContain("**Disposition:** enabling");
  });

  it("limits decision-critical insights to 3", () => {
    const state = makeFullState();
    const scoring = makeScoring();
    scoring.topDecisionCritical = ["A", "B", "C", "D", "E"];
    state.topicResults![0]!.scoring = scoring;

    const md = compileSharedBrain(state).content.toString("utf-8");

    // Find the first topic's decision-critical section
    const dcSection = md.split("### Decision-Critical Insights")[1]!.split("###")[0]!;
    const bullets = dcSection.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(3);
  });
});
