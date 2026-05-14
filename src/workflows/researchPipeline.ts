import type { GitHubDiscoverySeed, PipelineResult } from "../core/schemas.js";
import { buildAuditQueue } from "../core/auditQueue.js";
import { rankPrograms } from "../core/scoring.js";
import { discoverGitHubPrograms, enrichGitHubPrograms, type FetchLike } from "../discovery/github.js";

export async function researchPipelineWorkflow(
  seeds: GitHubDiscoverySeed[],
  options: {
    fetchImpl?: FetchLike;
    token?: string;
  } = {}
): Promise<PipelineResult> {
  "use workflow";

  const discovered = await discoverCandidatesStep(seeds, options);
  const enriched = await enrichCandidatesStep(discovered, options);
  const scores = await triageCandidatesStep(enriched);
  const auditQueue = buildAuditQueue(enriched, scores);

  return {
    generatedAt: new Date().toISOString(),
    discoveredCount: discovered.length,
    enrichedCount: enriched.length,
    triagedCount: scores.length,
    auditQueue,
    rejected: scores
      .filter((score) => !score.proceed)
      .map((score) => ({
        programId: score.programId,
        name: score.name,
        refusalReason: score.refusalReason,
        safeNextStep: score.safeNextStep
      }))
  };
}

async function discoverCandidatesStep(
  seeds: GitHubDiscoverySeed[],
  options: {
    fetchImpl?: FetchLike;
    token?: string;
  }
) {
  "use step";
  return discoverGitHubPrograms(seeds, options);
}

async function enrichCandidatesStep(
  programs: Awaited<ReturnType<typeof discoverGitHubPrograms>>,
  options: {
    fetchImpl?: FetchLike;
    token?: string;
  }
) {
  "use step";
  return enrichGitHubPrograms(programs, options);
}

async function triageCandidatesStep(
  programs: Awaited<ReturnType<typeof enrichGitHubPrograms>>
) {
  "use step";
  return rankPrograms(programs);
}
