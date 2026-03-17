import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";

type RichTextItemRequest = {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: "default";
  };
};

const MAX_RICH_TEXT_LENGTH = 2000;

function splitText(text: string): RichTextItemRequest[] {
  const items: RichTextItemRequest[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_RICH_TEXT_LENGTH) {
      items.push({ type: "text", text: { content: remaining } });
      break;
    }

    // Split at word boundary
    let splitAt = remaining.lastIndexOf(" ", MAX_RICH_TEXT_LENGTH);
    if (splitAt === -1) splitAt = MAX_RICH_TEXT_LENGTH;

    items.push({
      type: "text",
      text: { content: remaining.slice(0, splitAt) },
    });
    remaining = remaining.slice(splitAt).trimStart();
  }

  return items;
}

function richText(
  content: string,
  opts?: { bold?: boolean; italic?: boolean; code?: boolean }
): RichTextItemRequest[] {
  return splitText(content).map((item) => ({
    ...item,
    annotations: opts
      ? { bold: opts.bold, italic: opts.italic, code: opts.code }
      : undefined,
  }));
}

function heading1(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_1",
    heading_1: { rich_text: richText(text) },
  };
}

function heading2(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText(text) },
  };
}

function heading3(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: richText(text) },
  };
}

function paragraph(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(text) },
  };
}

function bulletedListItem(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: richText(text) },
  };
}

function numberedListItem(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: { rich_text: richText(text) },
  };
}

function divider(): BlockObjectRequest {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

function calloutBlock(
  text: string,
  emoji?: string
): BlockObjectRequest {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: richText(text),
      icon: emoji ? { type: "emoji", emoji: emoji as any } : undefined,
    },
  };
}

export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  const lines = markdown.split("\n");
  const blocks: BlockObjectRequest[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push(divider());
    } else if (trimmed.startsWith("### ")) {
      blocks.push(heading3(trimmed.slice(4)));
    } else if (trimmed.startsWith("## ")) {
      blocks.push(heading2(trimmed.slice(3)));
    } else if (trimmed.startsWith("# ")) {
      blocks.push(heading1(trimmed.slice(2)));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push(bulletedListItem(trimmed.slice(2)));
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push(numberedListItem(trimmed.replace(/^\d+\.\s/, "")));
    } else {
      blocks.push(paragraph(trimmed));
    }
  }

  return blocks;
}

export function textToBlocks(text: string): BlockObjectRequest[] {
  return markdownToBlocks(text);
}

export function topicsToBlocks(
  topics: Array<{
    title: string;
    whatWeAreTryingToLearn: string;
    keyUnknowns: string;
    decisionsInformed: string;
    exampleSourceTypes: string[];
  }>
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  for (const [i, topic] of topics.entries()) {
    blocks.push(heading2(`${i + 1}. ${topic.title}`));
    blocks.push(paragraph(`**What we're trying to learn:** ${topic.whatWeAreTryingToLearn}`));
    blocks.push(paragraph(`**Key unknowns:** ${topic.keyUnknowns}`));
    blocks.push(paragraph(`**Decisions informed:** ${topic.decisionsInformed}`));
    blocks.push(
      paragraph(
        `**Example sources:** ${topic.exampleSourceTypes.join(", ")}`
      )
    );
    blocks.push(divider());
  }

  return blocks;
}

export function researchToBlocks(
  research: {
    coreFindings: Array<{ finding: string; evidenceType: string }>;
    tensionsAndContradictions: string[];
    unclearOrUnderResearched: string[];
    earlyImplications: string[];
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2("Core Findings"));
  for (const [i, f] of research.coreFindings.entries()) {
    blocks.push(
      numberedListItem(`${f.finding} [Evidence: ${f.evidenceType}]`)
    );
  }

  blocks.push(divider());
  blocks.push(heading2("Tensions & Contradictions"));
  for (const t of research.tensionsAndContradictions) {
    blocks.push(bulletedListItem(t));
  }

  blocks.push(divider());
  blocks.push(heading2("Unclear / Under-Researched"));
  for (const u of research.unclearOrUnderResearched) {
    blocks.push(bulletedListItem(u));
  }

  blocks.push(divider());
  blocks.push(heading2("Early Implications"));
  for (const e of research.earlyImplications) {
    blocks.push(bulletedListItem(e));
  }

  return blocks;
}

export function atomicUnitsToBlocks(
  normalized: {
    topicSlug: string;
    units: Array<{
      unitId: string;
      normalizedClaim: string;
      primaryDomain: string;
      polarity: string;
      confidenceLevel: string;
      evidenceStrength: string;
      secondaryTag: string | null;
    }>;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2(`Atomic Units — ${normalized.topicSlug}`));

  for (const u of normalized.units) {
    const meta = [
      `Domain: ${u.primaryDomain}`,
      `Polarity: ${u.polarity}`,
      `Confidence: ${u.confidenceLevel}`,
      `Evidence: ${u.evidenceStrength}`,
      u.secondaryTag ? `Tag: ${u.secondaryTag}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    blocks.push(
      calloutBlock(`${u.unitId}: ${u.normalizedClaim}\n${meta}`, "\uD83D\uDD39")
    );
  }

  return blocks;
}

export function clustersToBlocks(
  clusters: {
    clusters: Array<{
      label: string;
      linkingStatement: string;
      includedUnitIds: string[];
      dominantDomain: string;
      polarityMix: string;
      evidenceStrengthMix: string;
    }>;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2("Clusters"));

  for (const c of clusters.clusters) {
    blocks.push(heading3(c.label));
    blocks.push(paragraph(c.linkingStatement));
    blocks.push(
      paragraph(
        `Units: ${c.includedUnitIds.join(", ")}\nDomain: ${c.dominantDomain} | Polarity: ${c.polarityMix} | Evidence: ${c.evidenceStrengthMix}`
      )
    );
    blocks.push(divider());
  }

  return blocks;
}

export function tensionsToBlocks(
  tensions: {
    directContradictions: Array<{
      description: string;
      unitIds: string[];
      nature: string;
    }>;
    structuralTensions: Array<{
      tensionStatement: string;
      unitIds: string[];
      type: string;
    }>;
    boundaryConditions: Array<{ description: string }>;
    dominantRisk: string;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  if (tensions.directContradictions.length > 0) {
    blocks.push(heading2("Direct Contradictions"));
    for (const c of tensions.directContradictions) {
      blocks.push(
        calloutBlock(
          `${c.description}\nUnits: ${c.unitIds.join(", ")} | Nature: ${c.nature}`,
          "\u26A0\uFE0F"
        )
      );
    }
    blocks.push(divider());
  }

  blocks.push(heading2("Structural Tensions"));
  for (const t of tensions.structuralTensions) {
    blocks.push(
      calloutBlock(
        `${t.tensionStatement}\nUnits: ${t.unitIds.join(", ")} | Type: ${t.type}`,
        "\u2194\uFE0F"
      )
    );
  }

  blocks.push(divider());
  blocks.push(heading2("Boundary Conditions"));
  for (const b of tensions.boundaryConditions) {
    blocks.push(bulletedListItem(b.description));
  }

  blocks.push(divider());
  blocks.push(
    calloutBlock(`Dominant Risk: ${tensions.dominantRisk}`, "\uD83C\uDFAF")
  );

  return blocks;
}

export function insightsToBlocks(
  insights: {
    insights: Array<{
      statement: string;
      evidenceBasis: string[];
      whyNonObvious: string;
      boundaryConditions: string;
      relatedTensions: string;
    }>;
    topicDisposition: string;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2("Insights"));
  blocks.push(
    paragraph(`Topic Disposition: **${insights.topicDisposition}**`)
  );
  blocks.push(divider());

  for (const [i, ins] of insights.insights.entries()) {
    blocks.push(heading3(`Insight ${i + 1}`));
    blocks.push(
      calloutBlock(ins.statement, "\uD83D\uDCA1")
    );
    blocks.push(
      paragraph(`Evidence: ${ins.evidenceBasis.join(", ")}`)
    );
    blocks.push(
      paragraph(`Why non-obvious: ${ins.whyNonObvious}`)
    );
    blocks.push(
      paragraph(`Boundary conditions: ${ins.boundaryConditions}`)
    );
    blocks.push(
      paragraph(`Related tensions: ${ins.relatedTensions}`)
    );
    blocks.push(divider());
  }

  return blocks;
}

export function scoringToBlocks(
  scoring: {
    scoredInsights: Array<{
      insightStatement: string;
      scores: {
        positioningImpact: number;
        trustAndProofImpact: number;
        economicImpact: number;
        gtmFeasibilityImpact: number;
        riskSeverity: number;
      };
      justification: string;
    }>;
    topDecisionCritical: string[];
    insightsToMonitor: string[];
    insightsToDeprioritize: string[];
    commonDownstreamMistake: string;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading2("Decision Relevance Scoring"));

  for (const si of scoring.scoredInsights) {
    const s = si.scores;
    const total =
      s.positioningImpact +
      s.trustAndProofImpact +
      s.economicImpact +
      s.gtmFeasibilityImpact +
      s.riskSeverity;

    blocks.push(heading3(si.insightStatement));
    blocks.push(
      paragraph(
        `Positioning: ${s.positioningImpact}/5 | Trust: ${s.trustAndProofImpact}/5 | Economic: ${s.economicImpact}/5 | GTM: ${s.gtmFeasibilityImpact}/5 | Risk: ${s.riskSeverity}/5 | **Total: ${total}/25**`
      )
    );
    blocks.push(paragraph(si.justification));
    blocks.push(divider());
  }

  blocks.push(heading2("Top 3 Decision-Critical"));
  for (const d of scoring.topDecisionCritical) {
    blocks.push(numberedListItem(d));
  }

  blocks.push(heading2("Insights to Monitor"));
  for (const m of scoring.insightsToMonitor) {
    blocks.push(bulletedListItem(m));
  }

  blocks.push(heading2("Insights to Deprioritize"));
  for (const d of scoring.insightsToDeprioritize) {
    blocks.push(bulletedListItem(d));
  }

  blocks.push(divider());
  blocks.push(
    calloutBlock(
      `Common Downstream Mistake: ${scoring.commonDownstreamMistake}`,
      "\u26A0\uFE0F"
    )
  );

  return blocks;
}

export function synthesisToBlocks(
  synthesis: {
    reinforcingConstellations: Array<{
      label: string;
      includedInsights: string[];
      sharedReality: string;
    }>;
    crossTopicTensions: Array<{
      tensionStatement: string;
      topicsInvolved: string[];
      whyItMatters: string;
    }>;
    nonNegotiableConstraints: string[];
    openStrategicQuestions: string[];
    shapeOfTheProblem: string;
  }
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading1("Cross-Topic Synthesis"));

  blocks.push(heading2("Reinforcing Insight Constellations"));
  for (const c of synthesis.reinforcingConstellations) {
    blocks.push(heading3(c.label));
    blocks.push(paragraph(c.sharedReality));
    for (const ins of c.includedInsights) {
      blocks.push(bulletedListItem(ins));
    }
    blocks.push(divider());
  }

  blocks.push(heading2("Cross-Topic Tensions"));
  for (const t of synthesis.crossTopicTensions) {
    blocks.push(
      calloutBlock(
        `${t.tensionStatement}\nTopics: ${t.topicsInvolved.join(", ")}\nWhy it matters: ${t.whyItMatters}`,
        "\u2194\uFE0F"
      )
    );
  }

  blocks.push(divider());
  blocks.push(heading2("Non-Negotiable Constraints"));
  for (const c of synthesis.nonNegotiableConstraints) {
    blocks.push(
      calloutBlock(c, "\uD83D\uDED1")
    );
  }

  blocks.push(divider());
  blocks.push(heading2("Open Strategic Questions"));
  for (const q of synthesis.openStrategicQuestions) {
    blocks.push(numberedListItem(q));
  }

  blocks.push(divider());
  blocks.push(heading2("Shape of the Problem"));
  blocks.push(paragraph(synthesis.shapeOfTheProblem));

  return blocks;
}
