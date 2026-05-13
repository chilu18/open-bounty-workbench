import type { FindingCandidate, Program } from "../core/schemas.js";

export type RefusalReason =
  | "scope_ambiguous"
  | "unauthorized_activity"
  | "insufficient_evidence"
  | "opsec_risk"
  | "low_signal"
  | "external_action_requires_human";

export type GateDecision =
  | { proceed: true; warnings: string[] }
  | { proceed: false; refusalReason: RefusalReason; safeNextStep: string };

export function verifyProgramScope(program: Program): GateDecision {
  if (program.authorization !== "explicit") {
    return {
      proceed: false,
      refusalReason: "scope_ambiguous",
      safeNextStep: "Add an official scope URL or authorization document before auditing this target."
    };
  }

  if (program.targets.filter((target) => target.inScope).length === 0) {
    return {
      proceed: false,
      refusalReason: "scope_ambiguous",
      safeNextStep: "Add at least one explicit in-scope target."
    };
  }

  if (!program.disclosureUrl && !program.scopeUrl) {
    return {
      proceed: false,
      refusalReason: "insufficient_evidence",
      safeNextStep: "Add a disclosure or scope reference URL."
    };
  }

  const warnings: string[] = [];

  if (program.requiresEnrollment) {
    warnings.push("Human must confirm enrollment and accepted terms before external testing.");
  }

  if (program.allowsLiveTesting) {
    warnings.push("Live testing requires a separate human approval gate.");
  }

  return { proceed: true, warnings };
}

export function verifyFindingForReport(finding: FindingCandidate): GateDecision {
  if (finding.status !== "validated") {
    return {
      proceed: false,
      refusalReason: "insufficient_evidence",
      safeNextStep: "Validate the finding locally and attach deterministic evidence before drafting a report."
    };
  }

  if (finding.observedFacts.length === 0) {
    return {
      proceed: false,
      refusalReason: "insufficient_evidence",
      safeNextStep: "Add observed facts with evidence references."
    };
  }

  if (!finding.violatedInvariant || !finding.trustBoundary || !finding.attackerControl) {
    return {
      proceed: false,
      refusalReason: "insufficient_evidence",
      safeNextStep: "Document violated invariant, trust boundary, and attacker-controlled input."
    };
  }

  if (finding.confidence < 0.6) {
    return {
      proceed: false,
      refusalReason: "low_signal",
      safeNextStep: "Gather stronger reproduction evidence or reject the candidate."
    };
  }

  return { proceed: true, warnings: ["Human must submit the final report manually."] };
}

export function requireHumanApproval(action: string): GateDecision {
  return {
    proceed: false,
    refusalReason: "external_action_requires_human",
    safeNextStep: `Human approval required before: ${action}`
  };
}
