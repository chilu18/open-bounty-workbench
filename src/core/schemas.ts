import { z } from "zod";

export const ScopeTargetSchema = z.object({
  type: z.enum(["repo", "web", "package", "mobile", "desktop", "other"]),
  identifier: z.string().min(1),
  inScope: z.boolean(),
  notes: z.string().default("")
});

export const ProgramSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  platform: z.string().min(1),
  programUrl: z.string().url(),
  scopeUrl: z.string().url().optional(),
  disclosureUrl: z.string().url().optional(),
  paid: z.boolean(),
  minRewardUsd: z.number().nonnegative().optional(),
  maxRewardUsd: z.number().nonnegative().optional(),
  authorization: z.enum(["explicit", "ambiguous", "none"]),
  safeHarbor: z.enum(["explicit", "partial", "unknown"]),
  allowsLocalTesting: z.boolean(),
  allowsLiveTesting: z.boolean(),
  requiresEnrollment: z.boolean(),
  repoUrls: z.array(z.string().url()).default([]),
  targets: z.array(ScopeTargetSchema).default([]),
  outOfScope: z.array(z.string()).default([]),
  notes: z.string().default("")
});

export const ObservedFactSchema = z.object({
  claim: z.string().min(1),
  evidenceSource: z.enum(["code", "trace", "log", "test", "config", "documentation", "unavailable"]),
  evidenceReference: z.string().min(1)
});

export const FindingCandidateSchema = z.object({
  id: z.string().min(1),
  programId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["hypothesis", "needs_validation", "validated", "rejected"]),
  affectedTarget: z.string().min(1),
  observedFacts: z.array(ObservedFactSchema),
  inferences: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
  violatedInvariant: z.string().default(""),
  trustBoundary: z.string().default(""),
  attackerControl: z.string().default(""),
  exploitPreconditions: z.array(z.string()).default([]),
  impact: z.string().default(""),
  reproductionSteps: z.array(z.string()).default([]),
  counterevidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});

export const GitHubDiscoverySeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  query: z.string().min(1),
  platform: z.string().min(1).default("github"),
  programUrl: z.string().url().optional(),
  scopeUrl: z.string().url().optional(),
  disclosureUrl: z.string().url().optional(),
  paid: z.boolean().default(false),
  safeHarbor: z.enum(["explicit", "partial", "unknown"]).default("unknown"),
  allowsLocalTesting: z.boolean().default(true),
  allowsLiveTesting: z.boolean().default(false),
  requiresEnrollment: z.boolean().default(false),
  outOfScope: z.array(z.string()).default([]),
  maxResults: z.number().int().positive().max(50).default(10),
  notes: z.string().default("")
});

export const GitHubDiscoverySeedListSchema = z.array(GitHubDiscoverySeedSchema);

export const AuditQueueItemSchema = z.object({
  programId: z.string().min(1),
  name: z.string().min(1),
  repoUrl: z.string().url(),
  score: z.number().min(0).max(1),
  signalQualityScore: z.number().min(0).max(1),
  exploitabilityConfidenceFloor: z.number().min(0).max(1),
  scopeUrl: z.string().url().optional(),
  disclosureUrl: z.string().url().optional(),
  requiresHumanApproval: z.boolean(),
  safeNextStep: z.string().min(1),
  warnings: z.array(z.string()).default([])
});

export const AuditQueueSchema = z.array(AuditQueueItemSchema);

export const PipelineResultSchema = z.object({
  generatedAt: z.string().datetime(),
  discoveredCount: z.number().int().nonnegative(),
  enrichedCount: z.number().int().nonnegative(),
  triagedCount: z.number().int().nonnegative(),
  auditQueue: AuditQueueSchema,
  rejected: z.array(z.object({
    programId: z.string().min(1),
    name: z.string().min(1),
    refusalReason: z.string().optional(),
    safeNextStep: z.string().optional()
  }))
});

export const LocalAuditFindingSchema = z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["info", "low", "medium", "high"]),
  file: z.string().min(1),
  line: z.number().int().positive(),
  evidence: z.string().min(1),
  rationale: z.string().min(1),
  safeNextStep: z.string().min(1)
});

export const LocalAuditResultSchema = z.object({
  generatedAt: z.string().datetime(),
  repoPath: z.string().min(1),
  filesScanned: z.number().int().nonnegative(),
  findings: z.array(LocalAuditFindingSchema),
  notes: z.array(z.string())
});

export type Program = z.infer<typeof ProgramSchema>;
export type FindingCandidate = z.infer<typeof FindingCandidateSchema>;
export type ObservedFact = z.infer<typeof ObservedFactSchema>;
export type GitHubDiscoverySeed = z.infer<typeof GitHubDiscoverySeedSchema>;
export type AuditQueueItem = z.infer<typeof AuditQueueItemSchema>;
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
export type LocalAuditFinding = z.infer<typeof LocalAuditFindingSchema>;
export type LocalAuditResult = z.infer<typeof LocalAuditResultSchema>;

export const ProgramListSchema = z.array(ProgramSchema);
