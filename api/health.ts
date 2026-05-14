import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(_request: IncomingMessage, response: ServerResponse): void {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({
    ok: true,
    service: "open-bounty-workbench",
    runtime: "vercel",
    canRunApprovedAudits: false,
    generatedAt: new Date().toISOString()
  }, null, 2));
}
