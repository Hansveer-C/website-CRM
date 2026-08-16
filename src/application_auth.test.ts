import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationAuthController,
  classifyApplicationLoginError,
  classifyApplicationSignupError,
  createApplicationSignupRedirect,
  normalizeApplicationSignupEmail,
  validateApplicationSignupInput,
  type ApplicationAuthClient
} from './application_auth';

function client(input: {
  user?: { id: string; email?: string } | null;
  getUserError?: { name?: string; code?: string } | null;
  loginUser?: { id: string; email?: string } | null;
  loginError?: { name?: string; code?: string; status?: number } | null;
  signupUser?: { id: string; email?: string } | null;
  signupSessionUser?: { id: string; email?: string } | null;
  signupError?: { name?: string; code?: string; status?: number } | null;
} = {}): ApplicationAuthClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: input.user ?? null }, error: input.getUserError ?? null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: input.loginUser ?? null }, error: input.loginError ?? null })),
      signUp: vi.fn(async () => ({
        data: {
          user: input.signupUser ?? null,
          session: input.signupSessionUser ? { user: input.signupSessionUser } : null
        },
        error: input.signupError ?? null
      })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  };
}

describe('ApplicationAuthController', () => {
  it('starts with initialization and accepts only a verified Supabase user', async () => {
    const authClient = client({ user: { id: 'user-1', email: 'owner@example.com' } });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    expect(controller.state.status).toBe('initializing');
    expect(await controller.initialize()).toEqual({ status: 'authenticated', user: { id: 'user-1', email: 'owner@example.com' }, source: 'supabase' });
  });

  it('treats a missing session as unauthenticated', async () => {
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => client({ getUserError: { name: 'AuthSessionMissingError' } }) });
    expect(await controller.initialize()).toEqual({ status: 'unauthenticated' });
  });

  it('treats an expired refresh session as unauthenticated', async () => {
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => client({ getUserError: { code: 'refresh_token_not_found' } }) });
    expect(await controller.initialize()).toEqual({ status: 'unauthenticated' });
  });

  it('fails safely for client, configuration, or remote auth failures', async () => {
    expect(await new ApplicationAuthController({ mode: 'unavailable' }).initialize()).toEqual({ status: 'unavailable' });
    expect(await new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => null }).initialize()).toEqual({ status: 'unavailable' });
    expect(await new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => client({ getUserError: { code: 'network_error' } }) }).initialize()).toEqual({ status: 'unavailable' });
  });

  it('never synthesizes system in production-style Supabase mode', async () => {
    const controller = new ApplicationAuthController({ mode: 'supabase', localUserId: 'system', getSupabaseClient: async () => client({ getUserError: { name: 'AuthSessionMissingError' } }) });
    expect(await controller.initialize()).toEqual({ status: 'unauthenticated' });
  });

  it('supports an explicit local development user without mutating options', async () => {
    const options = { mode: 'local' as const, localUserId: 'local-user' };
    const snapshot = { ...options };
    const controller = new ApplicationAuthController(options);
    expect(await controller.initialize()).toEqual({ status: 'authenticated', user: { id: 'local-user' }, source: 'local' });
    expect(options).toEqual(snapshot);
  });

  it('sanitizes invalid login failures and preserves credential inputs', async () => {
    const authClient = client({ loginError: { code: 'invalid_credentials' } });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const email = ' owner@example.com ';
    const password = 'not-logged';
    expect(await controller.signIn(email, password)).toEqual({ success: false, reason: 'invalid-credentials' });
    expect(authClient.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password });
    expect(email).toBe(' owner@example.com ');
    expect(password).toBe('not-logged');
  });

  it('uses the same stable credential rejection for an unknown email', async () => {
    const controller = new ApplicationAuthController({
      mode: 'supabase',
      getSupabaseClient: async () => client({ loginError: { code: 'invalid_credentials', status: 400 } })
    });
    await controller.initialize();
    expect(await controller.signIn('unknown@example.com', 'secret')).toEqual({
      success: false, reason: 'invalid-credentials'
    });
  });

  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'invalid-credentials'],
    [{ code: 'email_not_confirmed', status: 400 }, 'email-not-confirmed'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'unavailable'],
    [{ status: 500 }, 'unavailable'],
    [{ status: 502 }, 'unavailable'],
    [{ status: 503 }, 'unavailable'],
    [{ code: 'request_timeout', status: 400 }, 'unavailable'],
    [{ code: 'future_server_code', status: 400 }, 'unavailable'],
    [{}, 'unavailable']
  ] as const)('classifies returned Auth errors without exposing raw messages: %j', (error, reason) => {
    expect(classifyApplicationLoginError(error)).toBe(reason);
  });

  it('keeps transient returned and thrown failures unauthenticated', async () => {
    const returned = new ApplicationAuthController({
      mode: 'supabase',
      getSupabaseClient: async () => client({ loginError: { code: 'over_request_rate_limit', status: 429 } })
    });
    await returned.initialize();
    expect(await returned.signIn('owner@example.com', 'secret')).toEqual({ success: false, reason: 'unavailable' });
    expect(returned.state).toEqual({ status: 'unauthenticated' });

    const throwingClient = client();
    throwingClient.auth.signInWithPassword = vi.fn(async () => { throw new TypeError('network down'); });
    const thrown = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => throwingClient });
    await thrown.initialize();
    expect(await thrown.signIn('owner@example.com', 'secret')).toEqual({ success: false, reason: 'unavailable' });
    expect(thrown.state).toEqual({ status: 'unauthenticated' });
  });

  it('allows a retry to succeed after a transient returned failure', async () => {
    const authClient = client();
    authClient.auth.signInWithPassword = vi.fn()
      .mockResolvedValueOnce({ data: { user: null }, error: { code: 'unexpected_failure', status: 503 } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-retry' } }, error: null });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    expect(await controller.signIn('owner@example.com', 'secret')).toEqual({ success: false, reason: 'unavailable' });
    expect(await controller.signIn('owner@example.com', 'secret')).toMatchObject({ success: true });
    expect(controller.state).toMatchObject({ status: 'authenticated', user: { id: 'user-retry' } });
  });

  it('establishes login and clears state on logout', async () => {
    const authClient = client({ getUserError: { name: 'AuthSessionMissingError' }, loginUser: { id: 'user-2' } });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    expect((await controller.signIn('owner@example.com', 'secret')).success).toBe(true);
    expect(controller.state).toMatchObject({ status: 'authenticated', user: { id: 'user-2' } });
    expect(await controller.signOut()).toBe(true);
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('observes authenticated user changes and sign-out without retaining the prior user', async () => {
    let notify!: (event: string, session: { user: { id: string; email?: string | null } } | null) => void;
    const authClient = client({ user: { id: 'user-1' } });
    authClient.auth.onAuthStateChange = vi.fn(callback => {
      notify = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    notify('SIGNED_IN', { user: { id: 'user-2' } });
    expect(controller.state).toMatchObject({ status: 'authenticated', user: { id: 'user-2' } });
    notify('SIGNED_OUT', null);
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('normalizes signup email, preserves password bytes, and requests the verified redirect once', async () => {
    const authClient = client({ signupUser: { id: 'user-new' } });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const password = ' six chars with spaces ';
    expect(await controller.signUp({
      email: ' New.Owner@Example.COM ',
      password,
      confirmPassword: password,
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    })).toEqual({ success: true, status: 'awaiting-confirmation' });
    expect(authClient.auth.signUp).toHaveBeenCalledTimes(1);
    expect(authClient.auth.signUp).toHaveBeenCalledWith({
      email: 'new.owner@example.com',
      password,
      options: { emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login' }
    });
  });

  it('blocks invalid email, password mismatch, and unsafe redirects before making a request', async () => {
    const authClient = client();
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const result = await controller.signUp({
      email: 'not-an-email',
      password: 'secret-one',
      confirmPassword: 'secret-two',
      emailRedirectTo: 'https://customer.example/#/login'
    });
    expect(result).toMatchObject({ success: false, reason: 'invalid-input' });
    if (!result.success && result.reason === 'invalid-input') {
      expect(result.issues.map(issue => issue.field)).toEqual(['email', 'confirmPassword', 'redirect']);
    }
    expect(authClient.auth.signUp).not.toHaveBeenCalled();
  });

  it('does not expose remote signup outside initialized Supabase mode', async () => {
    const authClient = client();
    const local = new ApplicationAuthController({ mode: 'local', localUserId: 'local-user', getSupabaseClient: async () => authClient });
    await local.initialize();
    expect(await local.signUp({
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'http://localhost:5173/#/login'
    })).toEqual({ success: false, reason: 'unavailable' });
    expect(authClient.auth.signUp).not.toHaveBeenCalled();
  });

  it('prevents duplicate pending submissions', async () => {
    let finish!: (value: Awaited<ReturnType<ApplicationAuthClient['auth']['signUp']>>) => void;
    const authClient = client();
    authClient.auth.signUp = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const request = {
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    };
    const pending = controller.signUp(request);
    expect(await controller.signUp(request)).toEqual({ success: false, reason: 'in-progress' });
    expect(authClient.auth.signUp).toHaveBeenCalledTimes(1);
    finish({ data: { user: { id: 'user-new' }, session: null }, error: null });
    expect(await pending).toEqual({ success: true, status: 'awaiting-confirmation' });
  });

  it('uses the normal authenticated state when signup returns an immediate session', async () => {
    const authClient = client({
      signupUser: { id: 'user-new', email: 'owner@example.com' },
      signupSessionUser: { id: 'user-new', email: 'owner@example.com' }
    });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const result = await controller.signUp({
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    });
    expect(result).toEqual({
      success: true,
      status: 'authenticated',
      state: { status: 'authenticated', user: { id: 'user-new', email: 'owner@example.com' }, source: 'supabase' }
    });
    expect(controller.state.status).toBe('authenticated');
  });

  it('sanitizes signup rejection and never returns credentials', async () => {
    const authClient = client({ signupError: { code: 'user_already_exists', status: 422 } });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const result = await controller.signUp({
      email: 'known@example.com', password: 'do-not-return', confirmPassword: 'do-not-return',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    });
    expect(result).toEqual({ success: false, reason: 'rejected' });
    expect(JSON.stringify(result)).not.toContain('known@example.com');
    expect(JSON.stringify(result)).not.toContain('do-not-return');
  });

  it.each([
    [{ code: 'user_already_exists', status: 422 }, 'rejected'],
    [{ code: 'email_exists', status: 422 }, 'rejected'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'unavailable'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'unavailable'],
    [{ status: 500 }, 'unavailable'],
    [{ status: 502 }, 'unavailable'],
    [{ status: 503 }, 'unavailable'],
    [{ code: 'request_timeout', status: 400 }, 'unavailable'],
    [{ code: 'network_error', name: 'AuthRetryableFetchError' }, 'unavailable'],
    [{ code: 'future_auth_code', status: 422 }, 'unavailable'],
    [{}, 'unavailable'],
    [null, 'unavailable']
  ] as const)('classifies signup Auth failures from stable metadata: %j', (error, reason) => {
    expect(classifyApplicationSignupError(error)).toBe(reason);
  });

  it.each([
    { code: 'over_request_rate_limit', status: 429 },
    { status: 500 },
    { status: 502 },
    { status: 503 },
    { code: 'request_timeout', status: 400 },
    { code: 'network_error' },
    { code: 'unknown_returned_error', status: 422 },
    {}
  ])('keeps returned signup service failure unauthenticated and retryable: %j', async signupError => {
    const authClient = client({ signupError });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const request = {
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    };
    expect(await controller.signUp(request)).toEqual({ success: false, reason: 'unavailable' });
    expect(controller.state).toEqual({ status: 'unauthenticated' });
    expect(await controller.signUp(request)).toEqual({ success: false, reason: 'unavailable' });
    expect(authClient.auth.signUp).toHaveBeenCalledTimes(2);
  });

  it.each([429, 503])('resets signup in-flight and allows success after HTTP %s', async status => {
    const authClient = client();
    authClient.auth.signUp = vi.fn()
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: { status } })
      .mockResolvedValueOnce({ data: { user: { id: 'retry-user' }, session: null }, error: null });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const request = {
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    };
    expect(await controller.signUp(request)).toEqual({ success: false, reason: 'unavailable' });
    expect(await controller.signUp(request)).toEqual({ success: true, status: 'awaiting-confirmation' });
  });

  it('handles a thrown signup network error as unavailable and permits retry', async () => {
    const authClient = client();
    authClient.auth.signUp = vi.fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce({ data: { user: { id: 'retry-user' }, session: null }, error: null });
    const controller = new ApplicationAuthController({ mode: 'supabase', getSupabaseClient: async () => authClient });
    await controller.initialize();
    const request = {
      email: 'owner@example.com', password: 'secret', confirmPassword: 'secret',
      emailRedirectTo: 'https://website-crm-hans-says-projects.vercel.app/#/login'
    };
    expect(await controller.signUp(request)).toEqual({ success: false, reason: 'unavailable' });
    expect(controller.state).toEqual({ status: 'unauthenticated' });
    expect(await controller.signUp(request)).toEqual({ success: true, status: 'awaiting-confirmation' });
  });

  it('derives only CRM-host signup redirects and validates project-compatible limits', () => {
    expect(createApplicationSignupRedirect('https://website-crm-hans-says-projects.vercel.app')).toBe('https://website-crm-hans-says-projects.vercel.app/#/login');
    expect(createApplicationSignupRedirect('http://localhost:5173')).toBe('http://localhost:5173/#/login');
    expect(createApplicationSignupRedirect('https://customer.example')).toBeUndefined();
    expect(normalizeApplicationSignupEmail(' Owner@Example.COM ')).toBe('owner@example.com');
    expect(validateApplicationSignupInput({
      email: 'owner@example.com', password: '12345', confirmPassword: '12345',
      emailRedirectTo: 'http://localhost:5173/#/login'
    })).toContainEqual({ field: 'password', message: 'Use at least 6 characters.' });
  });
});
