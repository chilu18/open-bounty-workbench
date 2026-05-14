import type { GitHubDiscoverySeed, Program } from "../core/schemas.js";

type GitHubSearchRepository = {
  full_name: string;
  html_url: string;
  description: string | null;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  stargazers_count: number;
  pushed_at: string;
  topics?: string[];
};

type GitHubSearchResponse = {
  items: GitHubSearchRepository[];
};

export type FetchLike = (url: string, init?: {
  headers?: Record<string, string>;
}) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

export function seedAuthorization(seed: GitHubDiscoverySeed): Program["authorization"] {
  return seed.scopeUrl || seed.disclosureUrl ? "explicit" : "ambiguous";
}

export function repositoryToProgram(seed: GitHubDiscoverySeed, repository: GitHubSearchRepository): Program {
  const authorization = seedAuthorization(seed);
  const programUrl = seed.programUrl ?? repository.html_url;
  const targetNotes = [
    repository.description ?? "",
    `stars=${repository.stargazers_count}`,
    `pushed_at=${repository.pushed_at}`,
    repository.topics?.length ? `topics=${repository.topics.join(",")}` : ""
  ].filter(Boolean).join("; ");

  return {
    id: `${seed.id}-${repository.full_name.toLowerCase().replaceAll("/", "-")}`,
    name: `${seed.name}: ${repository.full_name}`,
    platform: seed.platform,
    programUrl,
    scopeUrl: seed.scopeUrl,
    disclosureUrl: seed.disclosureUrl,
    paid: seed.paid,
    authorization,
    safeHarbor: seed.safeHarbor,
    allowsLocalTesting: seed.allowsLocalTesting,
    allowsLiveTesting: seed.allowsLiveTesting,
    requiresEnrollment: seed.requiresEnrollment,
    repoUrls: [repository.html_url],
    targets: [
      {
        type: "repo",
        identifier: repository.html_url,
        inScope: authorization === "explicit",
        notes: authorization === "explicit"
          ? targetNotes
          : `candidate only; attach official scope before analysis; ${targetNotes}`
      }
    ],
    outOfScope: seed.outOfScope,
    notes: [
      seed.notes,
      "Discovered by GitHub repository search. Discovery is not authorization."
    ].filter(Boolean).join(" ")
  };
}

export async function discoverGitHubPrograms(
  seeds: GitHubDiscoverySeed[],
  options: {
    fetchImpl?: FetchLike;
    token?: string;
  } = {}
): Promise<Program[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const programs: Program[] = [];

  for (const seed of seeds) {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", `${seed.query} archived:false fork:false`);
    url.searchParams.set("sort", "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(seed.maxResults));

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "User-Agent": "open-bounty-workbench"
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`GitHub search failed for seed "${seed.id}": ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as GitHubSearchResponse;
    const repositories = payload.items.filter((repository) =>
      !repository.archived && !repository.disabled && !repository.fork
    );

    programs.push(...repositories.map((repository) => repositoryToProgram(seed, repository)));
  }

  return programs;
}
