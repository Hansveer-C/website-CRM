import { supabase, safeDbCall } from './utils/db/supabase';
import { mockWebsiteSettingsMap } from './db';
import { WebsiteSettings, RepoResponse } from './types';

export const DEFAULT_SETTINGS: WebsiteSettings = {
  id: 'global-settings',
  business_name: 'Acme Home Services',
  phone: '+15550000000',
  sms_number: '',
  email: 'hello@acmehome.com',
  logo_url: 'https://placehold.co/150x50/000000/FFFFFF?text=ACME',
  primary_color: '#2563eb',
  facebook_pixel_id: '',
  gtm_id: '',
  ga4_measurement_id: '',
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: 'Hi {name}, thanks for contacting {business_name}. How can we help you?',
  missed_call_sms_enabled: true,
  missed_call_sms_template: "Hi {name}, sorry we missed your call to {business_name}. We'll call back shortly. Can we help you over text?",
  created_at: new Date().toISOString(),
  cities_served: [],
  services_offered: [],
  publish_status: 'draft',
};

function storageKey(userId: string, websiteId: string): string {
  return `mock_settings_${userId}:${websiteId}`;
}

function scope(userId = 'system', websiteId = 'ws-1') {
  return { userId, websiteId };
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function completeSettings(input: Partial<WebsiteSettings>, userId: string, websiteId: string): WebsiteSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    id: input.id || (userId === 'system' && websiteId === 'ws-1' ? 'global-settings' : `settings-${userId}-${websiteId}`),
    user_id: userId,
    website_id: websiteId,
    sms_number: input.sms_number ?? '',
    facebook_pixel_id: input.facebook_pixel_id ?? '',
    gtm_id: input.gtm_id ?? '',
    ga4_measurement_id: input.ga4_measurement_id ?? '',
    cities_served: input.cities_served ?? [],
    services_offered: input.services_offered ?? [],
    publish_status: input.publish_status ?? 'draft',
    website_preset: input.website_preset ?? undefined,
    build_brief: input.build_brief ?? undefined,
    google_business_link: input.google_business_link ?? undefined,
    google_rating: input.google_rating ?? undefined,
    google_reviews_count: input.google_reviews_count ?? undefined,
  };
}

function parseJson(value: any, fallback: any) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function fromSqliteRow(row: any, userId: string, websiteId: string): WebsiteSettings | null {
  if (!row) return null;
  return completeSettings({
    ...row,
    auto_lead_sms_enabled: row.auto_lead_sms_enabled === 0 ? false : !!row.auto_lead_sms_enabled,
    missed_call_sms_enabled: row.missed_call_sms_enabled === 0 ? false : !!row.missed_call_sms_enabled,
    cities_served: parseJson(row.cities_served, []),
    services_offered: parseJson(row.services_offered, []),
    build_brief: parseJson(row.build_brief, undefined),
  }, row.user_id || userId, row.website_id || websiteId);
}

function loadLocal(userId: string, websiteId: string): WebsiteSettings | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, websiteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cached settings shape');
    return completeSettings(parsed, userId, websiteId);
  } catch (err) {
    console.error('[SETTINGS] Corrupted localStorage cache - clearing:', err);
    try {
      window.localStorage.removeItem(storageKey(userId, websiteId));
    } catch {}
    return null;
  }
}

function saveLocal(userId: string, websiteId: string, settings: WebsiteSettings): boolean {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.setItem(storageKey(userId, websiteId), JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('[SETTINGS] Failed to write localStorage:', err);
    return false;
  }
}

async function getSqliteDb(): Promise<any | null> {
  if (typeof process === 'undefined') return null;
  try {
    const mod = await import('./database');
    return mod.getDB();
  } catch {
    return null;
  }
}

function ensureSqliteColumns(db: any): void {
  const existing = db.prepare('PRAGMA table_info(website_settings)').all().map((c: any) => c.name);
  const add = (name: string, ddl: string) => {
    if (!existing.includes(name)) {
      try {
        db.prepare(`ALTER TABLE website_settings ADD COLUMN ${name} ${ddl}`).run();
      } catch {}
    }
  };

  add('sms_number', 'TEXT DEFAULT ""');
  add('ga4_measurement_id', 'TEXT DEFAULT ""');
  add('publish_status', 'TEXT DEFAULT "draft"');
  add('website_preset', 'TEXT');
  add('services_offered', 'TEXT');
  add('cities_served', 'TEXT');
  add('build_brief', 'TEXT');
  add('google_business_link', 'TEXT');
  add('google_rating', 'REAL');
  add('google_reviews_count', 'INTEGER');
  add('user_id', 'TEXT DEFAULT "system"');
  add('website_id', 'TEXT DEFAULT "ws-1"');
}

async function loadSqlite(userId: string, websiteId: string): Promise<WebsiteSettings | null> {
  const db = await getSqliteDb();
  if (!db) return null;
  ensureSqliteColumns(db);

  const scoped = db.prepare('SELECT * FROM website_settings WHERE user_id = ? AND website_id = ?').get(userId, websiteId);
  if (scoped) return fromSqliteRow(scoped, userId, websiteId);

  const legacy = db.prepare('SELECT * FROM website_settings WHERE id = ?').get('global-settings');
  if (!legacy) return null;

  if (userId === 'system' && websiteId === 'ws-1') {
    return fromSqliteRow(legacy, userId, websiteId);
  }

  const cloned = completeSettings({
    ...fromSqliteRow(legacy, userId, websiteId),
    id: `settings-${userId}-${websiteId}`,
  }, userId, websiteId);
  saveSqlite(db, cloned);
  return cloned;
}

function saveSqlite(db: any, settings: WebsiteSettings): void {
  ensureSqliteColumns(db);
  db.prepare(`
    INSERT INTO website_settings (
      id, business_name, phone, email, logo_url, primary_color,
      facebook_pixel_id, gtm_id, auto_lead_sms_enabled, auto_lead_sms_template,
      missed_call_sms_enabled, missed_call_sms_template, created_at,
      sms_number, ga4_measurement_id, publish_status, website_preset,
      services_offered, cities_served, build_brief, google_business_link,
      google_rating, google_reviews_count, user_id, website_id
    ) VALUES (
      @id, @business_name, @phone, @email, @logo_url, @primary_color,
      @facebook_pixel_id, @gtm_id, @auto_lead_sms_enabled, @auto_lead_sms_template,
      @missed_call_sms_enabled, @missed_call_sms_template, @created_at,
      @sms_number, @ga4_measurement_id, @publish_status, @website_preset,
      @services_offered, @cities_served, @build_brief, @google_business_link,
      @google_rating, @google_reviews_count, @user_id, @website_id
    )
    ON CONFLICT(id) DO UPDATE SET
      business_name = excluded.business_name,
      phone = excluded.phone,
      email = excluded.email,
      logo_url = excluded.logo_url,
      primary_color = excluded.primary_color,
      facebook_pixel_id = excluded.facebook_pixel_id,
      gtm_id = excluded.gtm_id,
      auto_lead_sms_enabled = excluded.auto_lead_sms_enabled,
      auto_lead_sms_template = excluded.auto_lead_sms_template,
      missed_call_sms_enabled = excluded.missed_call_sms_enabled,
      missed_call_sms_template = excluded.missed_call_sms_template,
      sms_number = excluded.sms_number,
      ga4_measurement_id = excluded.ga4_measurement_id,
      publish_status = excluded.publish_status,
      website_preset = excluded.website_preset,
      services_offered = excluded.services_offered,
      cities_served = excluded.cities_served,
      build_brief = excluded.build_brief,
      google_business_link = excluded.google_business_link,
      google_rating = excluded.google_rating,
      google_reviews_count = excluded.google_reviews_count,
      user_id = excluded.user_id,
      website_id = excluded.website_id
  `).run({
    ...settings,
    auto_lead_sms_enabled: settings.auto_lead_sms_enabled ? 1 : 0,
    missed_call_sms_enabled: settings.missed_call_sms_enabled ? 1 : 0,
    services_offered: JSON.stringify(settings.services_offered || []),
    cities_served: JSON.stringify(settings.cities_served || []),
    website_preset: settings.website_preset ?? null,
    build_brief: settings.build_brief ? JSON.stringify(settings.build_brief) : null,
    google_business_link: settings.google_business_link || null,
    google_rating: settings.google_rating ?? null,
    google_reviews_count: settings.google_reviews_count ?? null,
  });
}

async function saveLocalStores(userId: string, websiteId: string, settings: WebsiteSettings): Promise<boolean> {
  let saved = false;
  mockWebsiteSettingsMap.set(storageKey(userId, websiteId), settings);
  saved = saveLocal(userId, websiteId, settings) || saved;

  const db = await getSqliteDb();
  if (db) {
    saveSqlite(db, settings);
    saved = true;
  }

  return saved || mockWebsiteSettingsMap.has(storageKey(userId, websiteId));
}

export async function getWebsiteSettings(userIdArg = 'system', websiteIdArg = 'ws-1'): Promise<RepoResponse<WebsiteSettings>> {
  const { userId, websiteId } = scope(userIdArg, websiteIdArg);
  const key = storageKey(userId, websiteId);

  const local = loadLocal(userId, websiteId);
  if (local) {
    mockWebsiteSettingsMap.set(key, local);
    return { success: true, data: local };
  }

  const memory = mockWebsiteSettingsMap.get(key);
  if (memory) return { success: true, data: completeSettings(memory, userId, websiteId) };

  const sqlite = await loadSqlite(userId, websiteId);
  if (sqlite) {
    mockWebsiteSettingsMap.set(key, sqlite);
    saveLocal(userId, websiteId, sqlite);
    return { success: true, data: sqlite };
  }

  const defaults = completeSettings({}, userId, websiteId);
  await saveLocalStores(userId, websiteId, defaults);
  return { success: true, data: defaults };
}

export async function persistWebsiteSettings(
  userIdOrSettings: string | WebsiteSettings,
  websiteIdArg?: string,
  settingsArg?: Partial<WebsiteSettings>,
): Promise<RepoResponse<WebsiteSettings>> {
  const legacyCall = typeof userIdOrSettings !== 'string';
  const { userId, websiteId } = legacyCall ? scope() : scope(userIdOrSettings, websiteIdArg);
  const incoming = legacyCall ? userIdOrSettings : (settingsArg || {});

  if ((incoming as any).user_id && (incoming as any).user_id !== userId) {
    throw new Error('UNAUTHORIZED_ACCESS: settings user_id does not match request user');
  }
  if ((incoming as any).website_id && (incoming as any).website_id !== websiteId) {
    throw new Error('UNAUTHORIZED_ACCESS: settings website_id does not match request website');
  }

  const existing = (await getWebsiteSettings(userId, websiteId)).data || completeSettings({}, userId, websiteId);
  const payload = completeSettings({
    ...existing,
    ...incoming,
    id: userId === 'system' && websiteId === 'ws-1' ? 'global-settings' : (incoming.id || existing.id),
  }, userId, websiteId);

  const hasSupabase = typeof process !== 'undefined'
    && !!process.env.SUPABASE_URL
    && process.env.SUPABASE_URL.startsWith('https://')
    && !process.env.SUPABASE_URL.includes('placeholder.supabase.co');

  if (hasSupabase) {
    const res = await safeDbCall('PERSIST_SETTINGS', userId, supabase
      .from('website_settings')
      .upsert(payload)
      .select()
      .single()
    );
    if (res.success) {
      await saveLocalStores(userId, websiteId, payload);
      return res as unknown as RepoResponse<WebsiteSettings>;
    }
  }

  const saved = await saveLocalStores(userId, websiteId, payload);
  if (saved && userId === 'system' && websiteId !== 'ws-1') {
    const legacyMirror = completeSettings({
      ...payload,
      id: 'global-settings',
    }, 'system', 'ws-1');
    await saveLocalStores('system', 'ws-1', legacyMirror);
  }
  return saved ? { success: true, data: payload } : { success: false, error: 'PERSIST_FAILED' };
}
