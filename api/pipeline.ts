import type { IncomingMessage, ServerResponse } from "node:http";
import { GitHubDiscoverySeedListSchema } from "../src/core/schemas.js";
import { researchPipelineWorkflow } from "../src/workflows/researchPipeline.js";

type RequestWithBody = IncomingMessage & {
  body?: unknown;
};

async function readJson(request: RequestWithBody): Promise<unknown> {
  if (request.body) {
    return typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body, null, 2));
}

export default async function handler(request: RequestWithBody, response: ServerResponse): Promise<void> {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(request) as { seeds?: unknown };
    const seeds = GitHubDiscoverySeedListSchema.parse(body.seeds);
    const result = await researchPipelineWorkflow(seeds, {
      token: process.env.GITHUB_TOKEN
    });
    sendJson(response, 200, result);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(response, 500, { error: message });
  }
}
