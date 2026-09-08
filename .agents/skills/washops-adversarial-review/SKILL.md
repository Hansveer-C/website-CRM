---
name: washops-adversarial-review
description: Conducts an independent, adversarial review of PR diffs against WashOps architectural invariants and contracts.
---

# WashOps Adversarial Review

## Purpose
Conducts an independent, rigorous, adversarial evaluation of proposed pull requests or branch diffs in WashOps CRM. Detects architectural drift, security vulnerabilities, concurrency bugs, tenant leaks, failure handling gaps, and regressions before code merges into canonical branches.

## Triggers
- A pull request is opened or updated and ready for code review.
- An implementation slice completes and requests independent verification.
- Pre-merge validation gate for security- or architecture-sensitive changes.

## Required Inputs
- Pull request reference or target branch diff against base (e.g., `origin/main...HEAD`).
- Stated task objective, design specification, and relevant domain contracts.
- List of modified and protected files.

## Procedure
1. **Pre-Review Contract Inspection**:
   - Inspect the intended task requirements, domain contracts, and acceptance criteria before examining code changes.
   - Review relevant WashOps architectural invariants from `AGENTS.md`.

2. **Diff Inspection & Validation**:
   - Inspect the exact git diff against base (`git diff origin/main...HEAD`).
   - Confirm that changes are strictly bounded to allowed files.

3. **Invariants & Safety Checklist**:
   Evaluate the diff rigorously against key WashOps dimensions:
   - **Tenant Isolation & Auth**: Does tenant authorization derive from verified server identity? Are browser-supplied user IDs rejected? Do RLS and route checks fail closed?
   - **Persistence & Concurrency**: Are optimistic concurrency controls in place where stale writes could overwrite valid data? Is silent last-write-wins data corruption prevented?
   - **Failure & State Handling**: Are loading, error, empty, and conflict states explicitly rendered and handled?
   - **Migration Compatibility**: Are database changes backwards-compatible, idempotent, and non-destructive?
   - **Security & Integrity**: Are inputs validated server-side? Are external dependencies vetted for license, provenance, and security?
   - **Responsiveness & Accessibility**: Are layout responsiveness and accessibility standards respected?
   - **Test Completeness**: Are tests meaningful, deterministic, and executed against both happy and error paths?

4. **Hypothesis Validation**:
   - Before presenting a suspected issue as fact, validate the hypothesis (e.g., by tracing the code path, reproducing with a test, or verifying against existing schemas).
   - Distinguish verified defects from theoretical suggestions.

5. **Severity Classification**:
   Classify all findings into standard severity levels:
   - `CRITICAL`: Security boundary breach, tenant leakage, data corruption, or authentication bypass. Requires immediate stop.
   - `HIGH`: Major functional bug, unhandled error state, concurrency collision risk, or breaking contract violation.
   - `MEDIUM`: Incomplete test coverage, subtle edge-case failure, accessibility issue, or minor invariant drift.
   - `LOW / NIT`: Code cleanliness, minor documentation inconsistency, or non-blocking suggestion.

6. **Feedback Loop Routing**:
   - Return structured findings to the author/owner lane for resolution.
   - **Do not independently implement a competing fix or overwrite author commits** unless explicitly reassigned.
   - Limit review cycles to maximum 2 fix/re-review passes per the Independent PR Review Loop.

## Stop Conditions
STOP and escalate immediately if:
- A CRITICAL security, authentication, or tenant-isolation violation is confirmed.
- Author and reviewer reach an impasse on architectural or contract interpretation.
- Reviewer is asked to self-approve security-sensitive or production-bound changes.
- Review loop reaches 2 cycles without convergence.

## Expected Output
A structured adversarial review report containing:
- **Review Summary**: Overall assessment and verdict (`APPROVE`, `REQUEST_CHANGES`, or `ESCALATE`).
- **Checklist Assessment**: Status of tenant isolation, persistence, concurrency, failure handling, security, and tests.
- **Findings Table**:
  - `Severity` (Critical / High / Medium / Low)
  - `Location` (`file:line`)
  - `Description`
  - `Evidence / Repro`
- **Required Remediation**: Explicit, actionable fixes requested from the author lane.
