import type {
  PublicLeadAcceptedResponse,
  PublicLeadCreateInput,
  PublicLeadFieldValue,
  PublicLeadNormalizedFields,
  PublicLeadSubmissionRequest
} from './public_lead_contract.ts';
import type { PublicLeadDataSource } from './public_lead_data_source.ts';
import type { PublicLegacySectionRecord } from './public_site_data_source.ts';
import {
  isPublicSectionVisible,
  normalizePublicHost,
  normalizePublicPath,
  validatePublishedRevisionDocument
} from './public_site_handler.ts';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_COUNT = 30;
const MAX_NORMALIZED_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const ACCEPTED_MESSAGE = 'Thanks! Your request has been received.';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin'
} as const;

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
} as const;

export interface PublicLeadLogEvent {
  requestId: string;
  outcome: string;
  host?: string;
  path?: string;
  code?: string;
}

export interface PublicLeadLogger {
  info(event: PublicLeadLogEvent): void;
  error(event: PublicLeadLogEvent): void;
}

export interface PublicLeadHandlerOptions {
  dataSource: PublicLeadDataSource;
  hashSecret: string;
  configurationAvailable?: boolean;
  allowDevelopmentHosts?: boolean;
  logger?: PublicLeadLogger;
  requestIdFactory?: () => string;
  sourceIp?: (request: Request) => string;
}

type FieldKind = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'boolean';
interface TrustedField {
  name: string;
  kind: FieldKind;
  required: boolean;
  maxLength: number;
  options?: readonly string[];
}

const KNOWN_FIELDS: Readonly<Record<string, Omit<TrustedField, 'name'>>> = {
  name: { kind: 'text', required: true, maxLength: 150 },
  email: { kind: 'email', required: true, maxLength: 254 },
  phone: { kind: 'phone', required: true, maxLength: 50 },
  address: { kind: 'text', required: true, maxLength: 300 },
  service_type: {
    kind: 'select', required: true, maxLength: 300,
    options: ['Driveway Cleaning', 'House Washing', 'Roof Cleaning', 'Gutter Cleaning', 'Commercial Cleaning', 'Other']
  },
  message: { kind: 'textarea', required: false, maxLength: 5000 },
  consent: { kind: 'boolean', required: true, maxLength: 0 }
};

const silentLogger: PublicLeadLogger = { info: () => undefined, error: () => undefined };

function response(body: unknown, status: number, extra?: HeadersInit): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extra }
  });
}

function failure(message: string, status: number, extra?: HeadersInit): Response {
  return response({ status: 'error', message }, status, extra);
}

function accepted(status = 201, replayed = false): Response {
  const body: PublicLeadAcceptedResponse = {
    status: 'accepted', message: ACCEPTED_MESSAGE, ...(replayed ? { replayed: true } : {})
  };
  return response(body, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized) ? null : normalized;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map(key => `${JSON.stringify(key)}:${stableJson(source[key])}`).join(',')}}`;
}

function bytes(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).slice().buffer as ArrayBuffer;
}

function hex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPublicLeadRequestFingerprint(value: unknown): Promise<string> {
  return `sha256:${hex(await crypto.subtle.digest('SHA-256', bytes(stableJson(value))))}`;
}

export async function createPublicLeadHmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `hmac-sha256:${hex(await crypto.subtle.sign('HMAC', key, bytes(value)))}`;
}

function optionsFrom(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.flatMap(option => {
    if (typeof option === 'string' && option.trim()) return [option.trim()];
    if (isRecord(option)) {
      const candidate = safeText(option.value) ?? safeText(option.label);
      return candidate ? [candidate] : [];
    }
    return [];
  });
  return result.length ? [...new Set(result)] : undefined;
}

function trustedFields(content: Record<string, unknown>): readonly TrustedField[] | null {
  const source = content.fields;
  if (!Array.isArray(source) || source.length === 0 || source.length > MAX_FIELD_COUNT) return null;
  const fields: TrustedField[] = [];
  for (const entry of source) {
    if (typeof entry === 'string') {
      const known = KNOWN_FIELDS[entry];
      if (!known) return null;
      fields.push({ name: entry, ...known });
      continue;
    }
    if (!isRecord(entry)) return null;
    const name = safeText(entry.name) ?? safeText(entry.id);
    const kind = safeText(entry.type) as FieldKind | null;
    if (!name || !FIELD_NAME.test(name) || !kind || !['text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'boolean'].includes(kind)) {
      return null;
    }
    const known = KNOWN_FIELDS[name];
    const options = optionsFrom(entry.options ?? entry.choices);
    if ((kind === 'select' || kind === 'radio') && !options?.length) return null;
    const configuredMax = Number(entry.maxLength ?? entry.max_length);
    const ceiling = kind === 'textarea' ? 5000 : name === 'email' ? 254 : name === 'phone' ? 50 : name === 'address' ? 300 : 300;
    fields.push({
      name,
      kind,
      required: typeof entry.required === 'boolean' ? entry.required : known?.required ?? false,
      maxLength: Number.isInteger(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, ceiling) : known?.maxLength ?? ceiling,
      ...(options ? { options } : {})
    });
  }
  return new Set(fields.map(field => field.name)).size === fields.length ? fields : null;
}

function normalizeEmail(value: string): string | null {
  if (!value) return '';
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1 || value.includes(' ') || value.indexOf('@') !== at) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (local.length > 64 || domain.length > 253 || !domain.includes('.') || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
  return `${local}@${domain}`;
}

function normalizePhone(value: string): { display: string; match: string } | null {
  if (!value) return { display: '', match: '' };
  if (!/^[+()\-\.\s\dextEXT#]+$/.test(value)) return null;
  const main = value.split(/(?:ext\.?|x|#)/i, 1)[0];
  const digits = main.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return { display: value, match: digits };
}

function normalizeFields(fields: Record<string, unknown>, schema: readonly TrustedField[]): PublicLeadNormalizedFields | null {
  if (Object.keys(fields).length > MAX_FIELD_COUNT) return null;
  const allowed = new Map(schema.map(field => [field.name, field]));
  if (Object.keys(fields).some(name => !allowed.has(name))) return null;
  const values: Record<string, PublicLeadFieldValue> = {};
  for (const definition of schema) {
    const raw = fields[definition.name];
    if (definition.kind === 'boolean' || definition.kind === 'checkbox') {
      if (raw === undefined && !definition.required) continue;
      if (typeof raw !== 'boolean' || (definition.required && raw !== true)) return null;
      values[definition.name] = raw;
      continue;
    }
    if (raw === undefined && !definition.required) continue;
    const value = safeText(raw);
    if (value === null || (definition.required && !value) || value.length > definition.maxLength) return null;
    if ((definition.kind === 'select' || definition.kind === 'radio') && !definition.options?.includes(value)) return null;
    values[definition.name] = value;
  }
  const email = normalizeEmail(typeof values.email === 'string' ? values.email : '');
  const phone = normalizePhone(typeof values.phone === 'string' ? values.phone : '');
  if (email === null || phone === null || (!email && !phone.match)) return null;
  if (email) values.email = email;
  if (new TextEncoder().encode(stableJson(values)).byteLength > MAX_NORMALIZED_BYTES) return null;
  return {
    name: typeof values.name === 'string' ? values.name : '',
    email: email || '',
    phone: phone.display,
    phoneMatch: phone.match,
    address: typeof values.address === 'string' ? values.address : '',
    service: typeof values.service_type === 'string' ? values.service_type : '',
    message: typeof values.message === 'string' ? values.message : '',
    values
  };
}

function parseRequest(value: unknown): PublicLeadSubmissionRequest | null {
  if (!isRecord(value)) return null;
  const allowed = new Set(['host', 'path', 'formSectionId', 'idempotencyKey', 'fields', 'startedAt', 'elapsedMs', 'honeypot']);
  if (Object.keys(value).some(key => !allowed.has(key))) return null;
  if (typeof value.host !== 'string' || typeof value.path !== 'string'
    || typeof value.formSectionId !== 'string' || !value.formSectionId.trim() || value.formSectionId.length > 200
    || typeof value.idempotencyKey !== 'string' || !UUID.test(value.idempotencyKey)
    || !isRecord(value.fields)) return null;
  if (value.honeypot !== undefined && typeof value.honeypot !== 'string') return null;
  if (value.startedAt !== undefined && (typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt)))) return null;
  if (value.elapsedMs !== undefined && (typeof value.elapsedMs !== 'number' || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0)) return null;
  return value as unknown as PublicLeadSubmissionRequest;
}

function forwardedIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('cf-connecting-ip')?.trim() || 'unavailable';
}

function legacySectionRecord(section: PublicLegacySectionRecord): Record<string, unknown> {
  return {
    id: section.id, page_id: section.pageId, type: section.type, order: section.order,
    content: section.content, styles: section.styles
  };
}

function resolvedForm(section: Record<string, unknown>, pageId: string, sectionId: string): Record<string, unknown> | null {
  if (section.id !== sectionId || section.page_id !== pageId || section.type !== 'form') return null;
  if (!isRecord(section.content) || !isRecord(section.styles)) return null;
  if (!isPublicSectionVisible(section, section.styles)) return null;
  return section;
}

export async function handlePublicLeadRequest(request: Request, options: PublicLeadHandlerOptions): Promise<Response> {
  const logger = options.logger ?? silentLogger;
  const requestId = options.requestIdFactory?.() ?? crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return failure('Method not allowed.', 405, { Allow: 'POST, OPTIONS' });
  if (options.configurationAvailable === false || options.hashSecret.length < 32) {
    logger.error({ requestId, outcome: 'configuration-unavailable' });
    return failure('We could not submit your request right now. Please try again.', 503);
  }
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) return failure('Unsupported media type.', 415);
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return failure('Request is too large.', 413);

  let raw: string;
  try { raw = await request.text(); } catch { return failure('Please check the form and try again.', 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return failure('Request is too large.', 413);
  let candidate: unknown;
  try { candidate = JSON.parse(raw); } catch { return failure('Please check the form and try again.', 400); }
  const submission = parseRequest(candidate);
  if (!submission) return failure('Please check the form and try again.', 400);
  const host = normalizePublicHost(submission.host, options.allowDevelopmentHosts);
  const path = normalizePublicPath(submission.path);
  if (!host || !path) return failure('Please check the form and try again.', 400);
  if (submission.honeypot?.trim()) {
    logger.info({ requestId, host, path, outcome: 'discarded' });
    return accepted(202);
  }

  try {
    const website = await options.dataSource.findWebsiteByHost(host);
    if (!website) return failure('This form is not available.', 404);
    const route = await options.dataSource.findRouteForWebsite(website.id, path);
    if (!route || route.websiteId !== website.id || route.path !== path) return failure('This form is not available.', 404);
    if (path === '/' && website.homepageFunnelId !== route.funnelId) return failure('This form is not available.', 404);
    const page = await options.dataSource.findPageForRoute(website, route, path);
    if (!page || page.ownerId !== website.ownerId || page.funnelId !== route.funnelId) return failure('This form is not available.', 404);

    const target = await options.dataSource.getPublicationTarget(website.id, page.id);
    let section: Record<string, unknown> | null = null;
    if (target) {
      if (target.websiteId !== website.id || target.pageId !== page.id) return failure('This form is not available.', 503);
      const revision = await options.dataSource.getRevisionById(target.publishedRevisionId, website.id, page.id);
      const document = revision ? validatePublishedRevisionDocument(revision, website.id, page.id) : null;
      if (!document) return failure('This form is not available.', 503);
      const match = document.sections.find(item => item.id === submission.formSectionId);
      section = match ? resolvedForm(match, page.id, submission.formSectionId) : null;
    } else {
      if (page.status !== 'published') return failure('This form is not available.', 404);
      const legacy = await options.dataSource.getLegacySections(page.id);
      const match = legacy.find(item => item.id === submission.formSectionId);
      section = match ? resolvedForm(legacySectionRecord(match), page.id, submission.formSectionId) : null;
    }
    if (!section) return failure('This form is not available.', 404);
    const schema = trustedFields(section.content as Record<string, unknown>);
    const normalized = schema ? normalizeFields(submission.fields, schema) : null;
    if (!normalized) return failure('Please check the form and try again.', 400);

    const fingerprint = await createPublicLeadRequestFingerprint({
      websiteId: website.id, pageId: page.id, formSectionId: submission.formSectionId,
      fields: normalized.values
    });
    const sourceIp = options.sourceIp?.(request) ?? forwardedIp(request);
    const ipHash = await createPublicLeadHmac(options.hashSecret, `ip:${sourceIp}`);
    const contactIdentity = [normalized.email.toLowerCase(), normalized.phoneMatch].filter(Boolean).sort().join('|');
    const input: PublicLeadCreateInput = {
      websiteId: website.id,
      ownerId: website.ownerId,
      pageId: page.id,
      formSectionId: submission.formSectionId,
      routeFunnelId: route.funnelId,
      idempotencyKey: submission.idempotencyKey,
      requestFingerprint: fingerprint,
      ipHash,
      ...(contactIdentity ? { contactHash: await createPublicLeadHmac(options.hashSecret, `contact:${contactIdentity}`) } : {}),
      fields: normalized
    };
    const result = await options.dataSource.createLead(input);
    if (result.outcome === 'accepted') {
      logger.info({ requestId, host, path, outcome: result.replayed ? 'replayed' : 'accepted' });
      return accepted(result.replayed ? 200 : 201, result.replayed);
    }
    if (result.outcome === 'conflict') return failure('This request has already been submitted with different information.', 409);
    if (result.outcome === 'rate_limited') {
      return failure('Too many requests. Please try again later.', 429, { 'Retry-After': String(result.retryAfterSeconds) });
    }
    return failure('This form is not available.', 503);
  } catch {
    logger.error({ requestId, host, path, outcome: 'internal-error' });
    return failure('We could not submit your request right now. Please try again.', 500);
  }
}
