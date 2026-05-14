import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { GitHubDiscoverySeedListSchema } from "../core/schemas.js";
import { auditLocalRepo } from "../audit/staticAudit.js";
import { researchPipelineWorkflow } from "../workflows/researchPipeline.js";

const root = process.cwd();
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const targetRoot = process.env.OBW_TARGET_ROOT ?? path.join(process.env.HOME ?? root, "obw-targets");

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function safeDirectoryName(value: string): string {
  return value.replace(/[^a-z0-9._-]/gi, "-").slice(0, 120);
}

function runCommand(command: string, args: string[], cwd: string): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

async function cloneIfNeeded(repoUrl: string, directory: string): Promise<string[]> {
  const notes: string[] = [];

  try {
    await readFile(path.join(directory, ".git", "HEAD"), "utf8");
    notes.push("Repository already exists locally; skipped clone.");
    return notes;
  }
  catch {
    await mkdir(path.dirname(directory), { recursive: true });
  }

  const clone = await runCommand("git", ["clone", "--depth", "1", repoUrl, directory], root);
  if (clone.code !== 0) {
    throw new Error(`git clone failed: ${clone.stderr || clone.stdout}`);
  }

  notes.push("Repository cloned with depth=1.");
  return notes;
}

async function serveStatic(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));

  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  }
  catch {
    sendText(response, 404, "Not found");
  }
}

async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "open-bounty-workbench",
      generatedAt: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pipeline") {
    const body = await readRequestJson(request);
    const seeds = GitHubDiscoverySeedListSchema.parse((body as { seeds?: unknown }).seeds);
    const result = await researchPipelineWorkflow(seeds, {
      token: process.env.GITHUB_TOKEN
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/audit-local") {
    const body = await readRequestJson(request) as { repoPath?: unknown };
    if (typeof body.repoPath !== "string" || body.repoPath.trim().length === 0) {
      sendJson(response, 400, { error: "repoPath is required" });
      return;
    }

    const result = await auditLocalRepo(body.repoPath);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/run-approved-audit") {
    const body = await readRequestJson(request) as {
      programId?: unknown;
      repoUrl?: unknown;
      name?: unknown;
    };

    if (typeof body.programId !== "string" || typeof body.repoUrl !== "string") {
      sendJson(response, 400, { error: "programId and repoUrl are required" });
      return;
    }

    if (!body.repoUrl.startsWith("https://github.com/")) {
      sendJson(response, 400, { error: "Only https://github.com repositories are supported for this local action." });
      return;
    }

    const directory = path.join(targetRoot, safeDirectoryName(body.programId));
    const cloneNotes = await cloneIfNeeded(body.repoUrl, directory);
    const result = await auditLocalRepo(directory);

    sendJson(response, 200, {
      ...result,
      programId: body.programId,
      name: typeof body.name === "string" ? body.name : body.programId,
      repoUrl: body.repoUrl,
      notes: [...cloneNotes, ...result.notes]
    });
    return;
  }

  sendJson(response, 404, { error: "Unknown API route" });
}

const server = createServer((request, response) => {
  void (async () => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response);
        return;
      }

      await serveStatic(request, response);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { error: message });
    }
  })();
});

server.listen(port, host, () => {
  console.log(`Open Bounty Workbench UI listening on http://${host}:${port}`);
});
