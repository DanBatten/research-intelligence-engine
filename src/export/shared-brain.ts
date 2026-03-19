import type { PipelineState, TopicState } from "../pipeline/types.js";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

function renderSynthesis(state: PipelineState): string {
  const s9 = state.synthesis;
  if (!s9) return "";

  const lines: string[] = [];
  lines.push("## Cross-Topic Synthesis\n");

  lines.push("### The Shape of the Problem\n");
  lines.push(s9.shapeOfTheProblem);
  lines.push("");

  if (s9.nonNegotiableConstraints.length > 0) {
    lines.push("### Non-Negotiable Constraints\n");
    for (const c of s9.nonNegotiableConstraints) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  if (s9.reinforcingConstellations.length > 0) {
    lines.push("### Reinforcing Insight Constellations\n");
    for (const rc of s9.reinforcingConstellations) {
      lines.push(`**${rc.label}**\n`);
      lines.push(rc.sharedReality);
      lines.push("");
      for (const insight of rc.includedInsights) {
        lines.push(`- ${insight}`);
      }
      lines.push("");
    }
  }

  if (s9.crossTopicTensions.length > 0) {
    lines.push("### Cross-Topic Tensions\n");
    for (const t of s9.crossTopicTensions) {
      lines.push(`**${t.tensionStatement}**\n`);
      lines.push(`Topics: ${t.topicsInvolved.join(", ")}`);
      lines.push("");
      lines.push(t.whyItMatters);
      lines.push("");
    }
  }

  if (s9.openStrategicQuestions.length > 0) {
    lines.push("### Open Strategic Questions\n");
    for (const q of s9.openStrategicQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderTopic(ts: TopicState): string {
  const lines: string[] = [];
  const num = ts.topicIndex + 1;

  lines.push(`## Topic ${num}: ${ts.topic.title}\n`);
  lines.push(`**Research question:** ${ts.topic.whatWeAreTryingToLearn}\n`);

  if (ts.insights) {
    lines.push(`**Disposition:** ${ts.insights.topicDisposition}\n`);
  }

  // Decision-Critical Insights (top 3 from S8)
  if (ts.scoring?.topDecisionCritical && ts.scoring.topDecisionCritical.length > 0) {
    lines.push("### Decision-Critical Insights\n");
    for (const dc of ts.scoring.topDecisionCritical.slice(0, 3)) {
      lines.push(`- ${dc}`);
    }
    lines.push("");
  }

  // Key Insights (S7)
  if (ts.insights?.insights && ts.insights.insights.length > 0) {
    lines.push("### Key Insights\n");
    for (const insight of ts.insights.insights) {
      lines.push(`**${insight.statement}**\n`);
      lines.push(`- *Why non-obvious:* ${insight.whyNonObvious}`);
      lines.push(`- *Boundary conditions:* ${insight.boundaryConditions}`);
      lines.push("");
    }
  }

  // Structural Tensions (S6)
  if (ts.tensions?.structuralTensions && ts.tensions.structuralTensions.length > 0) {
    lines.push("### Structural Tensions\n");
    for (const t of ts.tensions.structuralTensions) {
      lines.push(`- **${t.type}:** ${t.tensionStatement}`);
    }
    lines.push("");
  }

  // Boundary Conditions (S6)
  if (ts.tensions?.boundaryConditions && ts.tensions.boundaryConditions.length > 0) {
    lines.push("### Boundary Conditions\n");
    for (const bc of ts.tensions.boundaryConditions) {
      lines.push(`- ${bc.description}`);
    }
    lines.push("");
  }

  // Watch Out (S8)
  if (ts.scoring?.commonDownstreamMistake) {
    lines.push("### Watch Out\n");
    lines.push(ts.scoring.commonDownstreamMistake);
    lines.push("");
  }

  return lines.join("\n");
}

export function compileSharedBrain(state: PipelineState): { content: Buffer; filename: string } {
  const lines: string[] = [];

  // Header
  lines.push(`# ${state.projectName} — Research Brain`);
  lines.push(`> Generated ${formatDate()}. Upload this file to your Claude Projects folder for shared brand context.\n`);

  // Research Overview
  if (state.topics && state.topics.length > 0) {
    lines.push("## Research Overview\n");
    for (let i = 0; i < state.topics.length; i++) {
      const t = state.topics[i]!;
      lines.push(`${i + 1}. **${t.title}** — ${t.whatWeAreTryingToLearn}`);
    }
    lines.push("");
  }

  // Cross-Topic Synthesis
  lines.push(renderSynthesis(state));

  // Per-topic deep dives
  const sortedTopics = [...(state.topicResults ?? [])].sort(
    (a, b) => a.topicIndex - b.topicIndex
  );

  for (const ts of sortedTopics) {
    lines.push(renderTopic(ts));
  }

  const filename = `${sanitizeFilename(state.projectName) || "project"}-research-brain.md`;
  const content = Buffer.from(lines.join("\n"), "utf-8");

  return { content, filename };
}
