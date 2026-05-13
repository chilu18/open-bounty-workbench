import { describe, expect, it } from "vitest";
import samplePrograms from "../examples/programs.sample.json" with { type: "json" };
import { ProgramListSchema } from "../src/core/schemas.js";
import { rankPrograms } from "../src/core/scoring.js";

describe("economic triage", () => {
  it("ranks explicit open-source programs above ambiguous targets", () => {
    const programs = ProgramListSchema.parse(samplePrograms);
    const ranked = rankPrograms(programs);

    expect(ranked[0].programId).toBe("zabbix");
    expect(ranked[0].proceed).toBe(true);
    expect(ranked[1].proceed).toBe(false);
    expect(ranked[1].refusalReason).toBe("scope_ambiguous");
  });
});
