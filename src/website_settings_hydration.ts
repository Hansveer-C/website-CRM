import type { Website, WebsiteSettings } from './types';

export type WebsiteSettingsLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface WebsiteSettingsHydrationState {
  status: WebsiteSettingsLoadState;
  userId?: string;
  websiteId?: string;
}

interface SettingsQueryResult {
  data: unknown | null;
  error: unknown | null;
}

export interface WebsiteSettingsHydrationClient {
  from(table: 'website_settings'): {
    select(columns: string): {
      eq(column: 'user_id', value: string): {
        eq(column: 'website_id', value: string): {
          limit(value: number): {
            maybeSingle(): PromiseLike<SettingsQueryResult>;
          };
        };
      };
    };
  };
}

export function createNeutralWebsiteSettings(): WebsiteSettings {
  return {
    id: '',
    business_name: 'Your Business',
    phone: '',
    sms_number: '',
    email: '',
    logo_url: '',
    primary_color: '#2563eb',
    facebook_pixel_id: '',
    gtm_id: '',
    ga4_measurement_id: '',
    auto_lead_sms_enabled: false,
    auto_lead_sms_template: '',
    missed_call_sms_enabled: false,
    missed_call_sms_template: '',
    created_at: '',
    publish_status: 'draft',
    cities_served: [],
    services_offered: []
  };
}

function normalizeSettingsRow(value: unknown, userId: string, websiteId: string): WebsiteSettings | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<WebsiteSettings>;
  if (row.user_id !== userId || row.website_id !== websiteId
    || typeof row.id !== 'string' || typeof row.business_name !== 'string') return null;
  const neutral = createNeutralWebsiteSettings();
  return {
    ...neutral,
    ...row,
    user_id: userId,
    website_id: websiteId,
    phone: typeof row.phone === 'string' ? row.phone : neutral.phone,
    sms_number: typeof row.sms_number === 'string' ? row.sms_number : neutral.sms_number,
    email: typeof row.email === 'string' ? row.email : neutral.email,
    logo_url: typeof row.logo_url === 'string' ? row.logo_url : neutral.logo_url,
    primary_color: typeof row.primary_color === 'string' && row.primary_color.trim()
      ? row.primary_color
      : neutral.primary_color,
    facebook_pixel_id: typeof row.facebook_pixel_id === 'string' ? row.facebook_pixel_id : neutral.facebook_pixel_id,
    gtm_id: typeof row.gtm_id === 'string' ? row.gtm_id : neutral.gtm_id,
    ga4_measurement_id: typeof row.ga4_measurement_id === 'string' ? row.ga4_measurement_id : neutral.ga4_measurement_id,
    auto_lead_sms_enabled: typeof row.auto_lead_sms_enabled === 'boolean'
      ? row.auto_lead_sms_enabled
      : neutral.auto_lead_sms_enabled,
    auto_lead_sms_template: typeof row.auto_lead_sms_template === 'string'
      ? row.auto_lead_sms_template
      : neutral.auto_lead_sms_template,
    missed_call_sms_enabled: typeof row.missed_call_sms_enabled === 'boolean'
      ? row.missed_call_sms_enabled
      : neutral.missed_call_sms_enabled,
    missed_call_sms_template: typeof row.missed_call_sms_template === 'string'
      ? row.missed_call_sms_template
      : neutral.missed_call_sms_template,
    created_at: typeof row.created_at === 'string' ? row.created_at : neutral.created_at,
    cities_served: Array.isArray(row.cities_served) ? structuredClone(row.cities_served) : neutral.cities_served,
    services_offered: Array.isArray(row.services_offered) ? structuredClone(row.services_offered) : neutral.services_offered
  };
}

function replaceSettings(target: WebsiteSettings, value: WebsiteSettings): void {
  for (const key of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[key];
  Object.assign(target, structuredClone(value));
}

export class WebsiteSettingsHydrator {
  state: WebsiteSettingsHydrationState = { status: 'idle' };
  private generation = 0;

  constructor(
    private readonly getClient: () => Promise<WebsiteSettingsHydrationClient | null>,
    private readonly target: WebsiteSettings
  ) {}

  clear(): void {
    this.generation += 1;
    replaceSettings(this.target, createNeutralWebsiteSettings());
    this.state = { status: 'idle' };
  }

  async hydrate(userIdInput: string, website: Website | undefined, force = false): Promise<WebsiteSettingsHydrationState> {
    const userId = userIdInput.trim();
    const websiteId = website?.id.trim() ?? '';
    if (!force && userId && websiteId && website?.user_id === userId
      && this.state.userId === userId && this.state.websiteId === websiteId
      && (this.state.status === 'ready' || this.state.status === 'empty')) return this.state;

    this.clear();
    const generation = this.generation;
    this.state = { status: 'loading', userId, websiteId };
    if (!userId || !websiteId || website?.user_id !== userId) {
      this.state = { status: 'error', userId, websiteId };
      return this.state;
    }

    try {
      const client = await this.getClient();
      if (!client) throw new Error('UNAVAILABLE');
      const result = await client.from('website_settings').select('*')
        .eq('user_id', userId).eq('website_id', websiteId).limit(1).maybeSingle();
      if (result.error) throw new Error('UNAVAILABLE');
      if (generation !== this.generation) return this.state;
      if (!result.data) {
        this.state = { status: 'empty', userId, websiteId };
        return this.state;
      }
      const settings = normalizeSettingsRow(result.data, userId, websiteId);
      if (!settings) throw new Error('UNAVAILABLE');
      replaceSettings(this.target, settings);
      this.state = { status: 'ready', userId, websiteId };
    } catch {
      if (generation === this.generation) {
        replaceSettings(this.target, createNeutralWebsiteSettings());
        this.state = { status: 'error', userId, websiteId };
      }
    }
    return this.state;
  }

  acceptConfirmed(userId: string, websiteId: string, value: unknown): boolean {
    const settings = normalizeSettingsRow(value, userId, websiteId);
    if (this.state.userId !== userId || this.state.websiteId !== websiteId || !settings) return false;
    replaceSettings(this.target, settings);
    this.state = { status: 'ready', userId, websiteId };
    return true;
  }
}
