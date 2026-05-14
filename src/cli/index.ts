#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  ProgramListSchema,
  FindingCandidateSchema,
  GitHubDiscoverySeedListSchema
} from "../core/schemas.js";
import { rankPrograms } from "../core/scoring.js";
import { draftReport } from "../core/report.js";
import { discoverGitHubPrograms } from "../discovery/github.js";

const [, , command, file] = process.argv;

function usage(): never {
  console.error("Usage: obw <triage|report|discover-github> <json-file>");
  process.exit(1);
}

if (!command || !file) {
  usage();
}

const json = JSON.parse(readFileSync(file, "utf8"));

if (command === "triage") {
  const programs = ProgramListSchema.parse(json);
  console.log(JSON.stringify(rankPrograms(programs), null, 2));
}
else if (command === "report") {
  const finding = FindingCandidateSchema.parse(json);
  console.log(draftReport(finding));
}
else if (command === "discover-github") {
  const seeds = GitHubDiscoverySeedListSchema.parse(json);
  const programs = await discoverGitHubPrograms(seeds, {
    token: process.env.GITHUB_TOKEN
  });
  console.log(JSON.stringify(programs, null, 2));
}
else {
  usage();
}
