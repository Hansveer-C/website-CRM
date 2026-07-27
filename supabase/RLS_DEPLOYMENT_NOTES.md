# Supabase Row-Level Security Deployment Notes

This document provides deployment guidelines and operational steps to apply and test the newly hardened Row-Level Security (RLS) policies on your Supabase cloud project.

---

## 1. Safety Warnings

> [!CAUTION]
> **No Secrets in Code:** Never hardcode your `service_role` key inside frontend files or paste full keys into terminal/chat scripts.
> **Multi-Tenant Testing:** Always test database updates with **two separate, registered Supabase test users** to verify that Tenant A cannot view or manipulate data belonging to Tenant B before onboarding production users.

---

## 2. Deployment Pathways

You can apply the RLS migration file ([supabase/migrations/20260525000000_enable_multitenant_rls.sql](file:///d:/Website-CRM/supabase/migrations/20260525000000_enable_multitenant_rls.sql)) using either of the following two safe pathways:

### Option A: The Supabase Dashboard SQL Editor (Staging & Fast Setup)
1. Log in to your [Supabase Console](https://supabase.com/dashboard).
2. Select your project and click on the **SQL Editor** in the left navigation sidebar.
3. Click **New Query**.
4. Open the local migration file: [20260525000000_enable_multitenant_rls.sql](file:///d:/Website-CRM/supabase/migrations/20260525000000_enable_multitenant_rls.sql).
5. Copy all the contents of the file and paste them into the SQL Editor query window.
6. Click **Run**.
7. Confirm that the execution status reports success.

---

### Option B: The Supabase CLI (Recommended for Production CI/CD)
Since the Supabase CLI is successfully installed on your local environment (accessible via `npx`), you can push the schema updates directly:

1. **Log in to Supabase CLI:**
   ```bash
   npx supabase login
   ```
   *(Paste your Personal Access Token from your Account Settings when prompted)*
2. **Link the CLI to your Cloud Project:**
   ```bash
   npx supabase link --project-ref jkwfocgqgltdmprhdmji
   ```
3. **Review Migration Files:**
   Confirm your migrations are recognized:
   ```bash
   npx supabase migration list
   ```
4. **Push database changes:**
   Apply all local migration scripts directly to the cloud database:
   ```bash
   npx supabase db push
   ```

---

## 3. Storage Bucket Preparation
To support secure media uploads (logos, gallery comparison slides) in a production tenant-scoped bucket:
1. Go to the **Storage** tab in your Supabase Console.
2. Select the bucket named **`media`**.
3. Under **Bucket Policies**, verify that the policies from [20260523000000_create_media_storage.sql](file:///d:/Website-CRM/supabase/migrations/20260523000000_create_media_storage.sql) are active:
   - `Allow public read access to media` (`SELECT` allowed for all users).
   - `Allow tenant-scoped inserts` (`INSERT` allowed strictly to paths matching `auth.uid()::text`).
   - `Allow tenant-scoped updates` & `Allow tenant-scoped deletes` (`UPDATE`/`DELETE` allowed strictly to paths matching `auth.uid()::text`).

---

## 4. Post-Deployment Verification Smoke Tests

Run these direct verification smoke tests using the staging site to ensure the security boundaries are 100% hardened:

1. **Staged Website Builder Onboarding:**
   Register a test account (`tenant-a@test.com`), generate a site using the Guided Builder, and upload a company logo. Confirm settings save correctly.
2. **Inter-Tenant Leakage Check:**
   Register a second test account (`tenant-b@test.com`). Log in and attempt to query `/api/settings` or browse the settings view. Confirm `tenant-b` cannot load `tenant-a`'s business name or color configuration.
3. **Public Published Gating:**
   Set the website's `publish_status` to `'draft'` in Settings. Attempt to visit the resolved subdomain `/preview/` (should render the site preview successfully) and then visit the public URL `/site/` without logging in (should return a secure "This website is not published yet" warning screen).
