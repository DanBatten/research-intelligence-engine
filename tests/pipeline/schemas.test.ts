import { describe, it, expect } from "vitest";
import { S1OutputSchema } from "../../src/pipeline/schemas/s1-topic-definition.js";
import { S2OutputSchema } from "../../src/pipeline/schemas/s2-deep-research.js";
import { S3OutputSchema } from "../../src/pipeline/schemas/s3-atomic-extraction.js";
import { S4OutputSchema } from "../../src/pipeline/schemas/s4-normalize-tag.js";
import { S5OutputSchema } from "../../src/pipeline/schemas/s5-clustering.js";
import { S6OutputSchema } from "../../src/pipeline/schemas/s6-tension-mapping.js";
import { S7OutputSchema } from "../../src/pipeline/schemas/s7-insight-synthesis.js";
import { S8OutputSchema } from "../../src/pipeline/schemas/s8-decision-scoring.js";
import { S9OutputSchema } from "../../src/pipeline/schemas/s9-cross-topic-synthesis.js";

describe("Stage schemas", () => {
  it("S1 requires exactly 6 topics", () => {
    const valid = S1OutputSchema.safeParse({
      topics: Array.from({ length: 6 }, (_, i) => ({
        title: `Topic ${i + 1}`,
        whatWeAreTryingToLearn: "Learning about X",
        keyUnknowns: "Unknown Y",
        decisionsInformed: "Decision Z",
        exampleSourceTypes: ["Academic papers", "Industry reports"],
      })),
      overlapCheck: "Each topic differs because...",
    });
    expect(valid.success).toBe(true);

    const invalid = S1OutputSchema.safeParse({
      topics: [
        {
          title: "Topic 1",
          whatWeAreTryingToLearn: "X",
          keyUnknowns: "Y",
          decisionsInformed: "Z",
          exampleSourceTypes: ["A", "B"],
        },
      ],
      overlapCheck: "Overlap check",
    });
    expect(invalid.success).toBe(false);
  });

  it("S3 requires exactly 15 atomic units", () => {
    const units = Array.from({ length: 15 }, (_, i) => ({
      number: i + 1,
      claim: `Claim ${i + 1}`,
      supportingEvidence: "Evidence",
      sourceType: "Academic",
      confidenceLevel: "Explicit" as const,
      domain: "Market",
    }));

    expect(S3OutputSchema.safeParse({ units }).success).toBe(true);
    expect(
      S3OutputSchema.safeParse({ units: units.slice(0, 10) }).success
    ).toBe(false);
  });

  it("S4 validates polarity enum", () => {
    const result = S4OutputSchema.safeParse({
      topicSlug: "MARKET-DEMAND",
      units: Array.from({ length: 15 }, (_, i) => ({
        unitId: `MARKET-DEMAND-${String(i + 1).padStart(2, "0")}`,
        normalizedClaim: "Claim",
        originalClaim: "Claim",
        primaryDomain: "Market",
        secondaryTag: null,
        polarity: "InvalidValue",
        confidenceLevel: "Explicit",
        evidenceStrength: "High",
      })),
      confirmationStatement: "Confirmed",
    });
    expect(result.success).toBe(false);
  });

  it("S6 validates dominant risk enum", () => {
    const valid = S6OutputSchema.safeParse({
      directContradictions: [],
      structuralTensions: [
        { tensionStatement: "T1", unitIds: ["A", "B"], type: "x vs y" },
        { tensionStatement: "T2", unitIds: ["C", "D"], type: "a vs b" },
        { tensionStatement: "T3", unitIds: ["E", "F"], type: "m vs n" },
      ],
      boundaryConditions: [{ description: "Boundary 1" }],
      dominantRisk: "overconfidence",
    });
    expect(valid.success).toBe(true);
  });

  it("S8 requires exactly 3 top decision-critical insights", () => {
    const result = S8OutputSchema.safeParse({
      scoredInsights: Array.from({ length: 5 }, () => ({
        insightStatement: "Insight",
        scores: {
          positioningImpact: 3,
          trustAndProofImpact: 4,
          economicImpact: 2,
          gtmFeasibilityImpact: 5,
          riskSeverity: 1,
        },
        justification: "Because...",
      })),
      topDecisionCritical: ["A", "B"],  // only 2 — should fail
      insightsToMonitor: [],
      insightsToDeprioritize: [],
      commonDownstreamMistake: "Mistake",
    });
    expect(result.success).toBe(false);
  });

  it("S9 requires 5-7 open strategic questions", () => {
    const valid = S9OutputSchema.safeParse({
      reinforcingConstellations: [],
      crossTopicTensions: [],
      nonNegotiableConstraints: ["Constraint 1"],
      openStrategicQuestions: ["Q1", "Q2", "Q3", "Q4", "Q5"],
      shapeOfTheProblem: "The problem is shaped like...",
    });
    expect(valid.success).toBe(true);

    const tooFew = S9OutputSchema.safeParse({
      reinforcingConstellations: [],
      crossTopicTensions: [],
      nonNegotiableConstraints: [],
      openStrategicQuestions: ["Q1", "Q2"],
      shapeOfTheProblem: "The problem is shaped like...",
    });
    expect(tooFew.success).toBe(false);
  });
});
