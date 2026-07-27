-- Add publish_status to website_settings table
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'draft';
