import { describe, expect, it } from "vitest";
import { ProgramSchema } from "../src/core/schemas.js";
import { verifyProgramScope, verifyFindingForReport } from "../src/policy/gates.js";
import samplePrograms from "../examples/programs.sample.json" with { type: "json" };
import sampleFinding from "../examples/finding.sample.json" with { type: "json" };
import { FindingCandidateSchema } from "../src/core/schemas.js";

describe("policy gates", () => {
  it("allows explicitly scoped local-first programs", () => {
    const program = ProgramSchema.parse(samplePrograms[0]);
    expect(verifyProgramScope(program).proceed).toBe(true);
  });

  it("rejects ambiguous scope", () => {
    const program = ProgramSchema.parse(samplePrograms[1]);
    const decision = verifyProgramScope(program);
    expect(decision.proceed).toBe(false);
    if (!decision.proceed) {
      expect(decision.refusalReason).toBe("scope_ambiguous");
    }
  });

  it("allows report drafting only for validated evidence-rich findings", () => {
    const finding = FindingCandidateSchema.parse(sampleFinding);
    expect(verifyFindingForReport(finding).proceed).toBe(true);
  });
});
