import { isCrmApplicationHost } from './application_host';

export type ApplicationHostRouteDecision =
  | { kind: 'public-site'; pathname: string; initializeApplicationAuth: false }
  | { kind: 'crm'; initializeApplicationAuth: true };

function normalizePublicPathname(pathname: string): string {
  const value = pathname.trim();
  if (!value || value === '/index.html') return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

/**
 * Establishes the hostname trust boundary before any local route lookup.
 * Customer hosts always delegate existence checks to the trusted public-site resolver.
 */
export function resolveApplicationHostRoute(input: {
  hostname: string;
  pathname: string;
}): ApplicationHostRouteDecision {
  if (!isCrmApplicationHost(input.hostname)) {
    return {
      kind: 'public-site',
      pathname: normalizePublicPathname(input.pathname),
      initializeApplicationAuth: false
    };
  }
  return { kind: 'crm', initializeApplicationAuth: true };
}
