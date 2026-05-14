import { describe, expect, it } from "vitest";
import { discoverGitHubPrograms, repositoryToProgram } from "../src/discovery/github.js";
import { GitHubDiscoverySeedSchema } from "../src/core/schemas.js";

const seed = GitHubDiscoverySeedSchema.parse({
  id: "seed",
  name: "Seed",
  query: "topic:security",
  maxResults: 1
});

const repository = {
  full_name: "example/project",
  html_url: "https://github.com/example/project",
  description: "Example project",
  archived: false,
  disabled: false,
  fork: false,
  stargazers_count: 1234,
  pushed_at: "2026-05-14T00:00:00Z",
  topics: ["security"]
};

describe("GitHub discovery", () => {
  it("creates candidate programs that are not actionable without explicit scope", () => {
    const program = repositoryToProgram(seed, repository);

    expect(program.authorization).toBe("ambiguous");
    expect(program.targets[0].inScope).toBe(false);
    expect(program.notes).toContain("Discovery is not authorization");
  });

  it("uses official scope metadata when provided by the seed", () => {
    const scopedSeed = GitHubDiscoverySeedSchema.parse({
      id: "scoped",
      name: "Scoped",
      query: "repo:example/project",
      scopeUrl: "https://example.com/security/scope",
      disclosureUrl: "https://example.com/security",
      paid: true
    });

    const program = repositoryToProgram(scopedSeed, repository);

    expect(program.authorization).toBe("explicit");
    expect(program.targets[0].inScope).toBe(true);
    expect(program.scopeUrl).toBe("https://example.com/security/scope");
  });

  it("queries GitHub through an injectable fetch implementation", async () => {
    const programs = await discoverGitHubPrograms([seed], {
      fetchImpl: async (url) => {
        expect(url).toContain("api.github.com/search/repositories");
        expect(url).toContain("archived%3Afalse");

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            items: [
              repository,
              { ...repository, full_name: "example/old", archived: true }
            ]
          })
        };
      }
    });

    expect(programs).toHaveLength(1);
    expect(programs[0].repoUrls).toEqual(["https://github.com/example/project"]);
  });
});
