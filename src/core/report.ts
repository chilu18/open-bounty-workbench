import type { FindingCandidate } from "./schemas.js";
import { verifyFindingForReport } from "../policy/gates.js";

export function draftReport(finding: FindingCandidate): string {
  const gate = verifyFindingForReport(finding);

  if (!gate.proceed) {
    return JSON.stringify({
      proceed: false,
      refusal_reason: gate.refusalReason,
      safe_next_step: gate.safeNextStep
    }, null, 2);
  }

  const facts = finding.observedFacts
    .map((fact, index) => `${index + 1}. ${fact.claim} (${fact.evidenceSource}: ${fact.evidenceReference})`)
    .join("\n");

  return [
    `# ${finding.title}`,
    "",
    "## Summary",
    finding.impact,
    "",
    "## Affected Target",
    finding.affectedTarget,
    "",
    "## Observed Facts",
    facts,
    "",
    "## Root Cause",
    `Violated invariant: ${finding.violatedInvariant}`,
    `Trust boundary: ${finding.trustBoundary}`,
    `Attacker-controlled input: ${finding.attackerControl}`,
    "",
    "## Preconditions",
    finding.exploitPreconditions.map((step) => `- ${step}`).join("\n"),
    "",
    "## Reproduction",
    finding.reproductionSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    "## Counterevidence And Limitations",
    finding.counterevidence.map((item) => `- ${item}`).join("\n"),
    "",
    "## Confidence",
    `${finding.confidence}`,
    "",
    "## Submission Note",
    "Human operator must submit this manually inside the authorized platform and configure payout separately."
  ].join("\n");
}
