#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  ProgramListSchema,
  FindingCandidateSchema,
  GitHubDiscoverySeedListSchema
} from "../core/schemas.js";
import { rankPrograms } from "../core/scoring.js";
import { draftReport } from "../core/report.js";
import { discoverGitHubPrograms, enrichGitHubPrograms } from "../discovery/github.js";
import { researchPipelineWorkflow } from "../workflows/researchPipeline.js";
import { auditLocalRepo } from "../audit/staticAudit.js";

const [, , command, file] = process.argv;

function usage(): never {
  console.error("Usage: obw <triage|report|discover-github|enrich-github|pipeline|audit-local> <json-file-or-path>");
  process.exit(1);
}

if (!command || !file) {
  usage();
}

if (command === "triage") {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const programs = ProgramListSchema.parse(json);
  console.log(JSON.stringify(rankPrograms(programs), null, 2));
}
else if (command === "report") {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const finding = FindingCandidateSchema.parse(json);
  console.log(draftReport(finding));
}
else if (command === "discover-github") {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const seeds = GitHubDiscoverySeedListSchema.parse(json);
  const programs = await discoverGitHubPrograms(seeds, {
    token: process.env.GITHUB_TOKEN
  });
  console.log(JSON.stringify(programs, null, 2));
}
else if (command === "enrich-github") {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const programs = ProgramListSchema.parse(json);
  const enriched = await enrichGitHubPrograms(programs, {
    token: process.env.GITHUB_TOKEN
  });
  console.log(JSON.stringify(enriched, null, 2));
}
else if (command === "pipeline") {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const seeds = GitHubDiscoverySeedListSchema.parse(json);
  const result = await researchPipelineWorkflow(seeds, {
    token: process.env.GITHUB_TOKEN
  });
  console.log(JSON.stringify(result, null, 2));
}
else if (command === "audit-local") {
  const result = await auditLocalRepo(file);
  console.log(JSON.stringify(result, null, 2));
}
else {
  usage();
}
