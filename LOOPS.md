# WashOps CRM — Bounded Loops

This document defines the standard bounded feedback loops for WashOps CRM development. All agent and human workflows must operate within these bounded loops to prevent runaway iterations, thrashing, and scope creep.

---

## 1. Implementation Verification Loop

Used during direct feature development, bug fixes, or documentation tasks to ensure changes satisfy requirements without destabilizing the system.

### Loop Flow

```
IMPLEMENT
  │
  ▼
FOCUSED TEST
  │
  ▼
DIAGNOSE
  │
  ▼
REPAIR
  │
  ▼
RETEST
```

### Iteration Bound
- **Maximum**: Initial implementation plus **2 repair passes** (total of 3 test execution cycles).

### Success Criteria
- Focused checks and unit tests for the specific change pass cleanly.
- Required relevant broader checks (integration, build, or typecheck gates) pass.
- No unresolved material contract violations or regressions.

### Plateau Conditions (Stop Immediately)
- The same failure recurs twice across iterations without progress.
- A repair pass introduces an equivalent or new systemic failure in previously working code.
- Resolving the failure requires expanding scope or changing established contracts beyond the assigned task.

### Human Escalation Triggers
- Any required change to a domain, API, or architectural contract.
- Uncertainty regarding security boundaries or tenant isolation.
- Any operation touching production infrastructure or credentials.
- Any destructive data or schema modification.

---

## 2. Independent PR Review Loop

Used for code review and adversarial inspection prior to merging PRs into canonical branches.

### Loop Flow

```
PR CREATED / UPDATED
  │
  ▼
INDEPENDENT ADVERSARIAL REVIEW
  │
  ▼
VALIDATE FINDINGS (Evidence Gathering)
  │
  ▼
OWNER FIXES (Author Lane)
  │
  ▼
INDEPENDENT RE-REVIEW
```

### Iteration Bound
- **Maximum**: **2 fix/re-review cycles** between reviewer and author.

### Reviewer Boundary
- The reviewer returns structured findings to the author/owner lane.
- The reviewer must **not** independently implement a competing fix unless explicitly reassigned by a human lead.

### Escalation Triggers
- Fundamental architectural disagreement between author and reviewer.
- Unresolved high-risk or critical security finding.
- Ambiguity or contradiction in canonical contracts or specifications.
- Repeated review/fix disagreement after 2 full review cycles.

---

## 3. Migration / RLS Safety Loop

Used for all database schema changes, migrations, and Row-Level Security (RLS) policy definitions.

### Loop Flow

```
MIGRATION CREATED
  │
  ▼
CLEAN LOCAL REPLAY (from baseline / zero state)
  │
  ▼
RLS / TENANT-ISOLATION VALIDATION
  │
  ▼
REPAIR
  │
  ▼
REPLAY / RETEST
```

### Iteration Bound
- **Maximum**: Initial migration plus **2 repair passes** during local validation.

### Verification Requirements
- Clean, deterministic local migration replay without manual intervention.
- Automated or scripted validation of tenant isolation:
  - Default fail-closed policy.
  - Anonymous access denied.
  - Cross-tenant data access prevented.
  - Server-authoritative mutation boundaries enforced.

### Always Human-Gated Operations (Strict Prohibition on Autonomous Execution)
- Production database migration execution.
- Production migration-ledger repairs or overrides.
- Destructive DDL operations (e.g., dropping tables, columns, or constraints).
- RLS policy broadening or loosening access restrictions.
- Production data backfills, mutations, or manual data patches.
