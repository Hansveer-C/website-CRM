/**
 * Custom Domain Normalization and Validation Utilities.
 * Introduced in Phase W1.5 — MVP Custom Domain Wiring.
 */

/** Platform domain that operators cannot use as their custom domain. */
export const PLATFORM_DOMAIN = 'pressurepro.io';

/**
 * Localhost addresses that are never valid custom domains.
 */
const REJECTED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

export interface DomainValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Normalizes a raw custom domain input:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips http:// or https:// prefix
 * - Strips trailing slash, path, or query string
 */
export function normalizeDomain(raw: string): string {
  if (!raw) return '';

  let d = raw.trim().toLowerCase();

  // Strip protocol prefix
  d = d.replace(/^https?:\/\//i, '');

  // Strip path, query, fragment (everything after the first '/' or '?' or '#')
  const slashIdx = d.indexOf('/');
  if (slashIdx !== -1) d = d.slice(0, slashIdx);

  const queryIdx = d.indexOf('?');
  if (queryIdx !== -1) d = d.slice(0, queryIdx);

  const hashIdx = d.indexOf('#');
  if (hashIdx !== -1) d = d.slice(0, hashIdx);

  // Strip port number (e.g. example.com:8080 → example.com)
  const portIdx = d.indexOf(':');
  if (portIdx !== -1) d = d.slice(0, portIdx);

  return d.trim();
}

/**
 * Validates a custom domain string candidate according to platform rules.
 *
 * Rules:
 * - Must not be empty after normalization
 * - Must not be localhost / loopback
 * - Must not be (or end with) the platform domain itself
 * - Must contain at least one dot
 * - Must match valid hostname character pattern
 * - No spaces or underscores after normalization
 * - Max 253 characters (DNS spec)
 */
export function validateDomain(raw: string): DomainValidationResult {
  const normalized = normalizeDomain(raw);

  if (!normalized) {
    return { valid: false, normalized: '', error: 'Domain cannot be empty.' };
  }

  if (normalized.length > 253) {
    return {
      valid: false,
      normalized,
      error: 'Domain is too long (max 253 characters).',
    };
  }

  // Reject loopback / local addresses
  if (REJECTED_HOSTS.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: `"${normalized}" is not a valid public domain.`,
    };
  }

  // Reject platform domain itself or any subdomain of it
  if (normalized === PLATFORM_DOMAIN || normalized.endsWith(`.${PLATFORM_DOMAIN}`)) {
    return {
      valid: false,
      normalized,
      error: `You cannot use "${PLATFORM_DOMAIN}" as a custom domain. It is the platform's own domain.`,
    };
  }

  // Must contain at least one dot (e.g. example.com)
  if (!normalized.includes('.')) {
    return {
      valid: false,
      normalized,
      error: 'Domain must contain at least one dot (e.g. example.com).',
    };
  }

  // Reject spaces or underscores (after normalization, underscores are never valid in hostnames)
  if (/\s/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Domain cannot contain spaces.',
    };
  }

  if (normalized.includes('_')) {
    return {
      valid: false,
      normalized,
      error: 'Domain cannot contain underscores.',
    };
  }

  // Validate hostname character set.
  // Each label (part between dots) must:
  //   - start and end with alphanumeric
  //   - contain only a-z, 0-9, or hyphens
  // Overall pattern allows multiple labels separated by dots.
  const hostnamePattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  if (!hostnamePattern.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Domain contains invalid characters. Use only letters, numbers, hyphens, and dots.',
    };
  }

  // Check each label individually for leading/trailing hyphens
  const labels = normalized.split('.');
  for (const label of labels) {
    if (label.startsWith('-') || label.endsWith('-')) {
      return {
        valid: false,
        normalized,
        error: `Domain label "${label}" cannot start or end with a hyphen.`,
      };
    }
    if (label.length === 0) {
      return {
        valid: false,
        normalized,
        error: 'Domain cannot contain consecutive dots.',
      };
    }
  }

  return { valid: true, normalized };
}
