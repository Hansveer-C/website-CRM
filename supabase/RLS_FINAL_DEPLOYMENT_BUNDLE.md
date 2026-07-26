# Supabase Row-Level Security Final Deployment Bundle

This document outlines the final launch checklist and instructions for applying the multi-tenant Row-Level Security (RLS) hardening schema to your production Supabase database.

---

## 1. Safety Warnings & Prerequisite Audits

> [!CAUTION]
> **Check Table Existence First:** The final RLS migration references tables (`websites`, `website_routes`, `funnels`, `pages`, `page_sections`, `contacts`, `opportunities`, `messages`, `calls`, `event_logs`, and `activities`).
>
> If you are deploying to a brand new Supabase instance, ensure these base tables are created **before** running the RLS policies, otherwise the database will return `relation "table_name" does not exist` errors.

---

## 2. Table Existence Pre-Flight Checklist

Before applying the RLS migration, open your Supabase Database Table Editor and confirm the following tables are present:

- [ ] `websites`
- [ ] `website_routes`
- [ ] `funnels`
- [ ] `pages`
- [ ] `page_sections`
- [ ] `contacts`
- [ ] `opportunities`
- [ ] `messages`
- [ ] `calls`
- [ ] `event_logs`
- [ ] `activities`
- [ ] `website_settings`

Alternatively, you can copy, paste, and run this **pre-run SQL query script** in your SQL Editor to automatically inspect all required tables and buckets at once:

```sql
-- ============================================================
-- PRE-RUN CHECK: Required tables and media bucket
-- Purpose: Confirm prerequisites exist before applying RLS bundle
-- ============================================================

WITH required_tables AS (
  SELECT unnest(ARRAY[
    'websites',
    'website_routes',
    'funnels',
    'pages',
    'page_sections',
    'contacts',
    'opportunities',
    'messages',
    'calls',
    'event_logs',
    'activities',
    'website_settings',
    'gallery_items',
    'reviews'
  ]) AS table_name
),
existing_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
)
SELECT
  rt.table_name,
  CASE
    WHEN et.table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM required_tables rt
LEFT JOIN existing_tables et
  ON rt.table_name = et.table_name
ORDER BY rt.table_name;

-- ============================================================
-- PRE-RUN CHECK: Media bucket
-- ============================================================

SELECT
  'media' AS bucket_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM storage.buckets
      WHERE id = 'media'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status;
```

---


## 3. Migration Dependency Execution Sequence

Migrations must be run in the following chronological order:

| Step | Migration File Name | Target | Idempotency |
| :--- | :--- | :--- | :--- |
| **1** | `20260329151527_create_reviews_table.sql` | Reviews table & RLS | Yes |
| **2** | `20260521172844_add_ga4_measurement_id.sql` | Schema Alteration | Yes |
| **3** | `20260521225500_create_gallery_items_table.sql` | Gallery Items & RLS | Yes |
| **4** | `20260522140000_add_publish_status.sql` | Schema Alteration | Yes |
| **5** | `20260523000000_create_media_storage.sql` | Media Storage Bucket | Yes |
| **6** | `20260524000000_multitenant_website_settings.sql`| Settings Multi-Tenant RLS | Yes |
| **7** | `20260525000000_enable_multitenant_rls.sql` | Core hardens 11 CRM tables | Yes |

---

## 4. Option A: SQL Editor Deployment (Single-Bundle)

To make it as simple as possible, a pre-compiled, **100% idempotent single query script** is available at:
`supabase/migrations/manual_deploy_rls_bundle.sql`

This file handles dropping existing policies and creating tables/storage buckets cleanly in order.

1. Open the [manual_deploy_rls_bundle.sql](file:///d:/Website-CRM/supabase/migrations/manual_deploy_rls_bundle.sql) file.
2. Copy its entire content.
3. Open your [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/jkwfocgqgltdmprhdmji/sql).
4. Click **New Query**, paste the code, and click **Run**.
5. Confirm that the status reports success.

---

## 5. Option B: CLI Deployment Commands

If you prefer using the command line and your project is linked:

```bash
# 1. Login to the CLI
npx supabase login

# 2. Link your local working directory to the cloud project ref
npx supabase link --project-ref jkwfocgqgltdmprhdmji

# 3. Check migration history differences
npx supabase migration list

# 4. Push all migrations safely
npx supabase db push
```

---

## 6. Post-Deployment Smoke Test Checklist

Register two separate test users (`user_a` and `user_b`) on the staging app to verify multi-tenant scoping:

* [ ] **Settings Write Isolation**: 
  As `User A`, try to update website settings for `website_id` belonging to `User B`. Confirm the save returns a database RLS policy violation.
* [ ] **Settings Read Scoping**: 
  As `User B`, verify you cannot read `User A`'s settings via the private authenticated settings endpoint.
* [ ] **Public Published Gating**: 
  Set the website's `publish_status` to `'draft'` in Settings. Attempt to visit the resolved subdomain `/preview/` (should render successfully) and then visit the public URL `/site/` without logging in (should return a secure "This website is not published yet" warning screen).
* [ ] **CRM Data Scoping**: 
  Attempt to fetch `contacts` or `opportunities` via direct anonymous API calls. Confirm the API returns empty datasets.
* [ ] **Storage Scoping**: 
  As `User B`, attempt to write or delete a file inside folder `/user_a/...` in the `media` storage bucket. Verify the write is blocked.

---

## 7. Rollback Considerations

In the event of an unexpected regression or production deployment emergency, execute the following SQL script inside the Supabase SQL Editor to disable Row-Level Security and restore general data access:

```sql
-- Disable Row-Level Security on all 11 core tables
ALTER TABLE websites DISABLE ROW LEVEL SECURITY;
ALTER TABLE website_routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE funnels DISABLE ROW LEVEL SECURITY;
ALTER TABLE pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- Drop newly added policies to revert to open state
DROP POLICY IF EXISTS "Users can manage their own websites" ON websites;
DROP POLICY IF EXISTS "Users can manage routes of their websites" ON website_routes;
DROP POLICY IF EXISTS "Users can manage their own funnels" ON funnels;
DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
DROP POLICY IF EXISTS "Users can manage sections of their pages" ON page_sections;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage their own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;
DROP POLICY IF EXISTS "Users can manage their own calls" ON calls;
DROP POLICY IF EXISTS "Users can manage their own event logs" ON event_logs;
DROP POLICY IF EXISTS "Users can manage their own activities" ON activities;
```
