import type { EffectiveRoute } from './builder_route_lifecycle';

export type NavigationMenuScope = 'primary' | 'footer';

export type NavigationTargetKind = 'internal' | 'external' | 'phone' | 'email' | 'homepage';

export interface SiteNavigationItem {
  id: string;
  label: string;
  target_kind: NavigationTargetKind;
  target_value: string;
  position: number;
  visible: boolean;
  is_cta: boolean;
}

export interface SiteNavigationSnapshot {
  website_id: string;
  menu_scope: NavigationMenuScope;
  items: SiteNavigationItem[];
  revision: number;
  updated_at: string;
}

export interface ResolvedNavigationItem {
  id: string;
  label: string;
  target_kind: NavigationTargetKind;
  target_value: string;
  position: number;
  visible: boolean;
  is_cta: boolean;
  resolved_href: string | null;
  resolution_status: 'resolved' | 'unrouted' | 'pending_deletion' | 'missing' | 'invalid';
  resolution_details?: string;
}

export interface EffectiveSiteNavigation {
  website_id: string;
  menu_scope: NavigationMenuScope;
  items: ResolvedNavigationItem[];
  raw_items: SiteNavigationItem[];
  is_draft: boolean;
  base_revision: number;
  draft_revision: number;
  live_revision: number;
  updated_at: string;
}

export type NavigationValidationResult =
  | { valid: true; item: SiteNavigationItem }
  | { valid: false; error: string; code: string };

const PHONE_CLEAN_REGEX = /^[+]?[\d\s().-]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function validateNavigationLabel(label: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof label !== 'string') {
    return { valid: false, error: 'Label must be a string' };
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Navigation label cannot be empty' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Navigation label cannot exceed 100 characters' };
  }
  // Check for dangerous control characters
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return { valid: false, error: 'Navigation label contains invalid characters' };
  }
  return { valid: true, normalized: trimmed };
}

export function validateExternalUrl(url: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof url !== 'string') {
    return { valid: false, error: 'External URL must be a string' };
  }
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'External URL cannot be empty' };
  }
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return { valid: false, error: 'External URL contains invalid characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'External URL must use http:// or https://' };
  }

  return { valid: true, normalized: parsed.href };
}

export function validatePhoneTarget(phone: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof phone !== 'string') {
    return { valid: false, error: 'Phone number must be a string' };
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Phone number cannot be empty' };
  }
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return { valid: false, error: 'Phone number contains invalid characters' };
  }
  if (!PHONE_CLEAN_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true, normalized: trimmed };
}

export function validateEmailTarget(email: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email address must be a string' };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email address cannot be empty' };
  }
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return { valid: false, error: 'Email address contains invalid characters' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email address format' };
  }
  return { valid: true, normalized: trimmed.toLowerCase() };
}

export function validateNavigationItem(input: unknown): NavigationValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Item must be an object', code: 'INVALID_OBJECT' };
  }

  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null;
  if (!id) {
    return { valid: false, error: 'Item must have a non-empty string ID', code: 'INVALID_ID' };
  }
  if (!UUID_REGEX.test(id)) {
    return { valid: false, error: 'Item ID must be a valid UUID format', code: 'INVALID_ID' };
  }

  const labelCheck = validateNavigationLabel(raw.label);
  if (!labelCheck.valid || !labelCheck.normalized) {
    return { valid: false, error: labelCheck.error || 'Invalid label', code: 'INVALID_LABEL' };
  }

  const kind = raw.target_kind;
  if (kind !== 'internal' && kind !== 'external' && kind !== 'phone' && kind !== 'email' && kind !== 'homepage') {
    return { valid: false, error: 'Target kind must be internal, external, phone, email, or homepage', code: 'INVALID_KIND' };
  }

  let normalizedValue = '';
  if (kind === 'homepage') {
    normalizedValue = '__homepage__';
  } else if (kind === 'internal') {
    if (typeof raw.target_value !== 'string' || raw.target_value.trim().length === 0) {
      return { valid: false, error: 'Internal target must specify a destination/funnel ID', code: 'INVALID_INTERNAL_TARGET' };
    }
    normalizedValue = raw.target_value.trim();
  } else if (kind === 'external') {
    const extCheck = validateExternalUrl(raw.target_value);
    if (!extCheck.valid || !extCheck.normalized) {
      return { valid: false, error: extCheck.error || 'Invalid external URL', code: 'INVALID_EXTERNAL_URL' };
    }
    normalizedValue = extCheck.normalized;
  } else if (kind === 'phone') {
    const phoneCheck = validatePhoneTarget(raw.target_value);
    if (!phoneCheck.valid || !phoneCheck.normalized) {
      return { valid: false, error: phoneCheck.error || 'Invalid phone number', code: 'INVALID_PHONE' };
    }
    normalizedValue = phoneCheck.normalized;
  } else if (kind === 'email') {
    const emailCheck = validateEmailTarget(raw.target_value);
    if (!emailCheck.valid || !emailCheck.normalized) {
      return { valid: false, error: emailCheck.error || 'Invalid email address', code: 'INVALID_EMAIL' };
    }
    normalizedValue = emailCheck.normalized;
  }

  if (typeof raw.position === 'number' && !Number.isInteger(raw.position)) {
    return { valid: false, error: 'Position must be a whole integer', code: 'INVALID_POSITION' };
  }

  const position = typeof raw.position === 'number' && Number.isInteger(raw.position) && raw.position >= 0
    ? raw.position
    : 0;

  const visible = typeof raw.visible === 'boolean' ? raw.visible : true;
  const is_cta = typeof raw.is_cta === 'boolean' ? raw.is_cta : false;

  return {
    valid: true,
    item: {
      id,
      label: labelCheck.normalized,
      target_kind: kind,
      target_value: normalizedValue,
      position,
      visible,
      is_cta
    }
  };
}

export function validateAndNormalizeNavigationItems(items: unknown[]): {
  valid: boolean;
  items: SiteNavigationItem[];
  error?: string;
  code?: string;
} {
  if (!Array.isArray(items)) {
    return { valid: false, items: [], error: 'Navigation items must be an array', code: 'INVALID_ARRAY' };
  }

  const seenIds = new Set<string>();
  const normalized: SiteNavigationItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const res = validateNavigationItem(items[i]);
    if (!res.valid) {
      return { valid: false, items: [], error: `Item at index ${i}: ${res.error}`, code: res.code };
    }
    if (seenIds.has(res.item.id)) {
      return { valid: false, items: [], error: `Duplicate item ID '${res.item.id}' at index ${i}`, code: 'DUPLICATE_ID' };
    }
    seenIds.add(res.item.id);
    normalized.push({
      ...res.item,
      position: i // Enforce contiguous zero-based index
    });
  }

  return { valid: true, items: normalized };
}

export function areNavigationSnapshotsEqual(a: SiteNavigationItem[], b: SiteNavigationItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (
      itemA.id !== itemB.id ||
      itemA.label !== itemB.label ||
      itemA.target_kind !== itemB.target_kind ||
      itemA.target_value !== itemB.target_value ||
      itemA.position !== itemB.position ||
      itemA.visible !== itemB.visible ||
      itemA.is_cta !== itemB.is_cta
    ) {
      return false;
    }
  }
  return true;
}

export function resolveNavigationItem(
  item: SiteNavigationItem,
  context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }
): ResolvedNavigationItem {
  if (item.target_kind === 'external') {
    return {
      ...item,
      resolved_href: item.target_value,
      resolution_status: 'resolved'
    };
  }

  if (item.target_kind === 'phone') {
    return {
      ...item,
      resolved_href: `tel:${item.target_value}`,
      resolution_status: 'resolved'
    };
  }

  if (item.target_kind === 'email') {
    return {
      ...item,
      resolved_href: `mailto:${item.target_value}`,
      resolution_status: 'resolved'
    };
  }

  if (item.target_kind === 'homepage') {
    return {
      ...item,
      resolved_href: '/',
      resolution_status: 'resolved'
    };
  }

  // Internal link resolution via funnel_id
  const funnelId = item.target_value;

  // Check effective routes for this funnel
  const matchingRoute = context.effectiveRoutes.find(r => r.funnel_id === funnelId);
  if (!matchingRoute) {
    return {
      ...item,
      resolved_href: null,
      resolution_status: 'unrouted',
      resolution_details: 'Destination has no assigned route URL'
    };
  }

  if (matchingRoute.is_staged_delete) {
    return {
      ...item,
      resolved_href: null,
      resolution_status: 'pending_deletion',
      resolution_details: `Route ${matchingRoute.path} is scheduled for removal`
    };
  }

  return {
    ...item,
    resolved_href: matchingRoute.path,
    resolution_status: 'resolved'
  };
}

export function resolveEffectiveNavigation(
  items: SiteNavigationItem[],
  context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }
): ResolvedNavigationItem[] {
  return items.map(item => resolveNavigationItem(item, context));
}

export interface PublicNavigationLink {
  label: string;
  path: string;
  is_cta?: boolean;
}

export function resolvePublicNavigation(
  items: SiteNavigationItem[],
  context: {
    liveRoutes: readonly { funnel_id: string; path: string }[];
    homepageFunnelId?: string | null;
  }
): PublicNavigationLink[] {
  const result: PublicNavigationLink[] = [];

  for (const item of items) {
    if (!item.visible) continue;

    if (item.target_kind === 'external') {
      result.push({ label: item.label, path: item.target_value, ...(item.is_cta ? { is_cta: true } : {}) });
      continue;
    }

    if (item.target_kind === 'phone') {
      result.push({ label: item.label, path: `tel:${item.target_value}`, ...(item.is_cta ? { is_cta: true } : {}) });
      continue;
    }

    if (item.target_kind === 'email') {
      result.push({ label: item.label, path: `mailto:${item.target_value}`, ...(item.is_cta ? { is_cta: true } : {}) });
      continue;
    }

    if (item.target_kind === 'homepage') {
      result.push({ label: item.label, path: '/', ...(item.is_cta ? { is_cta: true } : {}) });
      continue;
    }

    const route = context.liveRoutes.find(r => r.funnel_id === item.target_value);
    if (route) {
      result.push({ label: item.label, path: route.path, ...(item.is_cta ? { is_cta: true } : {}) });
    }
    // If not resolvable, omit safely (fail-closed, no #, no corrupt link)
  }

  return result;
}
