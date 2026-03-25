import { supabase, safeDbCall } from './utils/db/supabase';
import { WebsiteSettings, RepoResponse } from './types';

// Default initial settings
export const DEFAULT_SETTINGS: WebsiteSettings = {
  id: 'global-settings',
  business_name: 'Acme Home Services',
  phone: '+15550000000',
  email: 'hello@acmehome.com',
  logo_url: 'https://placehold.co/150x50/000000/FFFFFF?text=ACME',
  primary_color: '#2563eb',
  facebook_pixel_id: '',
  gtm_id: '',
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: 'Hi {name}, thanks for contacting {business_name}. How can we help you?',
  missed_call_sms_enabled: true,
  missed_call_sms_template: "Hi {name}, sorry we missed your call to {business_name}. We'll call back shortly. Can we help you over text?",
  created_at: new Date().toISOString(),
};

/**
 * Persists the website settings to Supabase.
 * Single row with ID 'global-settings'.
 */
export async function persistWebsiteSettings(settings: WebsiteSettings): Promise<RepoResponse<WebsiteSettings>> {
  const payload = {
    ...settings,
    id: 'global-settings'
  };

  return safeDbCall('PERSIST_SETTINGS', 'system', supabase
    .from('website_settings')
    .upsert(payload)
    .select()
    .single()
  );
}

/**
 * Retrieves the global website settings.
 */
export async function getWebsiteSettings(): Promise<RepoResponse<WebsiteSettings>> {
  const res = await safeDbCall('GET_SETTINGS', 'system', supabase
    .from('website_settings')
    .select('*')
    .eq('id', 'global-settings')
    .maybeSingle()
  );

  if (res.success && !res.data) {
     // If not found, create and return defaults
     return persistWebsiteSettings(DEFAULT_SETTINGS);
  }

  return res as unknown as RepoResponse<WebsiteSettings>;
}
