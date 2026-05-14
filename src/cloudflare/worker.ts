import { GitHubDiscoverySeedListSchema } from "../core/schemas.js";
import { researchPipelineWorkflow } from "../workflows/researchPipeline.js";

export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  GITHUB_TOKEN?: string;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...init.headers
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "open-bounty-workbench",
        runtime: "cloudflare",
        generatedAt: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/audit-local") {
      return jsonResponse({
        error: "Local filesystem audit is available only in the local/Mac mini runtime."
      }, { status: 501 });
    }

    if (url.pathname === "/api/pipeline") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, { status: 405 });
      }

      try {
        const body = await request.json() as { seeds?: unknown };
        const seeds = GitHubDiscoverySeedListSchema.parse(body.seeds);
        const result = await researchPipelineWorkflow(seeds, {
          token: env.GITHUB_TOKEN
        });
        return jsonResponse(result);
      }
      catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return jsonResponse({ error: message }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
