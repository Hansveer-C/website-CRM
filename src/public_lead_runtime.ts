export type PublicLeadSubmissionMode = 'local' | 'edge' | 'auto';
export type PublicLeadRuntimeSource = { source: 'local' } | { source: 'edge'; endpoint: string };
export type PublicLeadRuntimeResult =
  | { success: true; value: PublicLeadRuntimeSource }
  | { success: false; message: string };

export interface ResolvePublicLeadRuntimeOptions {
  configuredMode?: string;
  production: boolean;
  supabaseUrl?: string;
  explicitEndpoint?: string;
}

function normalizeEndpoint(value: string, production: boolean): string | null {
  try {
    const url = new URL(value.trim());
    const local = !production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}

export function resolvePublicLeadRuntime(options: ResolvePublicLeadRuntimeOptions): PublicLeadRuntimeResult {
  const mode = (options.configuredMode?.trim().toLowerCase() || 'auto') as PublicLeadSubmissionMode;
  if (!['local', 'edge', 'auto'].includes(mode)) return { success: false, message: 'Public lead submission is not configured.' };
  const selected = mode === 'auto' ? (options.production ? 'edge' : 'local') : mode;
  if (selected === 'local') return { success: true, value: { source: 'local' } };
  const explicit = options.explicitEndpoint?.trim();
  const derived = options.supabaseUrl?.trim()
    ? `${options.supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/public-lead`
    : '';
  const endpoint = normalizeEndpoint(explicit || derived, options.production);
  return endpoint
    ? { success: true, value: { source: 'edge', endpoint } }
    : { success: false, message: 'Public lead submission is not configured.' };
}

export function shouldUsePublicLeadEdge(
  runtime: PublicLeadRuntimeResult,
  options: { isPublic: boolean; preview: boolean }
): runtime is { success: true; value: { source: 'edge'; endpoint: string } } {
  return options.isPublic && !options.preview && runtime.success && runtime.value.source === 'edge';
}
