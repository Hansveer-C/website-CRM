-- Alter website_settings to support multi-tenancy.
-- The existing nullable TEXT user_id remains the application-user identity and
-- continues to reference public.users(id). Legacy ownership assignment is
-- separate data work; a NULL-owned row must not be silently claimed.
ALTER TABLE public.website_settings
    ADD COLUMN IF NOT EXISTS website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS build_brief JSONB,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Preserve one settings row per assigned website. NULL website assignments are
-- intentionally excluded so legacy rows remain valid until separately assigned.
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_settings_website_id
    ON public.website_settings (website_id)
    WHERE website_id IS NOT NULL;

-- Row-Level Security Policies for website_settings
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_all_own ON public.website_settings;

DROP POLICY IF EXISTS "Users can view their own website settings" ON public.website_settings;
CREATE POLICY "Users can view their own website settings"
    ON public.website_settings
    FOR SELECT
    TO authenticated
    USING (
        website_settings.user_id = (SELECT auth.uid()::TEXT)
        AND (
            website_settings.website_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.websites AS website
                WHERE website.id = website_settings.website_id
                  AND website.user_id = (SELECT auth.uid()::TEXT)
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert their own website settings" ON public.website_settings;
CREATE POLICY "Users can insert their own website settings"
    ON public.website_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        website_settings.user_id = (SELECT auth.uid()::TEXT)
        AND (
            website_settings.website_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.websites AS website
                WHERE website.id = website_settings.website_id
                  AND website.user_id = (SELECT auth.uid()::TEXT)
            )
        )
    );

DROP POLICY IF EXISTS "Users can update their own website settings" ON public.website_settings;
CREATE POLICY "Users can update their own website settings"
    ON public.website_settings
    FOR UPDATE
    TO authenticated
    USING (
        website_settings.user_id = (SELECT auth.uid()::TEXT)
        AND (
            website_settings.website_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.websites AS website
                WHERE website.id = website_settings.website_id
                  AND website.user_id = (SELECT auth.uid()::TEXT)
            )
        )
    )
    WITH CHECK (
        website_settings.user_id = (SELECT auth.uid()::TEXT)
        AND (
            website_settings.website_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.websites AS website
                WHERE website.id = website_settings.website_id
                  AND website.user_id = (SELECT auth.uid()::TEXT)
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete their own website settings" ON public.website_settings;
CREATE POLICY "Users can delete their own website settings"
    ON public.website_settings
    FOR DELETE
    TO authenticated
    USING (
        website_settings.user_id = (SELECT auth.uid()::TEXT)
        AND (
            website_settings.website_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.websites AS website
                WHERE website.id = website_settings.website_id
                  AND website.user_id = (SELECT auth.uid()::TEXT)
            )
        )
    );

-- Public website reads will use a controlled backend or Edge Function. Direct
-- anonymous table SELECT is intentionally not granted, avoiding cross-table RLS
-- dependencies and unnecessary database exposure.
DROP POLICY IF EXISTS "Anyone can view published website settings" ON public.website_settings;
