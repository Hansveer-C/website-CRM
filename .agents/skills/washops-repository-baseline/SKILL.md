---
name: washops-repository-baseline
description: Verifies repository identity, remote origin, clean worktree, and branch HEAD against origin/main before executing any work.
---

# WashOps Repository Baseline

## Purpose
Verifies and establishes a clean, verified Git repository baseline before executing any task or modifying any files in the WashOps CRM workspace. Ensures the repository identity is correct, the remote matches canonical origin, and the working tree has no uncommitted or unexpected changes.

## Triggers
- At the start of any development, audit, or documentation task.
- Prior to creating a new branch or switching branches.
- Prior to applying any file modifications.
- When entering the workspace to verify repository health.

## Required Inputs
- Expected canonical repository identifier (`Hansveer-C/website-CRM`).
- Task header or prompt identifying the project as `WASHOPS CRM`.
- Target base reference (default: freshly fetched `origin/main`).

## Procedure
1. **Routing Guard Check**:
   - Inspect task title/prompt to verify project identity is `WASHOPS CRM`.
   - If missing or identifying as another project, stop immediately per `AGENTS.md`.

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

4. **Verify Worktree Cleanliness**:
   - Verify `git status --porcelain` produces no output (clean working tree).
   - Ensure there are no untracked files or uncommitted modifications.

5. **Inspect Repository Governance and Core Configuration**:
   Inspect the following files to confirm structural integrity:
   - `AGENTS.md`
   - `.agents/`
   - `.agents/skills/`
   - `agents_skills/`
   - `.github/workflows/`
   - `package.json`

6. **Branch Setup**:
   - Branch from fresh `origin/main` rather than stale local branches or prompt-supplied historical SHAs.
   - Use dedicated branch naming according to task convention (e.g., `codex/<task-name>`).

## Stop Conditions
STOP immediately without attempting automated repair or making any changes if:
- Project identifier is missing or task targets a different project.
- Remote origin URL does not match `Hansveer-C/website-CRM`.
- Unexpected, untracked, or uncommitted files exist in the worktree (`git status --porcelain` is not empty).
- `git fetch origin` fails or network/authentication error prevents verifying fresh `origin/main`.
- Working tree or branch state materially contradicts task prerequisites.

**Do not attempt to auto-stash, auto-commit, reset, or auto-repair unexpected state.**

## Expected Output
A structured baseline verification report containing:
- Verified repository root path.
- Verified remote URLs.
- Current active branch and current HEAD SHA.
- Fresh `origin/main` SHA.
- Working tree status (`clean` or exact porcelain output).
- Confirmation of governance file inspection.
- Explicit pass/fail status before proceeding.
