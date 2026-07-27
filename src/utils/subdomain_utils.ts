/**
 * Subdomain Normalization and Validation Utilities.
 */

export const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'billing',
  'support',
  'help',
  'dashboard',
  'login',
  'signup',
  'auth',
  'mail',
  'email',
  'ftp',
  'static',
  'assets',
  'preview',
  'site',
  'system'
]);

/**
 * Normalizes a subdomain string candidate:
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Replaces consecutive hyphens with a single hyphen
 * - Removes leading and trailing hyphens
 */
export function normalizeSubdomain(subdomain: string): string {
  if (!subdomain) return '';
  return subdomain
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')     // spaces and underscores to hyphens
    .replace(/-+/g, '-')         // consecutive hyphens to single hyphen
    .replace(/^-+|-+$/g, '');    // leading/trailing hyphens removed
}

export interface ValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates a subdomain string candidate according to platform rules.
 */
export function validateSubdomain(subdomain: string): ValidationResult {
  const normalized = normalizeSubdomain(subdomain);

  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      error: 'Subdomain cannot be empty.'
    };
  }

  if (normalized.length < 3) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain must be at least 3 characters long.'
    };
  }

  if (normalized.length > 40) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain cannot exceed 40 characters.'
    };
  }

  // Check valid characters: only a-z, 0-9, and hyphen.
  // Note: normalization already stripped leading/trailing hyphens and multiple hyphens,
  // but we enforce this pattern on the final string to be sure.
  const pattern = /^[a-z0-9-]+$/;
  if (!pattern.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain can only contain lowercase letters, numbers, and hyphens.'
    };
  }

  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain cannot start or end with a hyphen.'
    };
  }

  if (normalized.includes('--')) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain cannot contain consecutive hyphens.'
    };
  }

  // Check blocklist of reserved system names
  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: `"${normalized}" is a reserved system subdomain and cannot be used.`
    };
  }

  return {
    valid: true,
    normalized
  };
}
