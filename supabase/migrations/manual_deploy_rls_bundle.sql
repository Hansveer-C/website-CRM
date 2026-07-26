-- ==============================================================================
-- 🚀 SUPABASE MULTI-TENANT & RLS HARDENING - CONSOLIDATED DEPLOYMENT BUNDLE
-- ==============================================================================
-- This script aggregates all Website Builder and CRM multi-tenant database migrations
-- in the correct chronological dependency order.
-- 
-- All CREATE TABLE statements are fully idempotent (IF NOT EXISTS).
-- All CREATE POLICY statements are preceded by DROP POLICY IF EXISTS to allow safe re-runs.
-- ==============================================================================

-- ==============================================================================
-- 🔍 OPTIONAL PRE-RUN VERIFICATION CHECK
-- Paste and run this section first to verify all prerequisite tables exist.
-- ==============================================================================
/*
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
*/



-- ==============================================================================
-- SECTION 1: CREATE REVIEWS TABLE & RLS (20260329151527)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  text TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reviews" ON reviews;
CREATE POLICY "Users can manage their own reviews"
  ON reviews
  FOR ALL
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews
  FOR SELECT
  USING (true);


-- ==============================================================================
-- SECTION 2: CREATE GALLERY ITEMS TABLE & RLS (20260521225500)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  title TEXT,
  service_type TEXT,
  city TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON gallery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_service_type ON gallery_items(service_type);
CREATE INDEX IF NOT EXISTS idx_gallery_items_city ON gallery_items(city);
CREATE INDEX IF NOT EXISTS idx_gallery_items_is_featured ON gallery_items(is_featured);

ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own gallery items" ON gallery_items;
CREATE POLICY "Users can manage their own gallery items"
  ON gallery_items
  FOR ALL
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Anyone can view gallery items" ON gallery_items;
CREATE POLICY "Anyone can view gallery items"
  ON gallery_items
  FOR SELECT
  USING (true);


-- ==============================================================================
-- SECTION 3: BUCKETS SETUP & MEDIA STORAGE POLICY (20260523000000)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read access to media" ON storage.objects;
CREATE POLICY "Allow public read access to media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Allow tenant-scoped inserts" ON storage.objects;
CREATE POLICY "Allow tenant-scoped inserts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow tenant-scoped updates" ON storage.objects;
CREATE POLICY "Allow tenant-scoped updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow tenant-scoped deletes" ON storage.objects;
CREATE POLICY "Allow tenant-scoped deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);


-- ==============================================================================
-- SECTION 4: MULTI-TENANT WEBSITE SETTINGS COLUMNS & POLICIES (20260521172844, 20260522140000, 20260524000000)
-- ==============================================================================
-- Ensure columns exist
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'draft';
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES websites(id) ON DELETE CASCADE;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS build_brief JSONB;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_settings_website_id ON website_settings (website_id) WHERE website_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_settings_user_id ON website_settings (user_id);

ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own website settings" ON website_settings;
CREATE POLICY "Users can view their own website settings" ON website_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own website settings" ON website_settings;
CREATE POLICY "Users can update their own website settings" ON website_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own website settings" ON website_settings;
CREATE POLICY "Users can insert their own website settings" ON website_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own website settings" ON website_settings;
CREATE POLICY "Users can delete their own website settings" ON website_settings
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published website settings" ON website_settings;
CREATE POLICY "Anyone can view published website settings" ON website_settings
    FOR SELECT USING (publish_status = 'published');


-- ==============================================================================
-- SECTION 5: ENABLE RLS ACROSS CORE CRM & BUILDER TABLES (20260525000000)
-- ==============================================================================

-- 1. WEBSITES
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own websites" ON websites;
CREATE POLICY "Users can manage their own websites" ON websites
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. WEBSITE ROUTES
ALTER TABLE website_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage routes of their websites" ON website_routes;
CREATE POLICY "Users can manage routes of their websites" ON website_routes
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM websites w WHERE w.id = website_id AND w.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM websites w WHERE w.id = website_id AND w.user_id = auth.uid()));

-- 3. FUNNELS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own funnels" ON funnels;
CREATE POLICY "Users can manage their own funnels" ON funnels
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. PAGES
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own pages" ON pages;
CREATE POLICY "Users can manage their own pages" ON pages
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PAGE SECTIONS
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage sections of their pages" ON page_sections;
CREATE POLICY "Users can manage sections of their pages" ON page_sections
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM pages p WHERE p.id = page_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM pages p WHERE p.id = page_id AND p.user_id = auth.uid()));

-- 6. CONTACTS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
CREATE POLICY "Users can manage their own contacts" ON contacts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. OPPORTUNITIES
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own opportunities" ON opportunities;
CREATE POLICY "Users can manage their own opportunities" ON opportunities
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. MESSAGES
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;
CREATE POLICY "Users can manage their own messages" ON messages
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. CALLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own calls" ON calls;
CREATE POLICY "Users can manage their own calls" ON calls
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10. EVENT LOGS
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own event logs" ON event_logs;
CREATE POLICY "Users can manage their own event logs" ON event_logs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 11. ACTIVITIES
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own activities" ON activities;
CREATE POLICY "Users can manage their own activities" ON activities
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
