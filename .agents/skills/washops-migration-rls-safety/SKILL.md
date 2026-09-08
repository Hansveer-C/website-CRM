---
name: washops-migration-rls-safety
description: Validates database migrations and Row-Level Security (RLS) policies for tenant isolation, idempotency, and server authority.
---

# WashOps Migration and RLS Safety

## Purpose
Ensures database migrations and Row-Level Security (RLS) policies adhere to WashOps CRM data architecture invariants: fail-closed access, tenant isolation, anonymous denial, server-authoritative mutations, and deterministic replay. Prevents accidental production data loss and unauthorized data access.

## Triggers
- Authoring or modifying database schema, migrations, or DDL scripts.
- Adding, updating, or reviewing Supabase Row-Level Security (RLS) policies.
- Audit or testing of tenant boundaries, role permissions, or data access controls.

## Required Inputs
- Target SQL migration files or schema modification scripts.
- Target tables, columns, roles, and security policies.
- Local Supabase / test harness configuration.

## Procedure
1. **Local Test Harness Execution**:
   - Execute all database validation against the local Supabase environment or automated local test harness.
   - **Never** automatically source, load, or connect to production database credentials.

2. **Clean Migration Replay**:
   - Verify that all migrations apply cleanly from a clean baseline (replay from scratch).
   - Ensure migration scripts are idempotent, properly ordered, and do not fail on clean re-application.

3. **Tenant Isolation Verification**:
   - Verify that every table storing multi-tenant data has Row-Level Security explicitly enabled:
     ```sql
     ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
     ```
   - Verify that default policy behavior is fail-closed (deny all when no policy matches).
   - Verify that policies derive tenant context exclusively from validated server session tokens (e.g., `auth.jwt()`), never from client-supplied parameters.
   - Validate that queries executed under Tenant A cannot view, insert, update, or delete records belonging to Tenant B.

4. **Anonymous Access Denial**:
   - Verify that anonymous (`anon`) role access is denied by default unless an explicit, authenticated server-mediated contract specifically authorizes public read access.

5. **Server-Authoritative Lifecycle Boundary**:
   - Ensure sensitive columns (e.g., financial amounts, invoice statuses, ownership markers, subscription tiers) cannot be directly updated by untrusted client roles.
   - Enforce lifecycle changes via server-side procedures or service-role mutations with authenticated business logic.

6. **Safety Loop Execution**:
   - Follow the Migration/RLS Safety Loop: initial migration test plus up to 2 local repair passes.
   - Verify single ownership of the migration file; ensure no concurrent conflicting migrations.

## Stop Conditions
STOP immediately and require human escalation if:
- Any step requests or attempts to connect to a production database or use production credentials.
- Production migration execution or production migration-ledger repair is required.
- The migration involves destructive DDL (e.g., `DROP TABLE`, `DROP COLUMN`, truncate, or destructive data rewrites).
- The migration proposes broadening or loosening existing RLS policies.
- Production data backfills or manual data fixes are required.
- Local replay fails non-deterministically or tenant isolation leaks data across boundaries.

## Expected Output
A migration and RLS safety report including:
- Migration replay status (clean replay confirmation from local harness).
- RLS policy audit table (table name, RLS enabled status, policy names, roles, operations).
- Tenant isolation test results (cross-tenant denial verified).
- Anonymous access denial test results.
- Explicit confirmation that production credentials were not accessed and all human gates remain active.
