# Open Bounty Workbench

Open Bounty Workbench is a local-first workflow system for authorized security research. It helps developers track public program scope, rank open-source targets, keep evidence disciplined, and draft remediation reports or PR descriptions.

It is not an automated bounty submission tool.

## What It Does

- Tracks bug bounty or open-source security programs with explicit authorization.
- Rejects targets with ambiguous scope, missing authorization, or unsafe rules.
- Scores programs by signal quality, legal clarity, repo availability, reward potential, and validation cost.
- Produces structured evidence records for candidate findings.
- Drafts reports only from validated findings.
- Keeps human approval gates before any external action.

## What It Refuses

- Unauthorized live testing.
- Automated program enrollment.
- Automated report submission.
- Credential, payout, or PayPal handling.
- Exploit spam or speculative reports.
- Out-of-scope target interaction.

## Quick Start

```bash
npm install
npm run check
npm run triage:sample
npm run report:sample
```

## Discover Candidate Repos

Discovery finds candidate repositories; it does not authorize testing. Candidates without an official scope URL or disclosure URL are marked as ambiguous and will fail the policy gate until a human attaches authorization.

```bash
npm run discover:github:sample
```

Enrich discovered candidates with GitHub community/security-policy metadata:

```bash
npm run enrich:github:sample
```

For higher GitHub API limits, set `GITHUB_TOKEN` locally or in CI. Do not commit tokens.

## GitHub Safety Workflows

The repository includes GitHub Actions for:

- Build, tests, dependency audit, and local sensitive data scanning.
- Gitleaks scanning on pushes, pull requests, and a weekly schedule.

Run the same local guard before pushing:

```bash
npm run scan:secrets
```

## Workflow Shape

```text
Program Scout
  -> Candidate Repo Discovery
  -> Scope Verification
    -> Economic Triage
      -> Local Repo Audit Queue
        -> Candidate Finding
          -> Local Validation
            -> Human Approval
              -> Report Draft or Remediation PR
```

## Open-Source Safety

The repository includes a policy engine that blocks unsafe automation by design. Contributions that add autonomous live attacks, auto-submission, credential harvesting, payout handling, or scope bypasses should be rejected.

See [docs/policy.md](docs/policy.md) and [docs/architecture.md](docs/architecture.md).
