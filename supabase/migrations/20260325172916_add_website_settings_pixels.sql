ALTER TABLE public.website_settings 
ADD COLUMN IF NOT EXISTS facebook_pixel_id text,
ADD COLUMN IF NOT EXISTS gtm_id text;