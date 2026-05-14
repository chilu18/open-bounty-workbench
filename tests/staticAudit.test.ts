import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditLocalRepo } from "../src/audit/staticAudit.js";

describe("static local audit", () => {
  it("reports static hypotheses with evidence and safe next steps", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "obw-audit-"));

    try {
      await writeFile(
        path.join(directory, "handler.ts"),
        "import { exec } from 'node:child_process';\nexec(req.query.command);\n"
      );

      const result = await auditLocalRepo(directory);

      expect(result.filesScanned).toBe(1);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe("node-child-process-user-input");
      expect(result.findings[0].evidence).toContain("exec");
      expect(result.notes[0]).toContain("hypotheses");
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
