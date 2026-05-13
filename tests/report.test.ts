import { describe, expect, it } from "vitest";
import sampleFinding from "../examples/finding.sample.json" with { type: "json" };
import { FindingCandidateSchema } from "../src/core/schemas.js";
import { draftReport } from "../src/core/report.js";

describe("report drafting", () => {
  it("includes evidence, root cause, and manual submission note", () => {
    const finding = FindingCandidateSchema.parse(sampleFinding);
    const report = draftReport(finding);

    expect(report).toContain("## Observed Facts");
    expect(report).toContain("Violated invariant");
    expect(report).toContain("Human operator must submit this manually");
  });
});
