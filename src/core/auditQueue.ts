import type { AuditQueueItem, Program } from "./schemas.js";
import type { ProgramScore } from "./scoring.js";

export function buildAuditQueue(programs: Program[], scores: ProgramScore[]): AuditQueueItem[] {
  const programById = new Map(programs.map((program) => [program.id, program]));
  const queue: AuditQueueItem[] = [];

  for (const score of scores) {
    if (!score.proceed) {
      continue;
    }

    const program = programById.get(score.programId);
    if (!program || program.repoUrls.length === 0) {
      continue;
    }

    queue.push({
      programId: program.id,
      name: program.name,
      repoUrl: program.repoUrls[0],
      score: score.total,
      signalQualityScore: score.signalQualityScore,
      exploitabilityConfidenceFloor: score.exploitabilityConfidenceFloor,
      scopeUrl: program.scopeUrl,
      disclosureUrl: program.disclosureUrl,
      requiresHumanApproval: true,
      safeNextStep: "Human must approve cloning and local-only audit before work starts.",
      warnings: score.warnings
    });
  }

  return queue.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
