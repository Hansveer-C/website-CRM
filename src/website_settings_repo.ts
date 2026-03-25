/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { getDB } from './database';
import { WebsiteSettings } from './types';

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
 * Persists the website settings to the SQLite database.
 * The settings act as a singleton, maintaining only one row.
 */
export function persistWebsiteSettings(settings: WebsiteSettings): WebsiteSettings {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO website_settings (
      id, business_name, phone, email, logo_url, primary_color,
      facebook_pixel_id, gtm_id, auto_lead_sms_enabled, auto_lead_sms_template,
      missed_call_sms_enabled, missed_call_sms_template, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    settings.id || 'global-settings',
    settings.business_name,
    settings.phone,
    settings.email,
    settings.logo_url || null,
    settings.primary_color || null,
    settings.facebook_pixel_id || null,
    settings.gtm_id || null,
    settings.auto_lead_sms_enabled ? 1 : 0,
    settings.auto_lead_sms_template,
    settings.missed_call_sms_enabled ? 1 : 0,
    settings.missed_call_sms_template,
    settings.created_at || new Date().toISOString()
  );

  return settings;
}

/**
 * Retrieves the global website settings.
 * Returns default settings automatically if the table is empty.
 */
export function getWebsiteSettings(): WebsiteSettings {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM website_settings WHERE id = 'global-settings' LIMIT 1");
  const row = stmt.get() as any;
  
  if (!row) {
    // Return and save defaults to ensure singleton consistency
    persistWebsiteSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  return {
    ...row,
    auto_lead_sms_enabled: row.auto_lead_sms_enabled === 1,
    missed_call_sms_enabled: row.missed_call_sms_enabled === 1
  };
}
