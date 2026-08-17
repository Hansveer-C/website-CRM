ALTER TABLE public.website_settings 
ADD COLUMN IF NOT EXISTS auto_lead_sms_template text,
ADD COLUMN IF NOT EXISTS missed_call_sms_template text;