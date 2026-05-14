import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LocalAuditFinding, LocalAuditResult } from "../core/schemas.js";

type AuditRule = {
  id: string;
  title: string;
  severity: LocalAuditFinding["severity"];
  pattern: RegExp;
  rationale: string;
  safeNextStep: string;
};

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor"
]);

const textExtensions = new Set([
  ".cjs",
  ".go",
  ".js",
  ".jsx",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".ts",
  ".tsx"
]);

const rules: AuditRule[] = [
  {
    id: "node-child-process-user-input",
    title: "Potential shell execution with request-controlled data",
    severity: "medium",
    pattern: /\b(?:exec|execSync)\s*\([^)\n]*(?:req\.|request\.|params|query|body|argv|env)/,
    rationale: "Shell execution with externally influenced data can cross a process trust boundary if arguments are not capability-checked and passed safely.",
    safeNextStep: "Manually verify attacker control, replace shell parsing with execFile/spawn argv arrays, and add a regression test."
  },
  {
    id: "javascript-eval",
    title: "Dynamic code evaluation",
    severity: "medium",
    pattern: /\b(?:eval|Function)\s*\(/,
    rationale: "Dynamic code evaluation can become code execution when untrusted input reaches the evaluated string.",
    safeNextStep: "Trace the evaluated value to a trust boundary and replace dynamic evaluation with a parser or explicit dispatch table."
  },
  {
    id: "sql-string-interpolation",
    title: "Potential SQL query construction with interpolation",
    severity: "medium",
    pattern: /\b(?:query|execute|raw|exec)\s*\(\s*`[^`]*(?:\$\{|SELECT|INSERT|UPDATE|DELETE)/i,
    rationale: "Interpolated SQL can violate the invariant that data and query structure remain separate.",
    safeNextStep: "Verify whether any interpolated value is attacker-controlled, then convert to parameterized queries."
  },
  {
    id: "weak-random-token",
    title: "Math.random used in security-sensitive context",
    severity: "low",
    pattern: /Math\.random\(\)[^\n]*(?:token|secret|password|csrf|session|nonce|reset|invite|code)/i,
    rationale: "Math.random is not suitable for secrets, tokens, or security decisions.",
    safeNextStep: "Confirm security use, replace with cryptographic randomness, and add a token unpredictability regression test."
  },
  {
    id: "insecure-tls-disabled",
    title: "TLS certificate verification appears disabled",
    severity: "high",
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|rejectUnauthorized\s*:\s*false/,
    rationale: "Disabling TLS verification can allow machine-in-the-middle attacks across a network trust boundary.",
    safeNextStep: "Verify runtime reachability, remove the bypass, and configure trusted certificates explicitly."
  },
  {
    id: "python-subprocess-shell",
    title: "Python subprocess shell execution",
    severity: "medium",
    pattern: /subprocess\.(?:run|call|check_call|check_output|Popen)\([^)\n]*shell\s*=\s*True/,
    rationale: "shell=True can make command construction vulnerable when untrusted input reaches the command string.",
    safeNextStep: "Trace command inputs, switch to argv arrays with shell=False, and add coverage for metacharacter input."
  }
];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function evidenceLine(content: string, index: number): string {
  const line = content.split("\n")[lineNumberForIndex(content, index) - 1] ?? "";
  return line.trim().slice(0, 240);
}

export async function auditLocalRepo(repoPath: string): Promise<LocalAuditResult> {
  const root = path.resolve(repoPath);
  const rootStat = await stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`Local audit path is not a directory: ${root}`);
  }

  const files = await collectFiles(root);
  const findings: LocalAuditFinding[] = [];

  for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.size > 1024 * 1024) {
      continue;
    }

    const content = await readFile(file, "utf8");

    for (const rule of rules) {
      const match = rule.pattern.exec(content);
      if (!match) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        file: path.relative(root, file),
        line: lineNumberForIndex(content, match.index),
        evidence: evidenceLine(content, match.index),
        rationale: rule.rationale,
        safeNextStep: rule.safeNextStep
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    repoPath: root,
    filesScanned: files.length,
    findings,
    notes: [
      "Static audit findings are hypotheses, not bounty-ready vulnerabilities.",
      "Do not submit without deterministic reproduction, root-cause analysis, and scoped authorization."
    ]
  };
}
