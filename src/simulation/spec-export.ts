import type { ProductSpecImpact, SimulationReport } from "./types.js";

export function exportProductSpecFromRun(report: SimulationReport): ProductSpecImpact {
  return {
    title: `${report.scenarioName} Spec Impact`,
    scenarioId: report.scenarioId,
    runId: report.runId,
    researchBacking: report.evidenceFindingIds,
    sections: [
      {
        title: "Simulation Summary",
        body: report.summary,
      },
      {
        title: "Simulation Recommendations",
        body: report.recommendations.map((item) => `- ${item}`).join("\n"),
      },
      {
        title: "Risks and Assumptions",
        body: [
          ...report.risks.map((item) => `Risk: ${item}`),
          ...report.unresolvedAssumptions.map((item) => `Assumption: ${item}`),
        ].join("\n"),
      },
      {
        title: "Evidence Trace",
        body: report.evidenceFindingIds.length
          ? report.evidenceFindingIds.map((id) => `- ${id}`).join("\n")
          : "No research evidence ids were attached to this run.",
      },
      ...(report.modelProfiles.length || report.rounds.length ? [
        {
          title: "Model Swarm Scorecard",
          body: [
            `Adoption: ${Math.round(report.scorecard.adoption * 100)}%`,
            `Resistance: ${Math.round(report.scorecard.resistance * 100)}%`,
            `Confidence: ${Math.round(report.scorecard.confidence * 100)}%`,
            `Risk: ${Math.round(report.scorecard.risk * 100)}%`,
            `Evidence coverage: ${Math.round(report.scorecard.evidenceCoverage * 100)}%`,
            `Model diversity: ${Math.round(report.scorecard.modelDiversity * 100)}%`,
            `Estimated cost: $${report.costs.estimatedCostUsd.toFixed(4)}`,
          ].join("\n"),
        },
        {
          title: "Model Disagreements",
          body: report.rounds.length
            ? report.rounds.map((round) => `- Round ${round.index} (${round.phase}): adoption ${Math.round(round.scorecard.adoption * 100)}%, risk ${Math.round(round.scorecard.risk * 100)}%.`).join("\n")
            : "No round-level disagreements were recorded.",
        },
        {
          title: "Product Spec Diff",
          body: [
            "+ Add evidence ids to each affected requirement.",
            "+ Add validation metric and rollback signal for the simulated variable.",
            "+ Add unresolved-assumption section before build handoff.",
            "- Remove requirements that cannot be traced to research or transcript evidence.",
          ].join("\n"),
        },
      ] : []),
    ],
  };
}
