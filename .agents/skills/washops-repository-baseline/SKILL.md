---
name: washops-repository-baseline
description: Verifies repository identity, remote origin, clean worktree, and branch HEAD against origin/main or authorized branch before executing work, distinguishing new tasks, branch continuations, and read-only audits.
---

# WashOps Repository Baseline

## Purpose
Verifies and establishes an authenticated Git repository baseline before executing work in the WashOps CRM workspace. Distinguishes three explicit execution contexts:
1. **New implementation task**: Starts from an approved fresh base (normally `origin/main`) on a dedicated task branch.
2. **Continuation / repair / review-fix task**: Continues on an explicitly authorized existing branch or PR without branching anew, rebasing, or resetting history.
3. **Read-only audit**: Verifies repository state and inspects evidence strictly without branch creation, file modification, or system mutation.

## Triggers
- At the start of any development, audit, repair, or documentation task.
- Prior to creating a new branch or resuming work on an existing task branch.
- Prior to applying any file modifications.
- When entering the workspace to verify repository health.

## Required Inputs
- **Repository Identifier**: Canonical repository (`Hansveer-C/website-CRM`).
- **Task Identity**: Task header or prompt identifying the primary target project as `WASHOPS CRM`.
- **Task Execution Context**:
  - **New Implementation Task**: Requires approved fresh base reference (default: freshly fetched `origin/main`) and designated branch name (e.g., `codex/<task-name>`).
  - **Continuation / Repair / Review-Fix Task**: Requires explicitly authorized existing branch name (e.g., `codex/<branch-name>`), target PR reference/number if applicable, and target base branch reference (e.g., `main`).
  - **Read-Only Audit**: Requires target reference to inspect (`origin/main`, current `HEAD`, or specific commit). No new branch name.

## Procedure
1. **Routing Guard Check**:
   - Inspect task title/prompt to verify the primary target project is `WASHOPS CRM`.
   - If missing or targeting another project, stop immediately per `AGENTS.md`. Non-triggering mentions, comparisons, or contamination checks do not trigger a stop.

2. **Execute Baseline Git Inspection**:
   Run the following baseline commands:
   ```bash
   git rev-parse --show-toplevel
   git remote -v
   git fetch origin
   git branch --show-current
   git rev-parse HEAD
   git rev-parse origin/main
   git status --porcelain
   ```

3. **Verify Repository Identity**:
   - Confirm repository root is the expected local workspace.
   - Confirm `origin` remote URL points strictly to `Hansveer-C/website-CRM`.

4. **Evaluate Worktree Cleanliness by Task Context**:
   - **For New Implementation Tasks & Continuation / Repair / Review-Fix Tasks**:
     - Verify `git status --porcelain` produces no output (clean working tree).
     - Ensure there are no untracked files or uncommitted modifications.
     - Any unexpected modification or untracked file is an immediate STOP condition.
   - **For Read-Only Audits**:
     - Inspect and report the exact working tree state via `git status --porcelain`.
     - Explicitly distinguish between:
       1. Fresh `origin/main`;
       2. Current branch `HEAD`;
       3. Local uncommitted working-tree differences.
     - Continue with the audit only if the inspection can proceed safely without mutating files or confusing local uncommitted edits with committed baseline state.
     - Stop if the dirty worktree prevents reliable attribution or introduces ambiguity into the audit.

5. **Inspect Repository Governance and Core Configuration**:
   Inspect the following files to confirm structural integrity:
   - `AGENTS.md`
   - `.agents/`
   - `.agents/skills/`
   - `agents_skills/`
   - `.github/workflows/`
   - `package.json`

6. **Branch & Working Context Setup by Execution Context**:
   - **A. New Implementation Task**:
     - Start from the explicitly approved fresh base, normally `origin/main`.
     - Create a dedicated task branch (`git checkout -b codex/<task-name> origin/main`).
     - Do not start from stale local branches or prompt-supplied historical SHAs.
   - **B. Continuation / Repair / Review-Fix of an Existing Branch or PR**:
     - Do NOT create a new branch merely because `origin/main` has moved.
     - Verify the explicitly named branch/PR (confirm `git branch --show-current` matches the authorized branch).
     - Verify its current `HEAD`, target/base branch, merge/rebase status relative to target base, and worktree cleanliness.
     - Verify that local branch `HEAD` matches the current remote PR head before applying fixes.
     - Continue on that existing branch when the task explicitly authorizes it.
     - **Do not silently rebase, merge origin/main, reset, or rewrite history.**
     - If the branch is unexpectedly stale or incompatible with its base, report and stop when resolving that state requires an integration decision.
   - **C. Read-Only Audit**:
     - Do NOT create or switch branches.
     - Perform all audit operations on the verified reference in strict read-only mode.

## Stop Conditions
STOP immediately without attempting automated repair or making changes if:
- Primary project identifier is missing or task targets a different project.
- Remote origin URL does not match `Hansveer-C/website-CRM`.
- `git fetch origin` fails or network/authentication error prevents verifying fresh `origin/main`.
- For modifying tasks (New Implementation or Continuation/Repair): unexpected, untracked, or uncommitted files exist in the worktree (`git status --porcelain` is not empty).
- For Continuation / Repair tasks:
  - Current branch does not match the authorized existing branch.
  - Local branch `HEAD` does not match the remote PR head.
  - Resolving branch staleness or merge incompatibility requires an unapproved integration decision or silent rebase/reset/merge.
- For Read-Only Audits: dirty worktree state prevents reliable attribution or makes audit findings ambiguous.
- Working tree or branch state materially contradicts task prerequisites.

**Do not attempt to auto-stash, auto-commit, reset, clean, rebase, or auto-repair unexpected state.**

## Expected Output
A structured baseline verification report containing:
- Verified repository root path.
- Verified remote URLs.
- Execution context (New Implementation vs. Continuation/Repair vs. Read-Only Audit).
- Current active branch and current HEAD SHA.
- Fresh `origin/main` SHA.
- For Continuation/Repair: authorized existing branch/PR reference, PR head SHA match verification, and integration/staleness assessment.
- For New Implementation: created dedicated task branch and base commit SHA.
- Working tree status (`clean` or exact porcelain output with origin/main vs HEAD vs local diff breakdown).
- Confirmation of governance file inspection.
- Explicit pass/fail status before proceeding.
