import type { Program } from "../core/schemas.js";
import { rankPrograms } from "../core/scoring.js";

export async function programScoutWorkflow(programs: Program[]) {
  "use workflow";

  const normalized = await normalizeProgramsStep(programs);
  return economicTriageStep(normalized);
}

async function normalizeProgramsStep(programs: Program[]) {
  "use step";

  return programs.map((program) => ({
    ...program,
    repoUrls: Array.from(new Set(program.repoUrls)),
    targets: program.targets.filter((target) => target.identifier.trim() !== "")
  }));
}

async function economicTriageStep(programs: Program[]) {
  "use step";

  return rankPrograms(programs);
}
