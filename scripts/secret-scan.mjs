import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".npm-cache",
  "coverage",
  "dist",
  "node_modules"
]);

const ignoredFiles = new Set(["package-lock.json"]);

const rules = [
  {
    name: "private-key",
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/
  },
  {
    name: "aws-access-key-id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/
  },
  {
    name: "github-token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/
  },
  {
    name: "openai-api-key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/
  },
  {
    name: "anthropic-api-key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/
  },
  {
    name: "stripe-secret-key",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/
  },
  {
    name: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
  },
  {
    name: "high-entropy-secret-assignment",
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b\s*[:=]\s*["'][A-Za-z0-9/+_.=-]{32,}["']/i
  }
];

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (!entry.isFile() || ignoredFiles.has(entry.name)) {
      continue;
    }

    if (textExtensions.has(path.extname(entry.name)) || entry.name.startsWith(".")) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

const findings = [];
const files = await collectFiles(root);

for (const file of files) {
  const fileStat = await stat(file);
  if (fileStat.size > 1024 * 1024) {
    continue;
  }

  const content = await readFile(file, "utf8");
  for (const rule of rules) {
    const match = rule.pattern.exec(content);
    if (match) {
      findings.push({
        rule: rule.name,
        file: path.relative(root, file),
        line: lineNumberForIndex(content, match.index)
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential sensitive data found:");
  for (const finding of findings) {
    console.error(`- ${finding.rule}: ${finding.file}:${finding.line}`);
  }
  process.exit(1);
}

console.log(`Sensitive data scan passed for ${files.length} files.`);
