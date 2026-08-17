-- 🛡️ F8: High-Traffic Query Indexing
-- Optimization for email-based contact lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON public.contacts (user_id, email);

-- Optimization for scoped call lookups (if not covered enough by timeline index prefix)
CREATE INDEX IF NOT EXISTS idx_calls_user_contact ON public.calls (user_id, contact_id);
