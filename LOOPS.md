# WashOps CRM — Bounded Decision Loops

Skills define procedure. These loops decide only whether current evidence permits a repair pass. They never authorize scope expansion, merging, deployment, production mutation, destructive work, credential use, or a security-policy exception.

## Implementation

**PASS:** focused and risk-proportionate broader checks have current evidence; the final diff is in scope; no material contract or invariant violation remains.

**REPAIR:** make at most two causally justified, in-scope repair passes after the initial implementation. Stop instead when a failure repeats without progress, a repair creates a systemic failure, or resolution requires a broader contract/architecture decision.

**HUMAN GATE:** a domain/API/architecture change, uncertainty about tenant isolation or a security boundary, production infrastructure or credentials, or destructive data/schema work.

## PR review and repair

Use `pr-review` for a normal material review. Add `adversarial-review` only for auth/authz, tenant isolation, migrations or consequential shared contracts, credentials/secrets, publication/approval authority, irreversible external actions, financial lifecycle, consequential concurrency/idempotency, or a major security boundary.

The reviewer returns evidence-backed findings and does not implement a competing fix. With explicit fix authority, allow at most two fix/re-review cycles. Stop for an unresolved high-risk finding, a material contract contradiction, or repeated disagreement. Merging remains human-gated.

## Migration / RLS

Use `washops-migration-rls-safety` with the global Supabase/Postgres guidance. PASS requires a deterministic clean local replay plus evidence that protected data fails closed, anonymous access is denied by default, cross-tenant access is blocked, and sensitive lifecycle mutations remain server-authoritative. Allow at most two local repair passes after the initial run.

Production migrations or ledger repairs, destructive DDL, RLS broadening, production backfills/data patches, and production credentials are human-gated and never part of this loop.
