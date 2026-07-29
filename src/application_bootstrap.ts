import type { ApplicationAuthState } from './application_auth';

export type ApplicationBootstrapDecision =
  | { action: 'public' }
  | { action: 'login'; returnTo?: string }
  | { action: 'authenticated'; hash: string }
  | { action: 'unavailable' };

const SAFE_HASH = /^#\/[a-z0-9-]+(?:\/[a-zA-Z0-9._~-]+)?(?:\?[a-zA-Z0-9._~!$&'()*+,;=:@%/?-]*)?$/;

export function isPublicApplicationPath(pathname: string): boolean {
  return pathname === '/site' || pathname.startsWith('/site/');
}

export function sanitizeApplicationReturnRoute(value: string | null | undefined): string | undefined {
  if (!value || !SAFE_HASH.test(value)) return undefined;
  const route = value.slice(2).split(/[/?]/, 1)[0];
  return route && route !== 'login' && route !== 'site' ? value : undefined;
}

export function getLoginReturnRoute(hash: string): string | undefined {
  if (!hash.startsWith('#/login?')) return undefined;
  const query = hash.slice(hash.indexOf('?') + 1);
  return sanitizeApplicationReturnRoute(new URLSearchParams(query).get('returnTo'));
}

export function buildApplicationLoginHash(returnTo?: string): string {
  const safeReturn = sanitizeApplicationReturnRoute(returnTo);
  return safeReturn ? `#/login?returnTo=${encodeURIComponent(safeReturn)}` : '#/login';
}

export function resolveApplicationBootstrap(input: {
  pathname: string;
  hash: string;
  authState: ApplicationAuthState;
}): ApplicationBootstrapDecision {
  if (isPublicApplicationPath(input.pathname)) return { action: 'public' };
  if (input.authState.status === 'initializing' || input.authState.status === 'unavailable') {
    return { action: 'unavailable' };
  }
  const requestedHash = input.hash.startsWith('#/') ? input.hash : '#/dashboard';
  const isLogin = requestedHash === '#/login' || requestedHash.startsWith('#/login?');
  if (input.authState.status === 'unauthenticated') {
    return isLogin
      ? { action: 'login', ...(getLoginReturnRoute(requestedHash) ? { returnTo: getLoginReturnRoute(requestedHash) } : {}) }
      : { action: 'login', returnTo: sanitizeApplicationReturnRoute(requestedHash) };
  }
  if (isLogin) {
    return { action: 'authenticated', hash: getLoginReturnRoute(requestedHash) ?? '#/dashboard' };
  }
  return { action: 'authenticated', hash: requestedHash };
}
