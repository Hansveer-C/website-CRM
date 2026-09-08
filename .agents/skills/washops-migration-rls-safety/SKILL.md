---
name: washops-migration-rls-safety
description: Validates database migrations and Row-Level Security (RLS) policies for tenant isolation, deterministic clean-baseline replay, and server authority.
---

# WashOps Migration and RLS Safety

## Purpose
Ensures database migrations and Row-Level Security (RLS) policies adhere to WashOps CRM data architecture invariants: fail-closed access, tenant isolation, anonymous denial, server-authoritative mutations, and deterministic replay from a clean baseline. Prevents accidental production data loss and unauthorized data access.

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

2. **Deterministic Migration Replay from Clean Baseline**:
   - Verify that the canonical migration chain applies cleanly, in order, from a clean local baseline / zero state without manual intervention.
   - Ensure migration ordering and dependencies are deterministic and the resulting schema/policies match expected state.
   - Note: Individual versioned migrations are not required to be executable twice unless deliberately designed for idempotent maintenance/recovery behavior.
   - Do not hide ordering or dependency defects by adding broad `IF EXISTS` / `IF NOT EXISTS` guards merely to make repeated execution pass.

3. **Tenant Isolation Verification**:
   - Verify that every table storing multi-tenant data has Row-Level Security explicitly enabled:
     ```sql
     ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
     ```
   - Verify that default policy behavior is fail-closed (deny all when no policy matches).
   - Verify that authorization derives strictly from trusted authenticated database or server identity (e.g., `auth.uid()`, verified JWT claims, server-resolved tenant membership, or approved canonical server contracts).
   - Ensure browser-supplied `user_id`, `tenant_id`, or `business_id` values never become authorization authority merely because the client supplied them.
   - Validate that queries executed under Tenant A cannot view, insert, update, or delete records belonging to Tenant B.

4. **Anonymous Access & Public Surface Isolation**:
   - Protected tenant data must deny anonymous (`anon`) access by default.
   - Intentional public WashOps surfaces may permit narrowly scoped anonymous operations only when explicitly defined by a canonical product contract (e.g., published Builder runtime state or public intake/lead submission).
   - Any public access must expose only the minimum operation/data required and be verified through adversarial testing.
   - Never convert "public" into broad tenant-table access.

5. **Server-Authoritative Lifecycle Boundary**:
   - Ensure sensitive columns (e.g., financial amounts, invoice statuses, ownership markers, subscription tiers) cannot be directly updated by untrusted client roles.
   - Service-role usage is an infrastructure capability, not the default domain authorization model.
   - Privileged/service-role procedures must still validate the authenticated actor and canonical tenant/business relationship before important lifecycle mutations.

6. **Safety Loop Execution**:
   - Follow the Migration/RLS Safety Loop: initial migration test plus up to 2 local repair passes.
   - Verify single ownership of the migration file; ensure no concurrent conflicting migrations.

## Stop Conditions
STOP immediately and require human escalation if:
- Any step requests or attempts to connect to a production database or use production credentials.
- Production migration execution or production migration-ledger repair is required.
- The migration involves destructive DDL (e.g., `DROP TABLE`, `DROP COLUMN`, truncate, or destructive data rewrites).
- The migration proposes broadening or loosening existing RLS policies without canonical contract specification.
- Production data backfills or manual data fixes are required.
- Local replay fails non-deterministically or tenant isolation leaks data across boundaries.

## Expected Output
A migration and RLS safety report including:
- Migration replay status (clean deterministic replay confirmation from local harness).
- RLS policy audit table (table name, RLS enabled status, policy names, roles, operations).
- Tenant isolation test results (cross-tenant denial verified).
- Anonymous access and public surface restriction test results.
- Explicit confirmation that production credentials were not accessed and all human gates remain active.
