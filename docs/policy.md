# Policy

Open Bounty Workbench uses a deny-by-default policy model.

## Required Before Work Starts

A program must have:

- Explicit authorization.
- A scope source URL or local scope document.
- At least one in-scope target.
- Clear out-of-scope rules.
- A disclosure path.

For bounty-oriented ranking, the program should also have a payout range or public reward statement.

## Human Approval Gates

The system must require a human operator before:

- Enrolling in a program.
- Testing any live target.
- Submitting a report.
- Opening a remediation PR.
- Contacting maintainers.

## Refusal Reasons

- `scope_ambiguous`
- `unauthorized_activity`
- `insufficient_evidence`
- `opsec_risk`
- `low_signal`
- `external_action_requires_human`

## Allowed Automation

- Reading public program pages.
- Reading public open-source repositories.
- Local static analysis.
- Local lab setup.
- Evidence formatting.
- Report drafting.
- PR description drafting.

## Disallowed Automation

- Live attacks without approval.
- Credential handling.
- Payment or payout setup.
- PayPal interaction.
- Automated bounty submission.
- Spam reports.
- Severity inflation.
