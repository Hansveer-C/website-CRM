---
name: washops-bounded-implementation
description: Executes a bounded code, test, or documentation change to WashOps CRM within strict scope, invariant, and contract limits.
---

# WashOps Bounded Implementation

## Purpose
Executes a tightly scoped, bounded change to the WashOps CRM repository while strictly preserving architectural invariants, domain contracts, and file boundaries. Ensures changes are verified incrementally using focused tests followed by integration checks.

## Triggers
- Direct implementation of an approved feature, fix, test, or documentation update.
- Progression from an approved task or plan into code changes.

## Required Inputs
- **Objective**: Concise statement of the change and its expected behavior.
- **Scope**: Explicit list of targeted functional areas or behaviors.
- **Non-Goals**: Explicit list of items out of scope for this execution slice.
- **Relevant Contract**: Applicable API types, database schemas, or architectural invariants.
- **Allowed Files**: Specific paths or directory patterns permitted to be created or modified.
- **Required Checks**: Targeted test commands, typecheck commands, or lint commands.

## Procedure
1. **Baseline Confirmation**:
   - Confirm baseline using `washops-repository-baseline` skill before any modification.
   - Verify active branch is the designated task branch.

2. **Pre-Change Inspection**:
   - Inspect existing implementation files, affected types, and related tests before making edits.
   - Verify contracts, imports, and architectural invariants relevant to the slice.

3. **Narrow Implementation**:
   - Modify only files within the explicit `Allowed Files` list.
   - Keep changes minimal and focused directly on the stated objective.
   - Preserve existing WashOps-owned contracts, comments, and structure.
   - Do not perform opportunistic refactoring or unrelated cleanup.

4. **Iterative Verification (Implementation Verification Loop)**:
   - Run focused checks first (e.g., targeted Vitest test file).
   - If failures occur: diagnose root cause, apply targeted repair, and re-test.
   - Limit: Maximum 2 repair passes after initial run.
   - Stop if plateau criteria are reached (recurring failure or systemic breakage).

5. **Integration Gate Verification**:
   - Run required broader checks (e.g., `npm run typecheck:app`, `npm run typecheck:api`, or relevant integration suites).
   - Confirm no regressions were introduced.

6. **Diff and Worktree Inspection**:
   - Run `git diff --check` to verify no whitespace errors or merge artifacts exist.
   - Run `git status --porcelain` and `git diff` to verify strictly that:
     - No files outside `Allowed Files` were touched.
     - No unintended changes, debug logs, or temporary artifacts remain.

## Stop Conditions
STOP immediately and escalate if:
- Scope, architectural intent, or security boundaries are ambiguous.
- Resolving an issue requires modifying files outside the declared `Allowed Files`.
- The verification loop reaches a plateau (same failure twice, or cascading failures).
- An unexpected regression occurs in an unrelated part of the repository.
- Changes require altering a shared contract owned by another lane or changing production infrastructure.

## Expected Output
A bounded implementation summary including:
- Summary of changes implemented against the stated objective.
- Exact list of modified, added, or deleted files.
- Commands executed and their actual exit status/output (no assumed results).
- Confirmation of clean `git diff --check` and diff inspection.
- Remaining follow-up items or handoff requirements.
