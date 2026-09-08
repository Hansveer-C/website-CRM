---
name: washops-repository-baseline
description: Verifies repository identity, remote origin, clean worktree, and branch HEAD against origin/main before executing work, with differentiated rules for modifying tasks vs read-only audits.
---

# WashOps Repository Baseline

## Purpose
Verifies and establishes a verified Git repository baseline before executing any task or modifying any files in the WashOps CRM workspace. Ensures the repository identity is canonical, the remote matches origin, and the working tree state is appropriately evaluated based on task execution mode (modifying vs. read-only audit).

## Triggers
- At the start of any development, audit, or documentation task.
- Prior to creating a new branch or switching branches.
- Prior to applying any file modifications.
- When entering the workspace to verify repository health.

## Required Inputs
- Expected canonical repository identifier (`Hansveer-C/website-CRM`).
- Task header or prompt identifying the primary target project as `WASHOPS CRM`.
- Execution mode: **Modifying** (code, schema, docs, config) vs. **Read-Only Audit** (evidence inspection, analysis).
- Target base reference (default: freshly fetched `origin/main`).

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

4. **Evaluate Worktree Cleanliness by Execution Mode**:
   - **For Modifying Tasks**:
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

6. **Branch Setup (Modifying Tasks)**:
   - Branch from fresh `origin/main` rather than stale local branches or prompt-supplied historical SHAs.
   - Use dedicated branch naming according to task convention (e.g., `codex/<task-name>`).

## Stop Conditions
STOP immediately without attempting automated repair or making changes if:
- Primary project identifier is missing or task targets a different project.
- Remote origin URL does not match `Hansveer-C/website-CRM`.
- For modifying tasks: unexpected, untracked, or uncommitted files exist in the worktree (`git status --porcelain` is not empty).
- For read-only audits: dirty worktree state prevents reliable attribution or makes audit findings ambiguous.
- `git fetch origin` fails or network/authentication error prevents verifying fresh `origin/main`.
- Working tree or branch state materially contradicts task prerequisites.

**Do not attempt to auto-stash, auto-commit, reset, clean, or auto-repair unexpected state.**

## Expected Output
A structured baseline verification report containing:
- Verified repository root path.
- Verified remote URLs.
- Current active branch and current HEAD SHA.
- Fresh `origin/main` SHA.
- Execution mode (Modifying vs. Read-Only Audit).
- Working tree status (`clean` or exact porcelain output with origin/main vs HEAD vs local diff breakdown).
- Confirmation of governance file inspection.
- Explicit pass/fail status before proceeding.
