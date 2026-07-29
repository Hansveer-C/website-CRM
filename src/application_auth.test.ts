import { describe, expect, it, vi } from 'vitest';
import { ApplicationAuthController, type ApplicationAuthClient } from './application_auth';

function client(input: {
  user?: { id: string; email?: string } | null;
  getUserError?: { name?: string; code?: string } | null;
  loginUser?: { id: string; email?: string } | null;
  loginError?: { code?: string } | null;
} = {}): ApplicationAuthClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: input.user ?? null }, error: input.getUserError ?? null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: input.loginUser ?? null }, error: input.loginError ?? null })),
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
});
