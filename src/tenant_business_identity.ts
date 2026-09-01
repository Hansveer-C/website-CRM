export interface TenantBusinessIdentity {
  user_id: string;
  business_name: string;
  phone: string;
  email: string;
  logo_url: string;
  primary_color: string;
  created_at: string;
  updated_at: string;
}

export type TenantBusinessIdentityInput = Pick<
  TenantBusinessIdentity,
  'business_name' | 'phone' | 'email' | 'logo_url' | 'primary_color'
>;

export interface TenantBusinessIdentityQueryResult {
  data: unknown | null;
  error: unknown | null;
}

export interface TenantBusinessIdentityClient {
  from(table: 'tenant_business_identities'): {
    select(columns: string): {
      eq(column: 'user_id', value: string): {
        limit(value: number): { maybeSingle(): PromiseLike<TenantBusinessIdentityQueryResult> };
      };
    };
  };
}

export interface TenantBusinessIdentityWriteClient {
  from(table: 'tenant_business_identities'): {
    upsert(
      value: TenantBusinessIdentityInput & { user_id: string },
      options: { onConflict: 'user_id' }
    ): {
      select(columns: string): { single(): PromiseLike<TenantBusinessIdentityQueryResult> };
    };
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_URL = /^https?:\/\/[^\s"'<>]+$/i;
const COLOR = /^#[0-9a-f]{6}$/i;

function string(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function validateTenantBusinessIdentity(input: TenantBusinessIdentityInput): TenantBusinessIdentityInput | null {
  const business_name = input.business_name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const logo_url = input.logo_url.trim();
  const primary_color = input.primary_color.trim();
  if (business_name.length < 1 || business_name.length > 200
    || phone.length > 50
    || email.length > 320 || (email !== '' && !EMAIL.test(email))
    || logo_url.length > 2048 || (logo_url !== '' && !LOGO_URL.test(logo_url))
    || (primary_color !== '' && !COLOR.test(primary_color))) return null;
  return { business_name, phone, email, logo_url, primary_color };
}

export function normalizeTenantBusinessIdentity(value: unknown, userIdInput: string): TenantBusinessIdentity | null {
  const userId = userIdInput.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value) || !userId) return null;
  const row = value as Record<string, unknown>;
  if (string(row.user_id) !== userId || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') return null;
  const validated = validateTenantBusinessIdentity({
    business_name: string(row.business_name) ?? '',
    phone: string(row.phone) ?? '',
    email: string(row.email) ?? '',
    logo_url: string(row.logo_url) ?? '',
    primary_color: string(row.primary_color) ?? ''
  });
  return validated ? { user_id: userId, ...validated, created_at: row.created_at, updated_at: row.updated_at } : null;
}

export async function saveTenantBusinessIdentity(
  client: TenantBusinessIdentityWriteClient,
  authenticatedUserIdInput: string,
  input: TenantBusinessIdentityInput
): Promise<TenantBusinessIdentity | null> {
  const userId = authenticatedUserIdInput.trim();
  const validated = validateTenantBusinessIdentity(input);
  if (!userId || !validated) return null;
  try {
    const result = await client.from('tenant_business_identities').upsert(
      { user_id: userId, ...validated }, { onConflict: 'user_id' }
    ).select('user_id,business_name,phone,email,logo_url,primary_color,created_at,updated_at').single();
    if (result.error) return null;
    return normalizeTenantBusinessIdentity(result.data, userId);
  } catch {
    return null;
  }
}

export class TenantBusinessIdentityHydrator {
  private generation = 0;
  private current: TenantBusinessIdentity | null = null;

  constructor(private readonly getClient: () => Promise<TenantBusinessIdentityClient | null>) {}

  clear(): void {
    this.generation += 1;
    this.current = null;
  }

  value(): TenantBusinessIdentity | null {
    return this.current ? structuredClone(this.current) : null;
  }

  async hydrate(userIdInput: string): Promise<TenantBusinessIdentity | null> {
    const userId = userIdInput.trim();
    this.clear();
    const generation = this.generation;
    if (!userId) return null;
    try {
      const client = await this.getClient();
      if (!client) return null;
      const result = await client.from('tenant_business_identities').select(
        'user_id,business_name,phone,email,logo_url,primary_color,created_at,updated_at'
      ).eq('user_id', userId).limit(1).maybeSingle();
      if (generation !== this.generation || result.error) return null;
      const identity = result.data ? normalizeTenantBusinessIdentity(result.data, userId) : null;
      this.current = identity;
      return this.value();
    } catch {
      return null;
    }
  }
}
