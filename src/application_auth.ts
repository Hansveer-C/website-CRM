export type ApplicationAuthMode = 'local' | 'supabase' | 'unavailable';

export interface ApplicationAuthUser {
  id: string;
  email?: string;
}

export type ApplicationAuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: ApplicationAuthUser; source: 'local' | 'supabase' }
  | { status: 'unavailable' };

export interface ApplicationAuthError {
  name?: string;
  code?: string;
  status?: number;
}

export interface ApplicationSignupInput {
  email: string;
  password: string;
  confirmPassword: string;
  emailRedirectTo: string;
}

export type ApplicationSignupValidationField = 'email' | 'password' | 'confirmPassword' | 'redirect';

export interface ApplicationSignupValidationIssue {
  field: ApplicationSignupValidationField;
  message: string;
}

export type ApplicationSignupResult =
  | { success: true; status: 'awaiting-confirmation' }
  | {
      success: true;
      status: 'authenticated';
      state: Extract<ApplicationAuthState, { status: 'authenticated' }>;
    }
  | { success: false; reason: 'invalid-input'; issues: ApplicationSignupValidationIssue[] }
  | { success: false; reason: 'rejected' | 'unavailable' | 'in-progress' };

export interface ApplicationAuthClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: ApplicationAuthError | null;
    }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: ApplicationAuthError | null;
    }>;
    signUp(credentials: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }): Promise<{
      data: {
        user: { id: string; email?: string | null } | null;
        session: { user: { id: string; email?: string | null } } | null;
      };
      error: ApplicationAuthError | null;
    }>;
    signOut(): Promise<{ error: ApplicationAuthError | null }>;
    onAuthStateChange(callback: (
      event: string,
      session: { user: { id: string; email?: string | null } } | null
    ) => void): { data: { subscription: { unsubscribe(): void } } };
  };
}

export interface ApplicationAuthControllerOptions {
  mode: ApplicationAuthMode;
  getSupabaseClient?: () => Promise<ApplicationAuthClient | null>;
  localUserId?: string;
}

export type ApplicationLoginResult =
  | { success: true; state: Extract<ApplicationAuthState, { status: 'authenticated' }> }
  | { success: false; reason: 'invalid-credentials' | 'unavailable' };

const APPLICATION_EMAIL_MAX_LENGTH = 254;
const APPLICATION_PASSWORD_MIN_LENGTH = 6;
const APPLICATION_PASSWORD_MAX_LENGTH = 128;
const PRACTICAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeApplicationSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateApplicationSignupInput(
  input: ApplicationSignupInput
): ApplicationSignupValidationIssue[] {
  const issues: ApplicationSignupValidationIssue[] = [];
  const email = normalizeApplicationSignupEmail(input.email);
  if (!email) {
    issues.push({ field: 'email', message: 'Enter your email address.' });
  } else if (email.length > APPLICATION_EMAIL_MAX_LENGTH || !PRACTICAL_EMAIL_PATTERN.test(email)) {
    issues.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (!input.password) {
    issues.push({ field: 'password', message: 'Enter a password.' });
  } else if (input.password.length < APPLICATION_PASSWORD_MIN_LENGTH) {
    issues.push({ field: 'password', message: 'Use at least 6 characters.' });
  } else if (input.password.length > APPLICATION_PASSWORD_MAX_LENGTH) {
    issues.push({ field: 'password', message: 'Use no more than 128 characters.' });
  }
  if (input.confirmPassword !== input.password) {
    issues.push({ field: 'confirmPassword', message: 'Passwords do not match.' });
  }
  try {
    const redirect = new URL(input.emailRedirectTo);
    const safeProtocol = redirect.protocol === 'https:'
      || (redirect.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname));
    const safeHost = redirect.hostname.endsWith('.vercel.app')
      || ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
    if (!safeProtocol || !safeHost || redirect.pathname !== '/' || redirect.hash !== '#/login') {
      issues.push({ field: 'redirect', message: 'Account creation is unavailable on this host.' });
    }
  } catch {
    issues.push({ field: 'redirect', message: 'Account creation is unavailable on this host.' });
  }
  return issues;
}

export function createApplicationSignupRedirect(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const safeProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && localHost);
    if (!safeProtocol || (!localHost && !url.hostname.endsWith('.vercel.app'))) return undefined;
    return new URL('/#/login', url.origin).toString();
  } catch {
    return undefined;
  }
}

function toApplicationUser(user: { id: string; email?: string | null }): ApplicationAuthUser {
  return {
    id: user.id,
    ...(user.email ? { email: user.email } : {})
  };
}

function isMissingSession(error: ApplicationAuthError | null): boolean {
  if (!error) return false;
  const name = error.name?.toLowerCase() ?? '';
  const code = error.code?.toLowerCase() ?? '';
  return name.includes('sessionmissing')
    || code === 'session_not_found'
    || code === 'refresh_token_not_found'
    || code === 'refresh_token_already_used';
}

export class ApplicationAuthController {
  state: ApplicationAuthState = { status: 'initializing' };
  private client: ApplicationAuthClient | null = null;
  private unsubscribe: (() => void) | null = null;
  private listener: ((state: ApplicationAuthState) => void) | null = null;
  private signupInFlight = false;

  constructor(private readonly options: ApplicationAuthControllerOptions) {}

  async initialize(): Promise<ApplicationAuthState> {
    this.dispose();
    this.state = { status: 'initializing' };
    if (this.options.mode === 'unavailable') return this.setState({ status: 'unavailable' });
    if (this.options.mode === 'local') {
      const id = this.options.localUserId?.trim() ?? '';
      return id
        ? this.setState({ status: 'authenticated', user: { id }, source: 'local' })
        : this.setState({ status: 'unavailable' });
    }
    try {
      this.client = await this.options.getSupabaseClient?.() ?? null;
      if (!this.client) return this.setState({ status: 'unavailable' });
      const result = await this.client.auth.getUser();
      if (result.data.user?.id) {
        this.observeClient();
        return this.setState({
          status: 'authenticated',
          user: toApplicationUser(result.data.user),
          source: 'supabase'
        });
      }
      this.observeClient();
      return result.error && !isMissingSession(result.error)
        ? this.setState({ status: 'unavailable' })
        : this.setState({ status: 'unauthenticated' });
    } catch {
      return this.setState({ status: 'unavailable' });
    }
  }

  async signIn(email: string, password: string): Promise<ApplicationLoginResult> {
    if (this.options.mode !== 'supabase' || !this.client) {
      return { success: false, reason: 'unavailable' };
    }
    try {
      const result = await this.client.auth.signInWithPassword({ email: email.trim(), password });
      if (!result.data.user?.id || result.error) {
        this.setState({ status: 'unauthenticated' });
        return { success: false, reason: 'invalid-credentials' };
      }
      const state = this.setState({
        status: 'authenticated',
        user: toApplicationUser(result.data.user),
        source: 'supabase'
      }) as Extract<ApplicationAuthState, { status: 'authenticated' }>;
      return { success: true, state };
    } catch {
      return { success: false, reason: 'unavailable' };
    }
  }

  async signUp(input: ApplicationSignupInput): Promise<ApplicationSignupResult> {
    const issues = validateApplicationSignupInput(input);
    if (issues.length > 0) return { success: false, reason: 'invalid-input', issues };
    if (this.signupInFlight) return { success: false, reason: 'in-progress' };
    if (this.options.mode !== 'supabase' || !this.client) {
      return { success: false, reason: 'unavailable' };
    }
    this.signupInFlight = true;
    try {
      const result = await this.client.auth.signUp({
        email: normalizeApplicationSignupEmail(input.email),
        password: input.password,
        options: { emailRedirectTo: input.emailRedirectTo }
      });
      if (result.error || !result.data.user?.id) {
        this.setState({ status: 'unauthenticated' });
        return { success: false, reason: result.error?.status && result.error.status >= 500 ? 'unavailable' : 'rejected' };
      }
      if (!result.data.session?.user?.id) {
        this.setState({ status: 'unauthenticated' });
        return { success: true, status: 'awaiting-confirmation' };
      }
      const state = this.setState({
        status: 'authenticated',
        user: toApplicationUser(result.data.session.user),
        source: 'supabase'
      }) as Extract<ApplicationAuthState, { status: 'authenticated' }>;
      return { success: true, status: 'authenticated', state };
    } catch {
      return { success: false, reason: 'unavailable' };
    } finally {
      this.signupInFlight = false;
    }
  }

  async signOut(): Promise<boolean> {
    if (this.options.mode === 'local') {
      this.setState({ status: 'unauthenticated' });
      return true;
    }
    if (!this.client) return false;
    try {
      const result = await this.client.auth.signOut();
      if (result.error) return false;
      this.setState({ status: 'unauthenticated' });
      return true;
    } catch {
      return false;
    }
  }

  onChange(listener: (state: ApplicationAuthState) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private observeClient(): void {
    if (!this.client || this.unsubscribe) return;
    const result = this.client.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        this.setState({
          status: 'authenticated',
          user: toApplicationUser(session.user),
          source: 'supabase'
        });
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        this.setState({ status: 'unauthenticated' });
      }
    });
    this.unsubscribe = () => result.data.subscription.unsubscribe();
  }

  private setState(state: ApplicationAuthState): ApplicationAuthState {
    this.state = state;
    this.listener?.(state);
    return state;
  }
}
