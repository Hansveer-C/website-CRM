---
name: washops-read-only-audit
description: Conducts an evidence-based, strictly read-only audit of WashOps CRM code, schema, tests, or architecture.
---

# WashOps Read-Only Audit

## Purpose
Executes a rigorous, evidence-backed inspection of the WashOps CRM codebase without modifying any files, state, or configurations. Evaluates actual repository behavior against requirements, architectural invariants, or design plans while categorizing findings by epistemic certainty.

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
1. **Enforce Read-Only Boundary**:
   - Strictly prohibit file creation, modification, deletion, or staging.
   - Prohibit executing commands that mutate database state, disk state, or remote systems.

2. **Gather Concrete Evidence**:
   - Inspect source files, schema definitions, configs, and test suites directly using read tools.
   - If tests or verification commands are executed, run only non-destructive, read-only commands.
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
- Task or environment attempts to perform file modifications, database mutations, or writes while executing an audit.
- Target files, repositories, or contracts cannot be accessed or located.
- Codebase state materially contradicts repository routing guards (e.g., non-WashOps contamination).

## Expected Output
A structured read-only audit report containing:
- Executive summary of findings.
- Concrete evidence citations (links to files and line ranges).
- Classification of all claims as `VERIFIED`, `INFERRED`, or `UNKNOWN`.
- Identified material contradictions between specification and implementation.
- Distinct recommendations section clearly separated from current-state findings.
