import type { Funnel, Page, PageSection, Website, WebsiteRoute, WebsiteSettings } from './types';

export const WEBSITE_GENERATION_LIMITS = {
  businessName: 120,
  phoneNumber: 40,
  city: 120,
  services: 12,
  service: 80,
  idempotencyKey: 128
} as const;

export interface WebsiteGenerationInput {
  business_name: string;
  phone_number: string;
  city: string;
  services: string[];
}

export interface WebsiteGenerationData {
  website: Website;
  settings: WebsiteSettings;
  route: WebsiteRoute;
  funnel: Funnel;
  page: Page;
  sections: PageSection[];
  created: boolean;
  idempotency_key: string;
}

export type WebsiteGenerationErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'CONFIGURATION_ERROR'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type WebsiteGenerationResponse =
  | { success: true; data: WebsiteGenerationData }
  | {
      success: false;
      error: {
        code: WebsiteGenerationErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };

export type WebsiteGenerationValidationResult =
  | { success: true; data: WebsiteGenerationInput }
  | { success: false; fields: Record<string, string> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validateWebsiteGenerationInput(value: unknown): WebsiteGenerationValidationResult {
  if (!isPlainObject(value)) return { success: false, fields: { request: 'Send a JSON object.' } };
  const allowed = new Set(['business_name', 'phone_number', 'city', 'services']);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  const fields: Record<string, string> = {};
  if (unknown.length) fields.request = `Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`;

  const businessName = normalizeText(value.business_name);
  const phoneNumber = normalizeText(value.phone_number);
  const city = normalizeText(value.city);
  if (!businessName) fields.business_name = 'Enter a business name.';
  else if (businessName.length > WEBSITE_GENERATION_LIMITS.businessName) fields.business_name = `Use ${WEBSITE_GENERATION_LIMITS.businessName} characters or fewer.`;
  if (!phoneNumber) fields.phone_number = 'Enter a phone number.';
  else if (phoneNumber.length > WEBSITE_GENERATION_LIMITS.phoneNumber) fields.phone_number = `Use ${WEBSITE_GENERATION_LIMITS.phoneNumber} characters or fewer.`;
  else if (!/^[+()\-\.\s\d]{7,40}$/.test(phoneNumber)) fields.phone_number = 'Enter a valid phone number.';
  if (!city) fields.city = 'Enter a service city.';
  else if (city.length > WEBSITE_GENERATION_LIMITS.city) fields.city = `Use ${WEBSITE_GENERATION_LIMITS.city} characters or fewer.`;

  if (!Array.isArray(value.services)) {
    fields.services = 'Choose at least one service.';
  } else if (value.services.length < 1 || value.services.length > WEBSITE_GENERATION_LIMITS.services) {
    fields.services = `Choose between 1 and ${WEBSITE_GENERATION_LIMITS.services} services.`;
  }
  const services = Array.isArray(value.services)
    ? Array.from(new Set(value.services.map(normalizeText).filter(Boolean)))
    : [];
  if (services.some(service => service.length > WEBSITE_GENERATION_LIMITS.service)) {
    fields.services = `Each service must be ${WEBSITE_GENERATION_LIMITS.service} characters or fewer.`;
  } else if (Array.isArray(value.services) && services.length !== value.services.length) {
    fields.services = 'Services must be unique, non-empty text values.';
  }
  return Object.keys(fields).length
    ? { success: false, fields }
    : { success: true, data: { business_name: businessName, phone_number: phoneNumber, city, services } };
}

export function isValidWebsiteGenerationIdempotencyKey(value: string): boolean {
  return value.length >= 16
    && value.length <= WEBSITE_GENERATION_LIMITS.idempotencyKey
    && /^[A-Za-z0-9._:-]+$/.test(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && value[key] !== '';
}

function hasNullableString(value: Record<string, unknown>, key: string): boolean {
  return value[key] === null || typeof value[key] === 'string';
}

function isWebsite(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'user_id', 'name', 'subdomain', 'created_at', 'updated_at'].every(key => hasString(value, key))
    && hasNullableString(value, 'domain')
    && hasNullableString(value, 'homepage_funnel_id');
}

function isSettings(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'user_id', 'website_id', 'business_name', 'created_at'].every(key => hasString(value, key))
    && ['phone', 'email', 'logo_url', 'primary_color', 'auto_lead_sms_template', 'missed_call_sms_template'].every(key => typeof value[key] === 'string')
    && typeof value.auto_lead_sms_enabled === 'boolean'
    && typeof value.missed_call_sms_enabled === 'boolean';
}

function isRoute(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'website_id', 'path', 'funnel_id', 'created_at'].every(key => hasString(value, key))
    && value.path === '/';
}

function isFunnel(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'user_id', 'name', 'created_at', 'updated_at'].every(key => hasString(value, key))
    && (value.status === 'draft' || value.status === 'published');
}

function isPage(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'user_id', 'name', 'slug', 'seo_title', 'seo_description', 'created_at', 'funnel_id'].every(key => hasString(value, key))
    && (value.status === 'draft' || value.status === 'published')
    && Array.isArray(value.seo_keywords)
    && value.seo_keywords.every(keyword => typeof keyword === 'string');
}

function isSection(value: unknown): boolean {
  return isPlainObject(value)
    && ['id', 'page_id', 'type'].every(key => hasString(value, key))
    && isPlainObject(value.content)
    && typeof value.order === 'number'
    && Number.isInteger(value.order)
    && isPlainObject(value.styles);
}

export function isWebsiteGenerationResponse(value: unknown): value is WebsiteGenerationResponse {
  if (!isPlainObject(value) || typeof value.success !== 'boolean') return false;
  if (!value.success) {
    return isPlainObject(value.error) && hasString(value.error, 'code') && hasString(value.error, 'message');
  }
  if (!isPlainObject(value.data)) return false;
  const data = value.data;
  if (typeof data.created !== 'boolean' || !hasString(data, 'idempotency_key')) return false;
  return isWebsite(data.website)
    && isSettings(data.settings)
    && isRoute(data.route)
    && isFunnel(data.funnel)
    && isPage(data.page)
    && Array.isArray(data.sections)
    && data.sections.length > 0
    && data.sections.every(isSection);
}
