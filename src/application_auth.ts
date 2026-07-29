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
