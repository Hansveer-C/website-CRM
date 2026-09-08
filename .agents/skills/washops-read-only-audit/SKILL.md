---
name: washops-read-only-audit
description: Conducts an evidence-based, strictly read-only audit of WashOps CRM code, schema, tests, or architecture.
---

# WashOps Read-Only Audit

## Purpose
Executes a rigorous, evidence-backed inspection of the WashOps CRM codebase while enforcing strict non-mutation boundaries:
- Prohibits any worktree, index, project-file, database, deployment, production, or remote-system mutations.
- Safe local Git metadata refresh such as `git fetch origin` is permitted solely for evidence and baseline verification against upstream state.

Evaluates actual repository behavior against requirements, architectural invariants, or design plans while categorizing findings by epistemic certainty.

## Triggers
- Pre-implementation architectural investigation or codebase exploration.
- Security, schema, or invariant compliance audits.
- Verification of test coverage or contract consistency.
- Requests to analyze discrepancies between documentation/plans and actual code.

## Required Inputs
- **Audit Objective**: Specific questions, systems, or contracts under evaluation.
- **Audit Scope**: Specific directories, files, or subsystems to inspect.
- **Reference Baseline**: Commit SHA or branch to inspect (default: fresh `origin/main` or current HEAD).

## Procedure
1. **Enforce Strict Read-Only Boundary**:
   - **Prohibited Operations**:
     - Editing, creating, or deleting tracked or untracked project files;
     - Staging changes (`git add`, `git rm`);
     - Committing (`git commit`);
     - Pushing (`git push`);
     - Branch or ref creation/deletion (`git checkout -b`, `git branch -d`);
     - Database mutations (DDL or DML writes);
     - Configuration, secret, or deployment mutations;
     - Remote-system writes or API mutations.
   - **Permitted Safe Baseline & Evidence Operations**:
     - `git status`
     - `git diff`
     - `git log`
     - `git show`
     - `git rev-parse`
     - `git branch` (inspection only)
     - `git fetch origin` (updates local Git tracking metadata to verify against fresh `origin/main`; does not mutate worktree, index, remote repository, product state, or production environment)
   - **Dirty Worktree Handling**:
     - If the working tree contains uncommitted changes, report the exact porcelain status.
     - Continue only if the audit can be performed safely while explicitly distinguishing `origin/main`, current `HEAD`, and local diffs.
     - Stop if local modifications prevent reliable attribution or make the audit findings ambiguous.

2. **Gather Concrete Evidence**:
   - Inspect source files, schema definitions, configs, and test suites directly using read tools.
   - If verification commands are executed, run only non-destructive, read-only commands.
   - Record exact file paths, symbol names, and line numbers for every observation.

3. **Investigate Material Contradictions**:
   - Compare observed code behavior against written documentation, comments, or planning artifacts.
   - Identify discrepancies between design intent and actual implementation.
   - Trace contract flows across boundaries (e.g., client UI to API handler to database).

4. **Classify Epistemic Certainty**:
   Every statement and finding must be explicitly tagged as one of:
   - `VERIFIED`: Directly observed in inspected code, executed command output, or current schema with exact citations.
   - `INFERRED`: Logically deduced from verified facts, but not directly proven or explicitly stated in the codebase.
   - `UNKNOWN`: Cannot be confirmed without additional information, live environment inspection, or deeper investigation.

5. **Separate Findings from Recommendations**:
   - Present current observed facts first, supported by citations.
   - Present future recommendations, mitigations, or proposed fixes strictly in a separate recommendations section.
   - Never present proposed designs or future states as current-state claims.

## Stop Conditions
STOP immediately if:
- Task or environment attempts to perform file modifications, database mutations, staging, commits, pushes, or remote writes while executing an audit.
- Target files, repositories, or contracts cannot be accessed or located.
- Dirty working tree state introduces ambiguity or prevents reliable attribution of findings.
- Task targets a non-WashOps project (e.g., HansSays/LedeIQ implementation task per routing guard).

## Expected Output
A structured read-only audit report containing:
- Executive summary of findings.
- Baseline metadata (origin/main SHA, HEAD SHA, worktree state).
- Concrete evidence citations (links to files and line ranges).
- Classification of all claims as `VERIFIED`, `INFERRED`, or `UNKNOWN`.
- Identified material contradictions between specification and implementation.
- Distinct recommendations section clearly separated from current-state findings.
