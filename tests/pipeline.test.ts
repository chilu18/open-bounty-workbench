import { describe, expect, it } from "vitest";
import { GitHubDiscoverySeedSchema } from "../src/core/schemas.js";
import { researchPipelineWorkflow } from "../src/workflows/researchPipeline.js";

const seed = GitHubDiscoverySeedSchema.parse({
  id: "pipeline",
  name: "Pipeline",
  query: "repo:example/project",
  maxResults: 1
});

describe("research pipeline", () => {
  it("chains discovery, enrichment, triage, and audit queue creation", async () => {
    const securityPolicy = Buffer.from("Report a vulnerability privately through this security policy.").toString("base64");

    const result = await researchPipelineWorkflow([seed], {
      fetchImpl: async (url) => {
        if (url.includes("/search/repositories")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              items: [{
                full_name: "example/project",
                html_url: "https://github.com/example/project",
                description: "Example",
                archived: false,
                disabled: false,
                fork: false,
                stargazers_count: 500,
                pushed_at: "2026-05-14T00:00:00Z",
                topics: ["security"]
              }]
            })
          };
        }

        if (url.includes("/community/profile")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ files: {} })
          };
        }

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            html_url: "https://github.com/example/project/security/policy",
            encoding: "base64",
            content: securityPolicy
          })
        };
      }
    });

    expect(result.discoveredCount).toBe(1);
    expect(result.enrichedCount).toBe(1);
    expect(result.triagedCount).toBe(1);
    expect(result.auditQueue).toHaveLength(1);
    expect(result.auditQueue[0].requiresHumanApproval).toBe(true);
  });
});
