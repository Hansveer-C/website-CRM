-- Alter website_settings to support multi-tenancy
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES websites(id) ON DELETE CASCADE;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS build_brief JSONB;
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add index on user_id and unique index on website_id where website_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_settings_website_id ON website_settings (website_id) WHERE website_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_settings_user_id ON website_settings (user_id);

-- Row-Level Security Policies for website_settings
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

-- Allow public read of settings for resolved published websites
DROP POLICY IF EXISTS "Anyone can view published website settings" ON website_settings;
CREATE POLICY "Anyone can view published website settings" ON website_settings
    FOR SELECT USING (publish_status = 'published');
