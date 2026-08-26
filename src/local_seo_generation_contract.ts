export const LOCAL_SEO_GENERATION_LIMITS = {
  services: 12,
  cities: 12,
  service: 80,
  city: 120,
  combinations: 48,
  idempotencyKey: 128
} as const;

export interface LocalSeoGenerationInput {
  website_id: string;
  services: string[];
  cities: string[];
}

export interface LocalSeoDraftPage {
  service: string;
  city: string;
  path: string;
  funnel_id: string;
  page_id: string;
}

export type LocalSeoGenerationResponse =
  | { success: true; data: { website_id: string; created_count: number; replayed: boolean; pages: LocalSeoDraftPage[] } }
  | { success: false; error: { code: LocalSeoGenerationErrorCode; message: string; fields?: Record<string, string> } };

export type LocalSeoGenerationErrorCode = 'INVALID_INPUT' | 'INVALID_IDEMPOTENCY_KEY' | 'METHOD_NOT_ALLOWED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'CONFIGURATION_ERROR' | 'UPSTREAM_UNAVAILABLE';

const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function validateLocalSeoGenerationInput(value: unknown): { success: true; data: LocalSeoGenerationInput } | { success: false; fields: Record<string, string> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, fields: { request: 'Send a JSON object.' } };
  const raw = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  if (Object.keys(raw).some(key => !['website_id', 'services', 'cities'].includes(key))) fields.request = 'Request contains unsupported fields.';
  const website_id = text(raw.website_id);
  if (!uuid(website_id)) fields.website_id = 'Select a valid website.';
  const normalizeList = (input: unknown, limit: number, itemLimit: number, field: string) => {
    if (!Array.isArray(input) || input.length < 1 || input.length > limit) { fields[field] = `Provide between 1 and ${limit} values.`; return []; }
    const values = input.map(text).filter(Boolean);
    const canonical = Array.from(new Set(values.map(item => item.toLocaleLowerCase()).filter(Boolean))).map(key => values.find(value => value.toLocaleLowerCase() === key)!);
    if (values.length !== input.length || canonical.length !== values.length) fields[field] = 'Values must be unique, non-empty text.';
    if (canonical.some(item => item.length > itemLimit)) fields[field] = `Each value must be ${itemLimit} characters or fewer.`;
    return canonical;
  };
  const services = normalizeList(raw.services, LOCAL_SEO_GENERATION_LIMITS.services, LOCAL_SEO_GENERATION_LIMITS.service, 'services');
  const cities = normalizeList(raw.cities, LOCAL_SEO_GENERATION_LIMITS.cities, LOCAL_SEO_GENERATION_LIMITS.city, 'cities');
  if (services.length * cities.length > LOCAL_SEO_GENERATION_LIMITS.combinations) fields.request = `Generate no more than ${LOCAL_SEO_GENERATION_LIMITS.combinations} pages at once.`;
  return Object.keys(fields).length ? { success: false, fields } : { success: true, data: { website_id, services, cities } };
}

export function isValidLocalSeoIdempotencyKey(value: string): boolean {
  return value.length >= 16 && value.length <= LOCAL_SEO_GENERATION_LIMITS.idempotencyKey && /^[A-Za-z0-9._:-]+$/.test(value);
}

export function isLocalSeoGenerationResponse(value: unknown): value is LocalSeoGenerationResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (data.success === false) {
    if (!data.error || typeof data.error !== 'object' || Array.isArray(data.error)) return false;
    const error = data.error as Record<string, unknown>;
    const codes: LocalSeoGenerationErrorCode[] = ['INVALID_INPUT', 'INVALID_IDEMPOTENCY_KEY', 'METHOD_NOT_ALLOWED', 'UNAUTHORIZED', 'NOT_FOUND', 'CONFLICT', 'CONFIGURATION_ERROR', 'UPSTREAM_UNAVAILABLE'];
    if (typeof error.code !== 'string' || !codes.includes(error.code as LocalSeoGenerationErrorCode) || typeof error.message !== 'string' || !error.message.trim()) return false;
    return error.fields === undefined || (!!error.fields && typeof error.fields === 'object' && !Array.isArray(error.fields) && Object.values(error.fields).every(field => typeof field === 'string'));
  }
  if (data.success !== true || !data.data || typeof data.data !== 'object') return false;
  const payload = data.data as Record<string, unknown>;
  const createdCount = payload.created_count;
  if (typeof createdCount !== 'number' || typeof payload.website_id !== 'string' || !uuid(payload.website_id) || !Number.isInteger(createdCount) || createdCount < 0 || typeof payload.replayed !== 'boolean' || !Array.isArray(payload.pages) || createdCount !== payload.pages.length) return false;
  return payload.pages.every(page => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) return false;
    const item = page as Record<string, unknown>;
    return ['service', 'city', 'path', 'funnel_id', 'page_id'].every(key => typeof item[key] === 'string' && (item[key] as string).trim().length > 0)
      && typeof item.path === 'string' && item.path.startsWith('/');
  });
}
