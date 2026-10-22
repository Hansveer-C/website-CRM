import { isCrmApplicationHost } from './application_host';

export const RECOVERY_MESSAGE = 'If an account can receive recovery email, instructions will arrive shortly. Check your inbox and spam folder.';
export const INVALID_RECOVERY = 'This recovery link is invalid or expired. Request a new link.';
export const recoveryClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    flowType: 'implicit' as const, storageKey: 'washops-password-recovery' }
};
type Credentials = { access_token: string; refresh_token: string };
export type RecoveryRoute = { kind: 'none' | 'request' | 'invalid' } | { kind: 'callback'; credentials: Credentials };

/** Only the canonical root callback is supported. Never reflect URL parameters into UI. */
export function recoveryRedirect(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!isCrmApplicationHost(url.hostname) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
      || url.username || url.password) return;
    return `${url.origin}/?auth=recovery`;
  } catch { return; }
}

export function readRecoveryRoute(href: string): RecoveryRoute {
  const url = new URL(href);
  if (!recoveryRedirect(url.origin)) return { kind: 'none' };
  const fragment = new URLSearchParams(url.hash.slice(1));
  const callback = url.searchParams.get('auth') === 'recovery' || fragment.get('type') === 'recovery';
  if (callback) {
    const access = fragment.get('access_token'), refresh = fragment.get('refresh_token');
    if (url.pathname !== '/' || fragment.get('type') !== 'recovery' || url.searchParams.has('error')
      || fragment.has('error') || fragment.has('error_code') || url.searchParams.has('code')
      || fragment.getAll('type').length !== 1 || fragment.getAll('access_token').length !== 1
      || fragment.getAll('refresh_token').length !== 1 || !access || !refresh
      || access.length > 16384 || refresh.length > 4096) return { kind: 'invalid' };
    return { kind: 'callback', credentials: { access_token: access, refresh_token: refresh } };
  }
  if (url.hash === '#/reset-password') return { kind: 'invalid' };
  return { kind: url.hash === '#/forgot-password' ? 'request' : 'none' };
}

export interface RecoveryClient {
  auth: {
    resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: unknown }>;
    setSession(credentials: Credentials): Promise<{ data: { user?: { id: string } | null }; error: unknown }>;
    getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    updateUser(attributes: { password: string }): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    signOut(options: { scope: 'local' }): Promise<{ error: unknown }>;
  };
}
export class PasswordRecoveryController {
  phase: 'request' | 'requesting' | 'sent' | 'checking' | 'ready' | 'saving' | 'done' | 'invalid' = 'request';
  message = '';
  private userId?: string;
  private generation = 0;
  private client?: RecoveryClient;
  constructor(private factory: () => Promise<RecoveryClient | null>, private origin: string) {}

  async request(email: string) {
    if (this.phase === 'requesting') return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
      this.message = 'Enter a valid email address.'; return;
    }
    const redirectTo = recoveryRedirect(this.origin);
    if (!redirectTo) { this.message = 'Recovery is unavailable on this host.'; return; }
    const generation = ++this.generation;
    this.phase = 'requesting'; this.message = '';
    try {
      const client = await this.factory();
      if (generation !== this.generation) return;
      if (client) await client.auth.resetPasswordForEmail(normalized, { redirectTo });
    } catch { /* Do not expose provider responses or account existence. */ }
    if (generation !== this.generation) return;
    // Identical result for accepted, rejected, unknown-account and transport outcomes.
    this.phase = 'sent'; this.message = RECOVERY_MESSAGE;
  }

  async start(route: RecoveryRoute) {
    const generation = ++this.generation;
    this.userId = undefined; this.phase = 'checking'; this.message = '';
    if (route.kind !== 'callback') { this.phase = 'invalid'; this.message = INVALID_RECOVERY; return; }
    try {
      const client = await this.factory();
      if (!client || generation !== this.generation) return;
      this.client = client;
      const session = await client.auth.setSession(route.credentials);
      if (generation !== this.generation) return;
      if (session.error || !session.data.user?.id) throw Error();
      const verified = await client.auth.getUser();
      if (generation !== this.generation) return;
      if (verified.error || verified.data.user?.id !== session.data.user.id) throw Error();
      this.userId = verified.data.user.id; this.phase = 'ready';
    } catch {
      if (generation !== this.generation) return;
      this.phase = 'invalid'; this.message = INVALID_RECOVERY;
      await this.clearSession();
    } finally {
      // Do not retain bearer values beyond SDK exchange, including stale completion.
      route.credentials.access_token = ''; route.credentials.refresh_token = '';
      if (generation === this.generation && this.phase === 'checking') {
        this.phase = 'invalid'; this.message = INVALID_RECOVERY;
      }
    }
  }

  async update(password: string, confirmation: string) {
    if (this.phase !== 'ready' || !this.userId || !this.client) return;
    if (password.length < 8 || password.length > 128 || password !== confirmation) {
      this.message = 'Use 8–128 characters and matching passwords.'; return;
    }
    const generation = this.generation;
    this.phase = 'saving'; this.message = '';
    try {
      const verified = await this.client.auth.getUser();
      if (generation !== this.generation) return;
      if (verified.error || verified.data.user?.id !== this.userId) {
        this.phase = 'invalid'; this.message = INVALID_RECOVERY; await this.clearSession(); return;
      }
      const result = await this.client.auth.updateUser({ password });
      if (generation !== this.generation) return;
      if (result.error || result.data.user?.id !== this.userId) throw Error();
      this.phase = 'done'; this.message = 'Password updated. Sign in with your new password.';
      await this.clearSession();
    } catch {
      if (generation !== this.generation) return;
      this.phase = 'ready'; this.message = 'The update could not be confirmed. Try signing in with your new password, or request a new recovery link.';
    }
  }

  private async clearSession() {
    const client = this.client; this.client = undefined; this.userId = undefined;
    try { await client?.auth.signOut({ scope: 'local' }); } catch { /* Memory-only client is discarded regardless. */ }
  }
  async cancel() { ++this.generation; await this.clearSession(); }
}
