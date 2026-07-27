import type { PublicSitePayload, PublicSiteSection } from '../supabase/functions/_shared/public_site_contract';

export type PublicSiteClientResult =
  | { state: 'success'; payload: PublicSitePayload; etag?: string }
  | { state: 'not-modified'; payload: PublicSitePayload; etag: string }
  | { state: 'not-found' }
  | { state: 'unavailable' }
  | { state: 'invalid-request' }
  | { state: 'configuration-failure' }
  | { state: 'network-failure' }
  | { state: 'aborted' }
  | { state: 'malformed-response' };

export interface GetPublicSitePayloadInput {
  endpoint: string;
  host: string;
  path: string;
  signal?: AbortSignal;
}

export type PublicSiteFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface PublicSiteCacheEntry {
  payload: PublicSitePayload;
  etag?: string;
}

const MAX_PUBLIC_PAYLOAD_BYTES = 2 * 1024 * 1024;
const publicSiteCache = new Map<string, PublicSiteCacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedHost(value: unknown): value is string {
  return nonblank(value)
    && value === value.trim().toLowerCase()
    && value.length <= 253
    && value.includes('.')
    && !/[\s\u0000-\u001f\u007f\/?#@:]/.test(value)
    && value.split('.').every(label => (
      label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ));
}

function normalizedPath(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && value.length <= 2048
    && !value.includes('//')
    && !value.includes('?')
    && !value.includes('#')
    && !value.includes('%')
    && !value.includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(value)
    && !value.split('/').some(segment => segment === '.' || segment === '..')
    && (value === '/' || !value.endsWith('/'));
}

function validJsonRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function validSection(value: unknown): value is PublicSiteSection {
  if (!isRecord(value)) return false;
  return nonblank(value.id)
    && nonblank(value.type)
    && typeof value.order === 'number'
    && Number.isFinite(value.order)
    && validJsonRecord(value.content)
    && validJsonRecord(value.styles)
    && (value.variant === undefined || typeof value.variant === 'string')
    && !('user_id' in value)
    && !('created_by' in value)
    && !('published_by' in value);
}

const FORBIDDEN_TOP_LEVEL_FIELDS = [
  'user_id', 'created_by', 'published_by', 'build_brief', 'revisions', 'history',
  'revisionHistory', 'serviceRoleKey'
] as const;

function validatePublicSitePayload(value: unknown): value is PublicSitePayload {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (FORBIDDEN_TOP_LEVEL_FIELDS.some(field => field in value)) return false;
  if (!normalizedHost(value.requestedHost) || !normalizedPath(value.requestedPath)) return false;
  if (!isRecord(value.website) || !nonblank(value.website.id) || !nonblank(value.website.name)) return false;
  if ('user_id' in value.website) return false;
  if (!isRecord(value.route)
    || !nonblank(value.route.id)
    || value.route.websiteId !== value.website.id
    || !normalizedPath(value.route.path)
    || value.route.path !== value.requestedPath
    || !nonblank(value.route.funnelId)) return false;
  if (!isRecord(value.settings) || !nonblank(value.settings.businessName) || 'build_brief' in value.settings) return false;
  if (!isRecord(value.layout) || !isRecord(value.layout.header) || !isRecord(value.layout.footer)) return false;
  if (!Array.isArray(value.layout.header.navigation) || !Array.isArray(value.layout.footer.links)) return false;
  if (!isRecord(value.page)
    || !nonblank(value.page.id)
    || !nonblank(value.page.name)
    || !nonblank(value.page.slug)
    || value.page.path !== value.requestedPath
    || 'user_id' in value.page) return false;
  if (!Array.isArray(value.sections) || !value.sections.every(validSection)) return false;
  if (!isRecord(value.publication)
    || (value.publication.source !== 'revision' && value.publication.source !== 'legacy')
    || !nonblank(value.publication.fingerprint)) return false;
  return true;
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object') return value;
  if (visited.has(value as object)) return value;
  visited.add(value as object);
  Reflect.ownKeys(value as object).forEach(key => {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], visited);
  });
  return Object.freeze(value);
}

function immutablePayload(payload: PublicSitePayload): PublicSitePayload {
  return deepFreeze(deepClone(payload));
}

function normalizeEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function cacheKey(endpoint: string, host: string, path: string): string {
  return JSON.stringify([endpoint, host, path]);
}

function validEtag(value: string | null): value is string {
  return value !== null && /^(?:W\/)?"[^"\r\n]+"$/.test(value);
}

export function clearPublicSitePayloadCache(): void {
  publicSiteCache.clear();
}

export function clearPublicSitePayloadCacheEntry(input: GetPublicSitePayloadInput): void {
  const endpoint = normalizeEndpoint(input.endpoint);
  if (!endpoint) return;
  publicSiteCache.delete(cacheKey(endpoint, input.host.trim().toLowerCase(), input.path));
}

export async function getPublicSitePayload(
  fetcher: PublicSiteFetcher,
  input: GetPublicSitePayloadInput
): Promise<PublicSiteClientResult> {
  const endpoint = normalizeEndpoint(input.endpoint);
  const host = input.host.trim().toLowerCase();
  const path = input.path;
  if (!endpoint || !normalizedHost(host) || !normalizedPath(path)) {
    return { state: 'configuration-failure' };
  }

  const key = cacheKey(endpoint, host, path);
  const cached = publicSiteCache.get(key);
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ host, path }).toString();
  const headers = new Headers({ Accept: 'application/json' });
  if (cached?.etag) headers.set('If-None-Match', cached.etag);

  let result: Response;
  try {
    result = await fetcher(url, {
      method: 'GET',
      credentials: 'omit',
      headers,
      ...(input.signal ? { signal: input.signal } : {})
    });
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError'
      ? { state: 'aborted' }
      : { state: 'network-failure' };
  }

  if (result.status === 304) {
    return cached?.etag
      ? { state: 'not-modified', payload: cached.payload, etag: cached.etag }
      : { state: 'malformed-response' };
  }
  if (result.status === 400) return { state: 'invalid-request' };
  if (result.status === 404) return { state: 'not-found' };
  if (result.status === 503) return { state: 'unavailable' };
  if (result.status !== 200) return { state: 'unavailable' };

  const contentType = result.headers.get('Content-Type')?.toLowerCase() || '';
  if (!contentType.startsWith('application/json')) return { state: 'malformed-response' };
  const contentLength = Number(result.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_PUBLIC_PAYLOAD_BYTES) {
    return { state: 'malformed-response' };
  }
  const etagHeader = result.headers.get('ETag');
  if (etagHeader !== null && !validEtag(etagHeader)) return { state: 'malformed-response' };

  let text: string;
  try {
    text = await result.text();
  } catch {
    return { state: 'malformed-response' };
  }
  if (new TextEncoder().encode(text).byteLength > MAX_PUBLIC_PAYLOAD_BYTES) {
    return { state: 'malformed-response' };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    return { state: 'malformed-response' };
  }
  if (!validatePublicSitePayload(candidate)) return { state: 'malformed-response' };
  if (candidate.requestedHost !== host || candidate.requestedPath !== path) {
    return { state: 'malformed-response' };
  }

  const payload = immutablePayload(candidate);
  publicSiteCache.set(key, { payload, ...(etagHeader ? { etag: etagHeader } : {}) });
  return { state: 'success', payload, ...(etagHeader ? { etag: etagHeader } : {}) };
}
