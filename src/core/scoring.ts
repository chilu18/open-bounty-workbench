import type { Program } from "./schemas.js";
import { verifyProgramScope } from "../policy/gates.js";

export type ProgramScore = {
  programId: string;
  name: string;
  proceed: boolean;
  total: number;
  signalQualityScore: number;
  exploitabilityConfidenceFloor: number;
  factors: Record<string, number>;
  warnings: string[];
  refusalReason?: string;
  safeNextStep?: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function scoreProgram(program: Program): ProgramScore {
  const gate = verifyProgramScope(program);

  const scopeClarity = program.authorization === "explicit" ? 1 : 0;
  const repoAccess = program.repoUrls.length > 0 ? 1 : 0.25;
  const paidSignal = program.paid ? 1 : 0.25;
  const rewardPotential = clamp(((program.maxRewardUsd ?? program.minRewardUsd ?? 0) / 5000));
  const safeHarbor = program.safeHarbor === "explicit" ? 1 : program.safeHarbor === "partial" ? 0.6 : 0.2;
  const localFirst = program.allowsLocalTesting ? 1 : 0.2;
  const liveRiskPenalty = program.allowsLiveTesting && !program.allowsLocalTesting ? 0.35 : 0;
  const enrollmentPenalty = program.requiresEnrollment ? 0.1 : 0;
  const outOfScopeClarity = program.outOfScope.length > 0 ? 1 : 0.5;

  const factors = {
    scopeClarity,
    repoAccess,
    paidSignal,
    rewardPotential,
    safeHarbor,
    localFirst,
    outOfScopeClarity,
    liveRiskPenalty,
    enrollmentPenalty
  };

  const signalQualityScore = clamp(
    scopeClarity * 0.25 +
      repoAccess * 0.2 +
      paidSignal * 0.1 +
      rewardPotential * 0.15 +
      safeHarbor * 0.15 +
      localFirst * 0.1 +
      outOfScopeClarity * 0.05 -
      liveRiskPenalty -
      enrollmentPenalty
  );

  const exploitabilityConfidenceFloor = clamp(repoAccess * 0.35 + localFirst * 0.35 + scopeClarity * 0.3);
  const total = gate.proceed ? signalQualityScore : 0;

  if (!gate.proceed) {
    return {
      programId: program.id,
      name: program.name,
      proceed: false,
      total,
      signalQualityScore,
      exploitabilityConfidenceFloor,
      factors,
      warnings: [],
      refusalReason: gate.refusalReason,
      safeNextStep: gate.safeNextStep
    };
  }

  return {
    programId: program.id,
    name: program.name,
    proceed: signalQualityScore >= 0.6 && exploitabilityConfidenceFloor >= 0.2,
    total,
    signalQualityScore,
    exploitabilityConfidenceFloor,
    factors,
    warnings: gate.warnings
  };
}

export function rankPrograms(programs: Program[]): ProgramScore[] {
  return programs.map(scoreProgram).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
