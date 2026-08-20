import type {
  PublicSiteFooter,
  PublicSiteHeader,
  PublicSiteLayout,
  PublicSiteNavigationItem,
  PublicSitePage,
  PublicSitePayload,
  PublicSiteSection,
  PublicSiteSettings,
  PublicSiteWebsite
} from './public_site_contract.ts';
import type {
  PublicLegacySectionRecord,
  PublicPageRecord,
  PublicPublishedRevisionRecord,
  PublicSiteDataSource,
  PublicWebsiteLayoutRecord,
  PublicWebsiteSettingsRecord
} from './public_site_data_source.ts';
import { PublicSiteDataSourceError } from './public_site_data_source.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
  'X-Content-Type-Options': 'nosniff'
} as const;

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8'
} as const;

export interface PublicSiteLogger {
  info(event: PublicSiteLogEvent): void;
  error(event: PublicSiteLogEvent): void;
}

export interface PublicSiteLogEvent {
  requestId: string;
  outcome: string;
  host?: string;
  path?: string;
  code?: string;
}

export interface PublicSiteHandlerOptions {
  dataSource: PublicSiteDataSource;
  logger?: PublicSiteLogger;
  allowDevelopmentHosts?: boolean;
  configurationAvailable?: boolean;
  requestIdFactory?: () => string;
  serializePayload?: (payload: PublicSitePayload) => string;
}

export interface BuilderDocumentCandidate {
  schemaVersion: 1;
  page: Record<string, unknown> & { id: string };
  sections: Array<Record<string, unknown>>;
}

const silentLogger: PublicSiteLogger = { info: () => undefined, error: () => undefined };

function response(body: unknown, status: number, cacheControl = 'no-store', extra?: HeadersInit): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, 'Cache-Control': cacheControl, ...extra }
  });
}

function publicError(message: string, status: number, extra?: HeadersInit): Response {
  return response({ error: message }, status, 'no-store', extra);
}

export function normalizePublicHost(
  input: string | null,
  allowDevelopmentHosts = false
): string | null {
  if (input === null) return null;
  let host = input.trim().toLowerCase();
  if (!host || host.length > 259 || /[\u0000-\u0020\u007f]/.test(host)) return null;
  if (host.includes('://') || /[\/?#@]/.test(host)) return null;

  const portMatch = /^(.*):(\d{1,5})$/.exec(host);
  if (portMatch) {
    const port = Number(portMatch[2]);
    if (port < 1 || port > 65535) return null;
    host = portMatch[1];
  } else if (host.includes(':')) {
    return null;
  }

  host = host.replace(/\.$/, '');
  if (!host || host.length > 253) return null;

  const isDevelopment = host === 'localhost'
    || host.endsWith('.localhost')
    || /^127(?:\.\d{1,3}){3}$/.test(host);
  if (isDevelopment) {
    if (!allowDevelopmentHosts) return null;
    if (host.startsWith('127.') && host.split('.').some(part => Number(part) > 255)) return null;
    return host;
  }

  if (!host.includes('.')) return null;
  const labels = host.split('.');
  if (labels.some(label => (
    !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ))) return null;
  return host;
}

export function normalizePublicPath(input: string | null): string | null {
  if (input === null || !input.trim()) return '/';
  const raw = input.trim();
  if (raw.length > 2048 || !raw.startsWith('/') || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw.includes('://') || raw.includes('?') || raw.includes('#') || raw.includes('\\')) return null;

  const normalizedSegments: string[] = [];
  for (const encodedSegment of raw.split('/')) {
    if (!encodedSegment) continue;
    let segment: string;
    try {
      segment = decodeURIComponent(encodedSegment);
    } catch {
      return null;
    }
    if (!segment || segment === '.' || segment === '..') return null;
    if (/[\/\\\u0000-\u001f\u007f]/.test(segment)) return null;
    normalizedSegments.push(segment);
  }
  return normalizedSegments.length ? `/${normalizedSegments.join('/')}` : '/';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(value: unknown, path = 'value'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite JSON number at ${path}.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => cloneJsonValue(item, `${path}[${index}]`));
  if (isPlainRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) clone[key] = cloneJsonValue(item, `${path}.${key}`);
    return clone;
  }
  throw new Error(`Unsupported public JSON value at ${path}.`);
}

function cloneRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new Error(`Expected object at ${path}.`);
  return cloneJsonValue(value, path) as Record<string, unknown>;
}

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): T {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (visited.has(value as object)) return value;
  visited.add(value as object);
  Reflect.ownKeys(value as object).forEach(key => {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], visited);
  });
  return Object.freeze(value);
}

function stableSerialize(value: unknown, ancestors = new WeakSet<object>(), path = 'payload'): string {
  if (value === null) return 'null;';
  if (value === undefined) return 'undefined;';
  switch (typeof value) {
    case 'boolean': return value ? 'boolean:true;' : 'boolean:false;';
    case 'string': return `string:${JSON.stringify(value)};`;
    case 'number':
      if (Number.isNaN(value)) return 'number:NaN;';
      if (value === Infinity) return 'number:Infinity;';
      if (value === -Infinity) return 'number:-Infinity;';
      if (Object.is(value, -0)) return 'number:-0;';
      return `number:${String(value)};`;
    case 'object': {
      const objectValue = value as object;
      if (ancestors.has(objectValue)) throw new Error(`Circular structure at ${path}.`);
      ancestors.add(objectValue);
      try {
        if (Array.isArray(value)) {
          return `array:[${value.map((item, index) => stableSerialize(item, ancestors, `${path}[${index}]`)).join('')}]`;
        }
        if (!isPlainRecord(value)) throw new Error(`Unsupported object at ${path}.`);
        return `object:{${Object.keys(value).sort().map(key => (
          `${JSON.stringify(key)}:${stableSerialize(value[key], ancestors, `${path}.${key}`)}`
        )).join('')}}`;
      } finally {
        ancestors.delete(objectValue);
      }
    }
    default: throw new Error(`Unsupported ${typeof value} at ${path}.`);
  }
}

function hashStable(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${serialized.length.toString(36)}`;
}

function createDocumentFingerprint(document: BuilderDocumentCandidate): string {
  const normalized = {
    ...document,
    sections: document.sections.map((section, inputIndex) => ({ section, inputIndex }))
      .sort((left, right) => {
        const leftOrder = left.section.order;
        const rightOrder = right.section.order;
        const leftFinite = typeof leftOrder === 'number' && Number.isFinite(leftOrder);
        const rightFinite = typeof rightOrder === 'number' && Number.isFinite(rightOrder);
        if (leftFinite && rightFinite && leftOrder !== rightOrder) return leftOrder - rightOrder;
        if (leftFinite !== rightFinite) return leftFinite ? -1 : 1;
        return left.inputIndex - right.inputIndex;
      }).map(entry => entry.section)
  };
  return hashStable(normalized);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function sanitizeNavigation(value: unknown): readonly PublicSiteNavigationItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!isPlainRecord(item)) return [];
    const label = optionalText(item.label);
    const path = optionalText(item.path) ?? optionalText(item.url) ?? optionalText(item.href);
    if (!label || !path) return [];
    return [{
      label,
      path,
      ...(typeof item.visible === 'boolean' ? { visible: item.visible } : {}),
      ...(item.is_cta === true || item.isCta === true ? { isCta: true } : {}),
      ...(Array.isArray(item.children) ? { children: sanitizeNavigation(item.children) } : {})
    }];
  });
}

function sanitizeCanonicalNavigation(
  rawItems: unknown[],
  liveRoutes: readonly PublicWebsiteRouteRecord[]
): readonly PublicSiteNavigationItem[] {
  if (!Array.isArray(rawItems)) return [];
  const result: PublicSiteNavigationItem[] = [];

  for (const item of rawItems) {
    if (!isPlainRecord(item)) continue;
    const visible = typeof item.visible === 'boolean' ? item.visible : true;
    if (!visible) continue;

    const label = optionalText(item.label);
    if (!label) continue;

    const targetKind = optionalText(item.target_kind);
    const targetValue = optionalText(item.target_value);
    const isCta = item.is_cta === true || item.isCta === true;

    let path: string | undefined;

    if (targetKind === 'homepage' || targetValue === '__homepage__') {
      path = '/';
    } else if (targetKind === 'internal' && targetValue) {
      const matchingRoute = liveRoutes.find(r => r.funnelId === targetValue);
      if (matchingRoute) {
        path = matchingRoute.path;
      }
    } else if (targetKind === 'external' && targetValue) {
      if (/^https?:\/\//i.test(targetValue)) {
        path = targetValue;
      }
    } else if (targetKind === 'phone' && targetValue) {
      path = `tel:${targetValue}`;
    } else if (targetKind === 'email' && targetValue) {
      path = `mailto:${targetValue}`;
    }

    if (path) {
      result.push({
        label,
        path,
        visible: true,
        ...(isCta ? { isCta: true } : {})
      });
    }
  }

  return result;
}

function sanitizeCanonicalFooterLinks(
  rawItems: unknown[],
  liveRoutes: readonly PublicWebsiteRouteRecord[]
): readonly PublicSiteFooterLink[] {
  if (!Array.isArray(rawItems)) return [];
  const result: PublicSiteFooterLink[] = [];

  for (const item of rawItems) {
    if (!isPlainRecord(item)) continue;
    const visible = typeof item.visible === 'boolean' ? item.visible : true;
    if (!visible) continue;

    const label = optionalText(item.label);
    if (!label) continue;

    const targetKind = optionalText(item.target_kind);
    const targetValue = optionalText(item.target_value);
    const isCta = item.is_cta === true || item.isCta === true;

    let path: string | undefined;

    if (targetKind === 'homepage' || targetValue === '__homepage__') {
      path = '/';
    } else if (targetKind === 'internal' && targetValue) {
      const matchingRoute = liveRoutes.find(r => r.funnelId === targetValue);
      if (matchingRoute) {
        path = matchingRoute.path;
      }
    } else if (targetKind === 'external' && targetValue) {
      if (/^https?:\/\//i.test(targetValue)) {
        path = targetValue;
      }
    } else if (targetKind === 'phone' && targetValue) {
      path = `tel:${targetValue}`;
    } else if (targetKind === 'email' && targetValue) {
      path = `mailto:${targetValue}`;
    }

    if (path) {
      result.push({
        label,
        path,
        ...(isCta ? { isCta: true } : {})
      });
    }
  }

  return result;
}

function sanitizeLayout(
  record: PublicWebsiteLayoutRecord | null,
  canonicalPrimaryNav?: PublicCanonicalNavigationRecord | null,
  canonicalFooterNav?: PublicCanonicalNavigationRecord | null,
  liveRoutes: readonly PublicWebsiteRouteRecord[] = []
): PublicSiteLayout {
  const rawHeader = isPlainRecord(record?.headerConfig) ? record.headerConfig : {};
  const rawFooter = isPlainRecord(record?.footerConfig) ? record.footerConfig : {};

  let navigation: readonly PublicSiteNavigationItem[];
  if (canonicalPrimaryNav !== null && canonicalPrimaryNav !== undefined) {
    navigation = sanitizeCanonicalNavigation(canonicalPrimaryNav.items, liveRoutes);
  } else {
    navigation = sanitizeNavigation(rawHeader.nav_items ?? rawHeader.navigation);
  }

  let links: readonly PublicSiteFooterLink[];
  if (canonicalFooterNav !== null && canonicalFooterNav !== undefined) {
    links = sanitizeCanonicalFooterLinks(canonicalFooterNav.items, liveRoutes);
  } else {
    links = Array.isArray(rawFooter.links) ? rawFooter.links.flatMap(item => {
      if (!isPlainRecord(item)) return [];
      const label = optionalText(item.label);
      const path = optionalText(item.path) ?? optionalText(item.url) ?? optionalText(item.href);
      return label && path ? [{ label, path }] : [];
    }) : [];
  }

  const header: PublicSiteHeader = {
    ...(optionalText(rawHeader.logo_text) ? { logoText: optionalText(rawHeader.logo_text) } : {}),
    ...(optionalText(rawHeader.logo_url) ? { logoUrl: optionalText(rawHeader.logo_url) } : {}),
    navigation,
    ...(optionalText(rawHeader.cta_text) ? { ctaText: optionalText(rawHeader.cta_text) } : {}),
    ...(optionalText(rawHeader.cta_link) ? { ctaLink: optionalText(rawHeader.cta_link) } : {})
  };
  const footer: PublicSiteFooter = {
    ...(optionalText(rawFooter.business_name) ? { businessName: optionalText(rawFooter.business_name) } : {}),
    ...(optionalText(rawFooter.phone_number ?? rawFooter.phone) ? { phone: optionalText(rawFooter.phone_number ?? rawFooter.phone) } : {}),
    ...(optionalText(rawFooter.email) ? { email: optionalText(rawFooter.email) } : {}),
    ...(optionalText(rawFooter.service_area) ? { serviceArea: optionalText(rawFooter.service_area) } : {}),
    ...(optionalText(rawFooter.cta_text) ? { ctaText: optionalText(rawFooter.cta_text) } : {}),
    links
  };
  return { header, footer };
}

function sanitizeSettings(record: PublicWebsiteSettingsRecord | null, websiteName: string): PublicSiteSettings {
  return {
    businessName: optionalText(record?.businessName) ?? websiteName,
    ...(optionalText(record?.phone) ? { phone: optionalText(record?.phone) } : {}),
    ...(optionalText(record?.email) ? { email: optionalText(record?.email) } : {}),
    ...(optionalText(record?.logoUrl) ? { logoUrl: optionalText(record?.logoUrl) } : {}),
    ...(optionalText(record?.primaryColor) ? { primaryColor: optionalText(record?.primaryColor) } : {}),
    ...(optionalText(record?.facebookPixelId) ? { facebookPixelId: optionalText(record?.facebookPixelId) } : {}),
    ...(optionalText(record?.gtmId) ? { gtmId: optionalText(record?.gtmId) } : {}),
    ...(optionalText(record?.ga4MeasurementId) ? { ga4MeasurementId: optionalText(record?.ga4MeasurementId) } : {})
  };
}

function sanitizeWebsite(record: { id: string; name: string; domain: string | null; subdomain: string | null }): PublicSiteWebsite {
  return {
    id: record.id,
    name: record.name,
    ...(optionalText(record.domain) ? { domain: optionalText(record.domain) } : {}),
    ...(optionalText(record.subdomain) ? { subdomain: optionalText(record.subdomain) } : {})
  };
}

function sanitizePage(
  source: Record<string, unknown>,
  path: string,
  fallback: PublicPageRecord,
  allowMutableFallback: boolean
): PublicSitePage {
  const id = optionalText(source.id);
  if (!id || id !== fallback.id) throw new Error('Revision page scope is invalid.');
  const name = optionalText(source.name) ?? (allowMutableFallback ? fallback.name : undefined);
  const slug = optionalText(source.slug) ?? (allowMutableFallback ? fallback.slug : undefined);
  if (!name || !slug) throw new Error('Public page metadata is malformed.');
  const seoTitle = optionalText(source.seo_title ?? source.seoTitle)
    ?? (allowMutableFallback ? optionalText(fallback.seoTitle) : undefined);
  const seoDescription = optionalText(source.seo_description ?? source.seoDescription)
    ?? (allowMutableFallback ? optionalText(fallback.seoDescription) : undefined);
  const seoKeywords = Array.isArray(source.seo_keywords)
    ? source.seo_keywords.filter((value): value is string => typeof value === 'string').join(', ')
    : optionalText(source.seo_keywords ?? source.seoKeywords)
      ?? (allowMutableFallback ? optionalText(fallback.seoKeywords) : undefined);
  return {
    id,
    name,
    slug,
    path,
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(seoKeywords ? { seoKeywords } : {})
  };
}

export function isPublicSectionVisible(section: Record<string, unknown>, styles: Record<string, unknown>): boolean {
  return section.visible !== false && section.hidden !== true && styles.visible !== false;
}

function sanitizeSection(source: Record<string, unknown>, pageId: string): PublicSiteSection | null {
  const id = optionalText(source.id);
  const type = optionalText(source.type);
  const sectionPageId = optionalText(source.pageId ?? source.page_id);
  const order = source.order ?? source.order_index;
  if (!id || !type || sectionPageId !== pageId || typeof order !== 'number' || !Number.isFinite(order)) {
    throw new Error('Public section is malformed.');
  }
  const content = cloneRecord(source.content, `section.${id}.content`);
  const styles = cloneRecord(source.styles, `section.${id}.styles`);
  if (!isPublicSectionVisible(source, styles)) return null;
  return {
    id, type, order,
    ...(optionalText(source.variant) ? { variant: optionalText(source.variant) } : {}),
    content, styles
  };
}

function sanitizeSections(sources: readonly Record<string, unknown>[], pageId: string): readonly PublicSiteSection[] {
  return sources.map((section, inputIndex) => ({ section: sanitizeSection(section, pageId), inputIndex }))
    .filter((entry): entry is { section: PublicSiteSection; inputIndex: number } => entry.section !== null)
    .sort((left, right) => left.section.order - right.section.order || left.inputIndex - right.inputIndex)
    .map(entry => entry.section);
}

export function validatePublishedRevisionDocument(
  revision: PublicPublishedRevisionRecord,
  websiteId: string,
  pageId: string
): BuilderDocumentCandidate | null {
  if (revision.websiteId !== websiteId || revision.pageId !== pageId || revision.schemaVersion !== 1) return null;
  if (!isPlainRecord(revision.document) || revision.document.schemaVersion !== 1) return null;
  if (!isPlainRecord(revision.document.page) || optionalText(revision.document.page.id) !== pageId) return null;
  if (!Array.isArray(revision.document.sections)) return null;
  if (revision.document.sections.some(section => !isPlainRecord(section))) return null;
  const document = revision.document as unknown as BuilderDocumentCandidate;
  try {
    return revision.documentFingerprint === createDocumentFingerprint(document) ? document : null;
  } catch {
    return null;
  }
}

function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(',').some(value => value.trim() === '*' || value.trim() === etag);
}

export async function handlePublicSiteRequest(
  request: Request,
  options: PublicSiteHandlerOptions
): Promise<Response> {
  const logger = options.logger ?? silentLogger;
  const requestId = options.requestIdFactory?.() ?? crypto.randomUUID();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
  }
  if (request.method !== 'GET') {
    return publicError('Method not allowed.', 405, { Allow: 'GET, OPTIONS' });
  }
  if (options.configurationAvailable === false) {
    logger.error({ requestId, outcome: 'configuration-unavailable', code: 'missing-server-config' });
    return publicError('Public-site service is unavailable.', 503);
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return publicError('Invalid public-site request.', 400);
  }
  const host = normalizePublicHost(url.searchParams.get('host'), options.allowDevelopmentHosts);
  const path = normalizePublicPath(url.searchParams.get('path'));
  if (!host || !path) {
    logger.info({ requestId, outcome: 'invalid-request' });
    return publicError('Invalid public-site request.', 400);
  }

  try {
    const website = await options.dataSource.findWebsiteByHost(host);
    if (!website) {
      logger.info({ requestId, host, path, outcome: 'not-found', code: 'website' });
      return publicError('Site not found.', 404);
    }
    const route = await options.dataSource.findRouteForWebsite(website.id, path);
    if (!route || route.websiteId !== website.id || route.path !== path) {
      if (options.dataSource.findRedirectForWebsite) {
        const redirect = await options.dataSource.findRedirectForWebsite(website.id, path);
        if (redirect && redirect.websiteId === website.id && redirect.fromPath === path && redirect.toPath && redirect.toPath !== path) {
          logger.info({ requestId, host, path, outcome: 'redirect', code: '308' });
          return new Response(null, {
            status: 308,
            headers: {
              ...CORS_HEADERS,
              'Location': redirect.toPath,
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400'
            }
          });
        }
      }

      logger.info({ requestId, host, path, outcome: 'not-found', code: 'route' });
      return publicError('Site not found.', 404);
    }
    if (path === '/' && website.homepageFunnelId !== route.funnelId) {
      logger.info({ requestId, host, path, outcome: 'not-found', code: 'homepage-scope' });
      return publicError('Site not found.', 404);
    }
    const page = await options.dataSource.findPageForRoute(website, route, path);
    if (!page || page.funnelId !== route.funnelId) {
      logger.info({ requestId, host, path, outcome: 'not-found', code: 'page' });
      return publicError('Site not found.', 404);
    }

    const [settingsRecord, layoutRecord, target, canonicalPrimaryNav, canonicalFooterNav] = await Promise.all([
      options.dataSource.getPublicWebsiteSettings(website.id),
      options.dataSource.getPublicWebsiteLayout(website.id),
      options.dataSource.getPublicationTarget(website.id, page.id),
      options.dataSource.getPublicCanonicalNavigation ? options.dataSource.getPublicCanonicalNavigation(website.id, 'primary') : Promise.resolve(null),
      options.dataSource.getPublicCanonicalNavigation ? options.dataSource.getPublicCanonicalNavigation(website.id, 'footer') : Promise.resolve(null)
    ]);
    const hasCanonicalItems = (canonicalPrimaryNav && canonicalPrimaryNav.items.length > 0) || (canonicalFooterNav && canonicalFooterNav.items.length > 0);
    const liveRoutes = (hasCanonicalItems && options.dataSource.listRoutesForWebsite)
      ? await options.dataSource.listRoutesForWebsite(website.id)
      : [route];
    const settings = sanitizeSettings(settingsRecord, website.name);
    const layout = sanitizeLayout(layoutRecord, canonicalPrimaryNav, canonicalFooterNav, liveRoutes);

    let publicPage: PublicSitePage;
    let sections: readonly PublicSiteSection[];
    let publicationSource: 'revision' | 'legacy';
    let publishedAt: string | undefined;

    if (target) {
      if (target.websiteId !== website.id || target.pageId !== page.id) {
        logger.error({ requestId, host, path, outcome: 'publication-unavailable', code: 'target-scope' });
        return publicError('This page is temporarily unavailable.', 503);
      }
      const revision = await options.dataSource.getRevisionById(
        target.publishedRevisionId, website.id, page.id
      );
      const document = revision ? validatePublishedRevisionDocument(revision, website.id, page.id) : null;
      if (!document) {
        logger.error({ requestId, host, path, outcome: 'publication-unavailable', code: 'broken-target' });
        return publicError('This page is temporarily unavailable.', 503);
      }
      try {
        publicPage = sanitizePage(document.page, path, page, false);
        sections = sanitizeSections(document.sections, page.id);
      } catch {
        logger.error({ requestId, host, path, outcome: 'publication-unavailable', code: 'revision-sanitize' });
        return publicError('This page is temporarily unavailable.', 503);
      }
      publicationSource = 'revision';
      publishedAt = optionalText(target.publishedAt);
    } else {
      if (page.status !== 'published') {
        logger.info({ requestId, host, path, outcome: 'not-found', code: 'legacy-unpublished' });
        return publicError('Site not found.', 404);
      }
      const legacyRows = await options.dataSource.getLegacySections(page.id);
      try {
        publicPage = sanitizePage(page as unknown as Record<string, unknown>, path, page, true);
        sections = sanitizeSections(legacyRows as readonly (PublicLegacySectionRecord & Record<string, unknown>)[], page.id);
      } catch {
        throw new PublicSiteDataSourceError('legacy-sanitize');
      }
      publicationSource = 'legacy';
    }

    const publicIdentity = {
      website: sanitizeWebsite(website),
      route: { id: route.id, websiteId: website.id, path: route.path, funnelId: route.funnelId },
      settings,
      layout,
      page: publicPage,
      sections
    };
    const publicFingerprint = hashStable(publicIdentity);
    const payload = deepFreeze<PublicSitePayload>({
      schemaVersion: 1,
      requestedHost: host,
      requestedPath: path,
      ...publicIdentity,
      publication: {
        source: publicationSource,
        ...(publishedAt ? { publishedAt } : {}),
        fingerprint: publicFingerprint
      }
    });
    const etag = `"ps-${hashStable(payload)}"`;
    const cacheControl = publicationSource === 'revision'
      ? 'public, max-age=60, stale-while-revalidate=300'
      : 'public, max-age=30, stale-while-revalidate=60';
    if (ifNoneMatchMatches(request.headers.get('If-None-Match'), etag)) {
      logger.info({ requestId, host, path, outcome: 'not-modified' });
      return new Response(null, {
        status: 304,
        headers: { ...CORS_HEADERS, 'Cache-Control': cacheControl, ETag: etag }
      });
    }

    const serialize = options.serializePayload ?? JSON.stringify;
    logger.info({ requestId, host, path, outcome: publicationSource });
    return new Response(serialize(payload), {
      status: 200,
      headers: { ...JSON_HEADERS, 'Cache-Control': cacheControl, ETag: etag }
    });
  } catch (error) {
    logger.error({
      requestId, host, path, outcome: 'internal-error',
      code: error instanceof PublicSiteDataSourceError ? error.code : 'unexpected'
    });
    return publicError('Public-site service is unavailable.', 500);
  }
}
