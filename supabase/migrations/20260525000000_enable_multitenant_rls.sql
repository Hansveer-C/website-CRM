-- Supabase Multi-Tenant RLS Hardening Migration
-- This migration enforces Row-Level Security (RLS) across all core CRM and Website Builder tables.
-- It secures tenant boundaries using user_id = auth.uid() checks and parent joins.

-- ====================================================
-- 1. WEBSITES TABLE
-- ====================================================
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own websites" ON websites;
CREATE POLICY "Users can manage their own websites" ON websites
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 2. WEBSITE ROUTES TABLE
-- ====================================================
ALTER TABLE website_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage routes of their websites" ON website_routes;
CREATE POLICY "Users can manage routes of their websites" ON website_routes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM websites w
            WHERE w.id = website_id AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM websites w
            WHERE w.id = website_id AND w.user_id = auth.uid()
        )
    );

-- ====================================================
-- 3. FUNNELS TABLE
-- ====================================================
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own funnels" ON funnels;
CREATE POLICY "Users can manage their own funnels" ON funnels
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 4. PAGES TABLE
-- ====================================================
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
CREATE POLICY "Users can manage their own pages" ON pages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 5. PAGE SECTIONS TABLE
-- ====================================================
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage sections of their pages" ON page_sections;
CREATE POLICY "Users can manage sections of their pages" ON page_sections
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.id = page_id AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.id = page_id AND p.user_id = auth.uid()
        )
    );

-- ====================================================
-- 6. CONTACTS TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
CREATE POLICY "Users can manage their own contacts" ON contacts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 7. OPPORTUNITIES TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own opportunities" ON opportunities;
CREATE POLICY "Users can manage their own opportunities" ON opportunities
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 8. MESSAGES TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;
CREATE POLICY "Users can manage their own messages" ON messages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 9. CALLS TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own calls" ON calls;
CREATE POLICY "Users can manage their own calls" ON calls
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 10. EVENT LOGS TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own event logs" ON event_logs;
CREATE POLICY "Users can manage their own event logs" ON event_logs
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================================================
-- 11. ACTIVITIES TABLE (Strict Private Tenant Scoping)
-- ====================================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own activities" ON activities;
CREATE POLICY "Users can manage their own activities" ON activities
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
