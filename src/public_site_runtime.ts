export type PublicSiteDataSourceMode = 'local' | 'edge' | 'auto';

export type ResolvedPublicSiteSource =
  | { source: 'local' }
  | { source: 'edge'; endpoint: string };

export type PublicSiteRuntimeFailure = {
  success: false;
  code: 'INVALID_MODE' | 'EDGE_NOT_CONFIGURED';
  message: string;
};

export type PublicSiteRuntimeResult =
  | { success: true; value: ResolvedPublicSiteSource }
  | PublicSiteRuntimeFailure;

export interface ResolvePublicSiteRuntimeOptions {
  configuredMode?: string;
  production: boolean;
  supabaseUrl?: string;
  explicitEndpoint?: string;
  allowLocalhostEndpoint?: boolean;
}

const SAFE_CONFIGURATION_MESSAGE = 'Public website data is not configured.';

function parseMode(value: string | undefined): PublicSiteDataSourceMode | null {
  const normalized = value?.trim().toLowerCase() || 'auto';
  return normalized === 'local' || normalized === 'edge' || normalized === 'auto'
    ? normalized
    : null;
}

function isAllowedEndpoint(url: URL, production: boolean, allowLocalhost: boolean): boolean {
  if (url.protocol === 'https:') return true;
  return !production
    && allowLocalhost
    && url.protocol === 'http:'
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function normalizePublicSiteEndpoint(
  endpoint: string,
  production: boolean,
  allowLocalhost = false
): string | null {
  try {
    const url = new URL(endpoint.trim());
    if (!isAllowedEndpoint(url, production, allowLocalhost)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function resolveEdgeEndpoint(options: ResolvePublicSiteRuntimeOptions): string | null {
  const explicit = options.explicitEndpoint?.trim();
  if (explicit) {
    return normalizePublicSiteEndpoint(
      explicit,
      options.production,
      options.allowLocalhostEndpoint === true
    );
  }

  const base = options.supabaseUrl?.trim();
  if (!base) return null;
  const normalizedBase = normalizePublicSiteEndpoint(base, options.production, false);
  return normalizedBase
    ? `${normalizedBase}/functions/v1/public-site`
    : null;
}

export function resolvePublicSiteRuntime(
  options: ResolvePublicSiteRuntimeOptions
): PublicSiteRuntimeResult {
  const mode = parseMode(options.configuredMode);
  if (!mode) {
    return { success: false, code: 'INVALID_MODE', message: SAFE_CONFIGURATION_MESSAGE };
  }

  const selected = mode === 'auto'
    ? (options.production ? 'edge' : 'local')
    : mode;
  if (selected === 'local') return { success: true, value: { source: 'local' } };

  const endpoint = resolveEdgeEndpoint(options);
  return endpoint
    ? { success: true, value: { source: 'edge', endpoint } }
    : { success: false, code: 'EDGE_NOT_CONFIGURED', message: SAFE_CONFIGURATION_MESSAGE };
}

export interface DerivePublicSiteLocationOptions {
  pathname: string;
  hostname: string;
  source: 'local' | 'edge';
  production: boolean;
  developmentHostOverride?: string;
}

export type PublicSiteLocationResult =
  | { success: true; host: string; path: string; preview: boolean }
  | { success: false; message: string };

function normalizeHost(value: string): string | null {
  let host = value.trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253 || /[\s\u0000-\u001f\u007f\/?#@]/.test(host) || host.includes('://')) return null;
  if (!host.includes('.') || host.split('.').some(label => (
    !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ))) return null;
  return host;
}

function normalizeRoutePath(value: string): string | null {
  const segments: string[] = [];
  for (const encoded of value.split('/')) {
    if (!encoded) continue;
    let segment: string;
    try {
      segment = decodeURIComponent(encoded);
    } catch {
      return null;
    }
    if (!segment || segment === '.' || segment === '..' || /[\/\\\u0000-\u001f\u007f]/.test(segment)) {
      return null;
    }
    segments.push(segment);
  }
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function derivePublicSiteLocation(
  options: DerivePublicSiteLocationOptions
): PublicSiteLocationResult {
  const rawPath = options.pathname || '/';
  const preview = rawPath === '/preview' || rawPath.startsWith('/preview/');
  let path = rawPath;
  if (rawPath === '/site' || rawPath === '/site/' || rawPath === '/preview' || rawPath === '/preview/') {
    path = '/';
  } else if (rawPath.startsWith('/site/')) {
    path = rawPath.slice('/site'.length);
  } else if (rawPath.startsWith('/preview/')) {
    path = rawPath.slice('/preview'.length);
  }
  const normalizedPath = normalizeRoutePath(path.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/');
  if (!normalizedPath) return { success: false, message: 'Public website data is not configured.' };

  const override = !options.production && options.source === 'edge'
    ? options.developmentHostOverride?.trim()
    : undefined;
  const host = normalizeHost(override || options.hostname);
  return host
    ? { success: true, host, path: normalizedPath, preview }
    : { success: false, message: 'Public website data is not configured.' };
}

export class PublicSiteRequestGate {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }
}
