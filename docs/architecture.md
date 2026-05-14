# Architecture

Open Bounty Workbench is split into small packages under `src`.

## Modules

- `core`: schemas, scoring, evidence models, and deterministic business logic.
- `discovery`: external candidate discovery and enrichment adapters that produce unactionable candidates until official authorization is attached.
- `policy`: safety gates and refusal decisions.
- `workflows`: WDK-compatible workflow stubs.
- `cli`: local command line entrypoint.

## MVP Data Flow

1. Discover or load candidate program records.
2. Enrich candidates with official repository metadata, such as security policy links.
3. Require official authorization metadata before treating a target as in scope.
4. Verify scope and policy.
5. Score each program.
6. Rank by recommendation score.
7. Store candidate finding evidence.
8. Draft report only when validation status allows it.

## Vercel Workflow Mapping

The workflow files are written as ordinary async functions with `"use workflow"` and `"use step"` directives in the relevant functions. They can run as plain TypeScript for local tests, then be wired into WDK/Vercel as the hosted runtime.

## Persistence

The MVP is file-based for open-source portability. A hosted version can replace this with Vercel Postgres, Supabase, or another database without changing the core policy/scoring logic.
