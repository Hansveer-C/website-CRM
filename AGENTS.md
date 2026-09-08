# WashOps CRM — Repository Instructions

This repository is exclusively for the **WASHOPS CRM** project.

## Mandatory project routing guard

Before executing any task, determine the primary/target project from the task heading or prompt.

### Allowed

Execute work only when the primary target of the task is:

**WASHOPS CRM**

### Wrong project

If the primary target of the task is:

- **HansSays Content Engine**
- **LedeIQ**

stop immediately.

Do not:

- inspect implementation files for that task;
- edit files;
- run implementation commands;
- create commits;
- create or modify pull requests;
- mutate databases;
- deploy anything.

Respond only:

`WRONG PROJECT — THIS CODEX WORKSPACE IS WASHOPS CRM ONLY. NO ACTION TAKEN.`

### Non-triggering mentions and comparative audits

Mere mention of **HansSays** or **LedeIQ** inside a **WashOps CRM** task does **not** trigger the wrong-project guard. Valid examples include:

- WashOps contamination filters and negative checks (e.g., "Ensure no LedeIQ code was imported");
- explicit WashOps-vs-other-project architectural or workflow comparisons;
- audits of possible cross-project contamination;
- research regarding transferable workflow patterns or agent governance methods.

For an explicitly requested comparison or audit involving another project:

- external project evidence may be inspected only for that bounded comparison/audit purpose;
- no foreign project implementation state, SHAs, migrations, roadmap status, domain architecture, task numbering, or requirements may become WashOps state unless separately and explicitly approved.

### Missing identifier

If a task does not clearly identify its primary target project as **WASHOPS CRM**, do not execute it.

Respond only:

`PROJECT IDENTIFIER REQUIRED — THIS WORKSPACE ONLY ACCEPTS WASHOPS CRM TASKS.`

## Isolation rule

Never transfer or infer code, migrations, architecture, branch names, pull requests, database state, requirements, or assumptions from **HansSays Content Engine** or **LedeIQ** into this repository.

Similar technologies or naming do not imply shared project context.

## Canonical repository

`Hansveer-C/website-CRM`

## Scope precedence

These routing rules are repository-level safety instructions and apply before implementation, audit, migration, testing, deployment, or release work.

## Operational principles

1. **Verified repository behavior outranks planning and history**: Current working code, schema, and tests in the repository take precedence over historical notes, outdated documentation, or external planning documents.
2. **Inspect before modifying**: Always inspect relevant repository files, existing contracts, and automated tests before making changes.
3. **Stop on unexpected state**: If repository state, git status, schema, or test behavior contradicts expectations or prerequisites, stop immediately without attempting automated repair.
4. **No invented results**: Report only verified test and audit results that were actually executed. Never fabricate, extrapolate, or assume test or audit outcomes.
5. **No unrelated cleanup**: Keep changes bounded strictly to the assigned scope. Do not perform unrelated refactoring, unsolicited cleanup, or opportunistic reformatting.

## WashOps architectural invariants

1. **Server authority for lifecycle mutations**: Important domain lifecycle transitions (including status changes, financial records, and irreversible actions) must execute through server-authoritative logic rather than unvalidated client calls.
2. **Tenant authorization from authenticated server identity**: Tenant authorization must always derive directly from trusted authenticated database or server identity (such as `auth.uid()`, verified JWT claims, server-resolved tenant membership, or approved server contracts). Never trust browser-supplied user IDs, tenant IDs, or business IDs for authorization. Service-role usage is an infrastructure capability, not the default domain authorization model; privileged code must still validate actor and tenant context before lifecycle mutations.
3. **RLS and ownership boundaries fail closed**: Row-Level Security policies, ownership checks, and API endpoints must deny access by default when authentication or tenant context is absent or invalid. Protected tenant data denies anonymous access by default. Intentional public surfaces (such as published Builder runtime or public intake/lead submission) must be narrowly scoped to canonical contracts, expose only the minimal necessary data, and be tested adversarially.
4. **Optimistic concurrency for stale-write protection**: Use optimistic concurrency controls (such as version columns or updated timestamps) wherever stale overwrites would cause data loss.
5. **Explicit loading, error, and conflict states**: User interfaces and API consumers must handle loading, errors, and concurrency conflicts explicitly. Silent last-write-wins data corruption is prohibited.
6. **No parallel systems without approval**: Do not introduce parallel authentication, persistence, or duplicate domain architectures without explicit architectural approval.
7. **Progressive migration over broad rewrites**: Prefer incremental, backwards-compatible, step-by-step migrations over broad, risky rewrites.
8. **Responsive behavior and accessibility**: Responsive layout and accessibility standards are functional correctness requirements, not optional polish.
9. **Builder draft/live separation**: The site/page builder must maintain clear separation between draft and live states. Publication is an explicit action.
10. **Builder publication safety**: A failed builder publication must leave the existing live state intact without corruption or partial publication.
11. **Builder public runtime isolation**: Public-facing builder runtimes resolve and serve published state only, never uncommitted draft data.
12. **Conversation ownership**: Communication and conversation features remain WashOps-owned contracts.
13. **Controlled AI actions**: AI agents or automated tools may act only through defined, controlled WashOps contracts and server actions.
14. **External code vetting**: Any introduced third-party code or external dependency requires explicit license, provenance, and security review.
15. **Single ownership of shared artifacts**: Exactly one owner/lane per shared database migration and per shared domain/API contract at any given time.
16. **Protected and shared file declarations**: Concurrent agents and branches must explicitly declare protected and shared files in their handoff or execution bounds.
17. **Human-gated release operations**: Merging to canonical branches, production deployments, production database mutations, and security-policy exceptions are strictly human-gated.
