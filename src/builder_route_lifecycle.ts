/**
 * Canonical Builder Route Lifecycle Domain Model & Path Contract (Phase 1B / Task 5A)
 *
 * Invariants:
 * 1. "Editing changes draft state. Publishing changes live state."
 * 2. Public route authority remains public.website_routes.
 * 3. Builder route modifications are staged in draft authority without mutating live routes.
 * 4. Root route '/' is reserved and governed exclusively by Task 4 homepage lifecycle.
 * 5. Platform and application paths (e.g. /api, /preview, /builder, /dashboard) are reserved.
 * 6. Path uniqueness is enforced per website.
 * 7. Stable route identity is preserved via UUID.
 */

export const RESERVED_APPLICATION_PATHS: readonly string[] = [
  '/',
  '/api',
  '/preview',
  '/builder',
  '/dashboard',
  '/login',
  '/register',
  '/logout',
  '/auth',
  '/settings',
  '/assets',
  '/static',
  '/crm',
  '/admin',
  '/home',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/.well-known'
] as const;

export type RouteOperationResultCode =
  | 'SUCCESS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'COLLISION'
  | 'ROOT_ROUTE_RESERVED'
  | 'RESERVED_PATH'
  | 'INVALID_PATH'
  | 'INVALID_INPUT'
  | 'UNPUBLISHED_DESTINATION'
  | 'INVALID_REDIRECT'
  | 'AMBIGUOUS';

export interface RouteDraft {
  id: string;
  website_id: string;
  route_id: string | null;
  path: string;
  funnel_id: string;
  action: 'upsert' | 'delete';
  created_at: string;
  updated_at: string;
}

export interface RouteRedirect {
  id: string;
  website_id: string;
  from_path: string;
  to_path: string;
  created_at: string;
  updated_at: string;
}

export interface EffectiveRoute {
  id: string;
  website_id: string;
  path: string;
  funnel_id: string;
  live_path: string | null;
  draft_path: string | null;
  is_draft_override: boolean;
  is_staged_delete: boolean;
  is_new_draft: boolean;
}

export interface PathValidationResult {
  valid: boolean;
  normalizedPath: string;
  isRoot: boolean;
  isReserved: boolean;
  error?: string;
  errorCode?: RouteOperationResultCode;
}

/**
 * Normalizes and validates a route path according to the canonical builder contract.
 */
export function normalizeRoutePath(rawPath: string | null | undefined): PathValidationResult {
  if (rawPath === null || rawPath === undefined) {
    return {
      valid: false,
      normalizedPath: '',
      isRoot: false,
      isReserved: false,
      error: 'Path is required',
      errorCode: 'INVALID_PATH'
    };
  }

  let path = rawPath.trim();
  if (path.length === 0) {
    return {
      valid: false,
      normalizedPath: '',
      isRoot: false,
      isReserved: false,
      error: 'Path cannot be empty',
      errorCode: 'INVALID_PATH'
    };
  }

  // Reject query strings, fragments, and percent-encoding
  if (path.includes('?') || path.includes('#')) {
    return {
      valid: false,
      normalizedPath: '',
      isRoot: false,
      isReserved: false,
      error: 'Path cannot contain query parameters or fragments',
      errorCode: 'INVALID_PATH'
    };
  }

  if (path.includes('%')) {
    return {
      valid: false,
      normalizedPath: '',
      isRoot: false,
      isReserved: false,
      error: 'Percent-encoded characters are not supported in route paths',
      errorCode: 'INVALID_PATH'
    };
  }

  // Replace backslashes
  path = path.replace(/\\/g, '/');

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Lowercase
  path = path.toLowerCase();

  // Collapse multiple consecutive slashes: e.g. ///services// -> /services/
  path = path.replace(/\/+/g, '/');

  // Strip trailing slash unless root '/'
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }

  // Root route check
  if (path === '/') {
    return {
      valid: false,
      normalizedPath: '/',
      isRoot: true,
      isReserved: true,
      error: 'Root route "/" is reserved and managed exclusively through homepage selection.',
      errorCode: 'ROOT_ROUTE_RESERVED'
    };
  }

  // Length limit check
  if (path.length > 256) {
    return {
      valid: false,
      normalizedPath: path,
      isRoot: false,
      isReserved: false,
      error: 'Path exceeds maximum allowed length of 256 characters',
      errorCode: 'INVALID_PATH'
    };
  }

  // Segment safety check: each segment must contain only a-z, 0-9, hyphens, underscores, dots (for file names)
  const segments = path.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      return {
        valid: false,
        normalizedPath: path,
        isRoot: false,
        isReserved: false,
        error: 'Path traversal segments are forbidden',
        errorCode: 'INVALID_PATH'
      };
    }

    if (!/^[a-z0-9_.-]+$/.test(seg)) {
      return {
        valid: false,
        normalizedPath: path,
        isRoot: false,
        isReserved: false,
        error: `Path segment "${seg}" contains invalid characters. Use letters, numbers, hyphens, or underscores.`,
        errorCode: 'INVALID_PATH'
      };
    }
  }

  // Reserved path check
  const isDirectlyReserved = RESERVED_APPLICATION_PATHS.includes(path);
  const isPrefixReserved = RESERVED_APPLICATION_PATHS.some(res => res !== '/' && (path === res || path.startsWith(`${res}/`)));
  const isInternalPrefix = path.startsWith('/_');

  if (isDirectlyReserved || isPrefixReserved || isInternalPrefix) {
    return {
      valid: false,
      normalizedPath: path,
      isRoot: false,
      isReserved: true,
      error: `Path "${path}" is a reserved system route and cannot be used for a page URL.`,
      errorCode: 'RESERVED_PATH'
    };
  }

  return {
    valid: true,
    normalizedPath: path,
    isRoot: false,
    isReserved: false
  };
}
