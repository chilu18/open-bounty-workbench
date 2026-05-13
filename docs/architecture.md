# Architecture

Open Bounty Workbench is split into small packages under `src`.

## Modules

- `core`: schemas, scoring, evidence models, and deterministic business logic.
- `policy`: safety gates and refusal decisions.
- `workflows`: WDK-compatible workflow stubs.
- `cli`: local command line entrypoint.

## MVP Data Flow

1. Load program records from JSON.
2. Verify scope and policy.
3. Score each program.
4. Rank by recommendation score.
5. Store candidate finding evidence.
6. Draft report only when validation status allows it.

## Vercel Workflow Mapping

The workflow files are written as ordinary async functions with `"use workflow"` and `"use step"` directives in the relevant functions. They can run as plain TypeScript for local tests, then be wired into WDK/Vercel as the hosted runtime.

## Persistence

The MVP is file-based for open-source portability. A hosted version can replace this with Vercel Postgres, Supabase, or another database without changing the core policy/scoring logic.
