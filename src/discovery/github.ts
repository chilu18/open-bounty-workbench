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

type GitHubCommunityProfile = {
  files?: {
    license?: {
      html_url?: string;
    } | null;
    readme?: {
      html_url?: string;
    } | null;
  };
};

type GitHubContentFile = {
  html_url?: string;
  content?: string;
  encoding?: string;
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

function githubRepoPath(repoUrl: string): string | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") {
      return null;
    }

    const [owner, repo] = url.pathname.replace(/^\/|\/$/g, "").split("/");
    if (!owner || !repo) {
      return null;
    }

    return `${owner}/${repo.replace(/\.git$/, "")}`;
  }
  catch {
    return null;
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "open-bounty-workbench"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function decodeGitHubContent(file: GitHubContentFile): string {
  if (!file.content || file.encoding !== "base64") {
    return "";
  }

  return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function hasDisclosureSignal(securityPolicyText: string): boolean {
  return /\b(report (a )?vulnerability|security policy|responsible disclosure|coordinated disclosure|bug bounty|hackerone|bugcrowd|intigriti)\b/i
    .test(securityPolicyText);
}

function hasPaidBountySignal(securityPolicyText: string): boolean {
  return /\b(bug bounty|bounty|hackerone|bugcrowd|intigriti|yeswehack)\b/i.test(securityPolicyText);
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

    const response = await fetchImpl(url.toString(), { headers: githubHeaders(options.token) });
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

export async function enrichGitHubPrograms(
  programs: Program[],
  options: {
    fetchImpl?: FetchLike;
    token?: string;
  } = {}
): Promise<Program[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const enriched: Program[] = [];

  for (const program of programs) {
    const repoUrl = program.repoUrls.find((candidate) => candidate.includes("github.com/"));
    const repoPath = repoUrl ? githubRepoPath(repoUrl) : null;

    if (!repoPath) {
      enriched.push(program);
      continue;
    }

    const communityUrl = `https://api.github.com/repos/${repoPath}/community/profile`;
    const securityUrl = `https://api.github.com/repos/${repoPath}/contents/SECURITY.md`;

    const [communityResponse, securityResponse] = await Promise.all([
      fetchImpl(communityUrl, { headers: githubHeaders(options.token) }),
      fetchImpl(securityUrl, { headers: githubHeaders(options.token) })
    ]);

    const notes = [program.notes];
    let nextProgram = { ...program };
    let securityPolicyText = "";
    let securityPolicyHtmlUrl: string | undefined;

    if (communityResponse.ok) {
      const community = await communityResponse.json() as GitHubCommunityProfile;
      if (community.files?.license?.html_url) {
        notes.push(`license=${community.files.license.html_url}`);
      }
      if (community.files?.readme?.html_url) {
        notes.push(`readme=${community.files.readme.html_url}`);
      }
    }

    if (securityResponse.ok) {
      const securityPolicy = await securityResponse.json() as GitHubContentFile;
      securityPolicyText = decodeGitHubContent(securityPolicy);
      securityPolicyHtmlUrl = securityPolicy.html_url;
      notes.push(`security_policy=${securityPolicyHtmlUrl ?? securityUrl}`);
    }

    if (securityPolicyText && hasDisclosureSignal(securityPolicyText)) {
      nextProgram = {
        ...nextProgram,
        disclosureUrl: nextProgram.disclosureUrl ?? securityPolicyHtmlUrl,
        authorization: nextProgram.authorization === "none" ? "ambiguous" : "explicit",
        safeHarbor: nextProgram.safeHarbor === "unknown" ? "partial" : nextProgram.safeHarbor,
        paid: nextProgram.paid || hasPaidBountySignal(securityPolicyText),
        targets: nextProgram.targets.map((target) => target.type === "repo"
          ? {
              ...target,
              inScope: true,
              notes: `${target.notes} enriched_by=github_security_policy`
            }
          : target)
      };
    }
    else if (securityPolicyHtmlUrl) {
      notes.push("security policy found, but disclosure authorization language was not strong enough to promote scope");
    }
    else {
      notes.push("no SECURITY.md discovered by GitHub contents API");
    }

    enriched.push({
      ...nextProgram,
      notes: notes.filter(Boolean).join(" ")
    });
  }

  return enriched;
}
