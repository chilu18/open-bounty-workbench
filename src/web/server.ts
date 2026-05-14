import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GitHubDiscoverySeedListSchema } from "../core/schemas.js";
import { auditLocalRepo } from "../audit/staticAudit.js";
import { researchPipelineWorkflow } from "../workflows/researchPipeline.js";

const root = process.cwd();
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

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
