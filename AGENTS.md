# WashOps CRM — Repository Instructions

This repository is exclusively for the **WASHOPS CRM** project.

## Mandatory project routing guard

Before executing any task, inspect the task or prompt heading.

### Allowed

Execute coding work only when the task clearly identifies itself as:

**WASHOPS CRM**

### Wrong project

If a task contains or identifies itself as:

**HansSays Content Engine**

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

### Missing identifier

If a coding task does not clearly identify itself as **WASHOPS CRM**, do not execute it.

Respond only:

`PROJECT IDENTIFIER REQUIRED — THIS WORKSPACE ONLY ACCEPTS WASHOPS CRM TASKS.`

## Isolation rule

Never transfer or infer code, migrations, architecture, branch names, pull requests, database state, requirements, or assumptions from **HansSays Content Engine** into this repository.

Similar technologies or naming do not imply shared project context.

## Current repository

`Hansveer-C/website-CRM`

## Scope precedence

These routing rules are repository-level safety instructions and apply before implementation, audit, migration, testing, deployment, or release work.
