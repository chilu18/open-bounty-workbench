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

export type Program = z.infer<typeof ProgramSchema>;
export type FindingCandidate = z.infer<typeof FindingCandidateSchema>;
export type ObservedFact = z.infer<typeof ObservedFactSchema>;
export type GitHubDiscoverySeed = z.infer<typeof GitHubDiscoverySeedSchema>;

export const ProgramListSchema = z.array(ProgramSchema);
