---
name: washops-parallel-handoff
description: Generates a compact, structured handoff between agents, lanes, or human leads without conversational bloat.
---

# WashOps Parallel Handoff

## Purpose
Produces a concise, highly structured handoff document for transitioning tasks between concurrent agents, subagents, review lanes, or human engineers in the WashOps CRM repository. Prevents context degradation, eliminates conversational noise, and enforces explicit artifact and file ownership.

## Triggers
- Completion of an implementation slice ready for review or integration.
- Escalation to a human lead due to architectural, security, or plateau stop conditions.
- Handing off a task to an independent reviewer (Adversarial Review Loop).
- Transitioning between development phases or distinct work lanes.

## Required Inputs
- Canonical repository name (`Hansveer-C/website-CRM`).
- Base commit SHA and current branch/HEAD SHA.
- Clear objective and exact completed scope.
- Declared protected files (modified by this lane) and shared files.
- Migration and domain/API contract ownership designations (if applicable).
- Executed check commands and their factual results.
- Unresolved issues, known risks, and blockers.
- Target role or requested next action.

## Procedure
1. **Compile Baseline Identity**:
   - Record exact canonical repository: `Hansveer-C/website-CRM`.
   - Record verified base commit SHA and current task branch / HEAD SHA.

2. **Define Scope and Boundaries**:
   - Document stated task objective.
   - List exact completed scope and explicit non-goals.
   - List protected files (files created or edited in this slice).
   - List shared files (interfaces, configs, or contracts touched or depended on).

3. **Establish Single Ownership**:
   - Designate migration owner if database migrations were created or touched.
   - Designate domain/API contract owner if shared types, schemas, or endpoints were modified.

4. **Summarize Factual Verification**:
   - List specific validation commands executed (e.g., test suites, typechecks, diff checks).
   - Report exact exit status and output. Never report assumed or unexecuted checks.

5. **Highlight Unresolved Items & Blockers**:
   - Document unresolved questions, open risks, or known limitations.
   - List any blocking dependencies on other lanes or external decisions.

6. **Specify Target Action**:
   - Explicitly request the next role (e.g., Adversarial Reviewer, Integrator, Human Lead).
   - Specify the exact action required from the next recipient.

7. **Prohibit Conversation Dumping**:
   - **Do not copy raw chat transcripts, conversation history, or LLM dialogues into the handoff.**
   - All context must be distilled strictly into the structured handoff fields.

## Stop Conditions
STOP and resolve before handing off if:
- Baseline SHAs or repository identity cannot be verified.
- Protected files collide with an uncoordinated concurrent branch without an agreement.
- Verification checks failed or were not run, yet the handoff claims completion.
- Chat logs are pasted without structured synthesis.

## Expected Output
A standardized compact handoff using this exact structure:

```markdown
### WashOps Task Handoff

- **Repository**: Hansveer-C/website-CRM
- **Verified Base SHA**: <full base sha>
- **Branch / HEAD SHA**: <branch-name> / <full head sha>
- **Objective**: <concise 1-2 sentence goal>
- **Exact Scope**: <summary of specific changes made>
- **Protected Files**:
  - <path/to/file1>
  - <path/to/file2>
- **Shared Files**:
  - <path/to/shared1>
- **Migration Owner**: <lane or N/A>
- **Domain/API Contract Owner**: <lane or N/A>
- **Work Completed**:
  - <bullet point summary of finished items>
- **Checks Actually Run & Results**:
  - `<command 1>`: PASS (<brief note>)
  - `<command 2>`: PASS (<brief note>)
- **Unresolved Findings**: <none or specific findings>
- **Dependencies / Blockers**: <none or specific blockers>
- **Requested Next Role / Action**: <e.g., Adversarial Reviewer: execute review loop>
```
