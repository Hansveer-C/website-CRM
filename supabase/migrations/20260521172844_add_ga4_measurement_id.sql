-- Add ga4_measurement_id to website_settings table
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT;
