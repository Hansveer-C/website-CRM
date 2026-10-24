import { describe, it, expect, vi } from 'vitest';
import { PasswordRecoveryController, readRecoveryRoute, recoveryRedirect, recoveryClientOptions, RECOVERY_MESSAGE, INVALID_RECOVERY, type RecoveryClient } from './application_recovery';
const origin = 'https://website-crm-one.vercel.app';
const callback = () => readRecoveryRoute(`${origin}/?auth=recovery#type=recovery&access_token=synthetic-access&refresh_token=synthetic-refresh`);
function fixture() {
  const user = { id: 'verified-test-user' };
  const auth = {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  };
  const client = { auth } as RecoveryClient;
  const factory = vi.fn().mockResolvedValue(client);
  return { auth, factory, controller: new PasswordRecoveryController(factory, origin) };
}
describe('password recovery callback boundary', () => {
  it('uses a root query marker separate from the app hash router', () => {
    expect(recoveryRedirect(origin)).toBe(`${origin}/?auth=recovery`);
    expect(recoveryRedirect('http://localhost:4191')).toBe('http://localhost:4191/?auth=recovery');
    expect(readRecoveryRoute(`${origin}/#/forgot-password`)).toEqual({ kind: 'request' });
    expect(readRecoveryRoute(`${origin}/#/dashboard`)).toEqual({ kind: 'none' });
  });
  it.each(['https://customer.example','http://website-crm-one.vercel.app','https://user:pass@website-crm-one.vercel.app'])('rejects untrusted origin %s', value => expect(recoveryRedirect(value)).toBeUndefined());
  it.each([
    '/?auth=recovery', '/#/reset-password', '/?auth=recovery#error=access_denied&error_description=private',
    '/?auth=recovery#type=signup&access_token=a&refresh_token=b',
    '/?auth=recovery#type=recovery&access_token=a',
    '/?auth=recovery#type=recovery&access_token=a&access_token=b&refresh_token=c',
    '/?auth=recovery#type=recovery&type=recovery&access_token=a&refresh_token=b',
    '/?auth=recovery&code=private#type=recovery&access_token=a&refresh_token=b',
    '/site?auth=recovery#type=recovery&access_token=a&refresh_token=b'
  ])('fails closed for invalid, expired or unsupported callback %s', path => expect(readRecoveryRoute(origin + path).kind).toBe('invalid'));
  it('intercepts recovery fragments even if the redirect marker is omitted', () => {
    expect(readRecoveryRoute(`${origin}/#type=recovery&access_token=a&refresh_token=b`).kind).toBe('callback');
    expect(recoveryClientOptions.auth).toMatchObject({ persistSession: false, detectSessionInUrl: false, autoRefreshToken: false, storageKey: 'washops-password-recovery' });
  });
});
describe('password reset requests', () => {
  it.each(['ok', 'unknown-account', 'rate-limited', 'network'])('does not expose account existence for %s', async outcome => {
    const f = fixture();
    if (outcome === 'network') f.auth.resetPasswordForEmail.mockRejectedValue(new Error('private-provider-details'));
    else if (outcome !== 'ok') f.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: outcome } });
    await f.controller.request(' Owner@example.com ');
    expect(f.auth.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', { redirectTo: `${origin}/?auth=recovery` });
    expect(f.controller.phase).toBe('sent'); expect(f.controller.message).toBe(RECOVERY_MESSAGE);
  });
  it('rejects invalid input and suppresses duplicate submissions', async () => {
    const f = fixture(); await f.controller.request('invalid'); expect(f.factory).not.toHaveBeenCalled();
    let finish!: (value: unknown) => void;
    f.auth.resetPasswordForEmail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const task = f.controller.request('owner@example.com'); await Promise.resolve();
    await f.controller.request('owner@example.com'); await vi.waitFor(() => expect(f.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1));
    finish({ error: null }); await task;
  });
});
describe('recovery-only password update', () => {
  it('never updates from an ordinary authenticated session or bare update route', async () => {
    const f = fixture(); await f.controller.update('synthetic-new-pass', 'synthetic-new-pass');
    await f.controller.start({ kind: 'invalid' }); await f.controller.update('synthetic-new-pass', 'synthetic-new-pass');
    expect(f.auth.updateUser).not.toHaveBeenCalled(); expect(f.auth.setSession).not.toHaveBeenCalled();
  });
  it('requires a server verified user, validates confirmation, then signs recovery session out', async () => {
    const f = fixture(), route = callback(); await f.controller.start(route);
    expect(f.controller.phase).toBe('ready');
    if (route.kind === 'callback') expect(route.credentials).toEqual({ access_token: '', refresh_token: '' });
    await f.controller.update('short','short'); await f.controller.update('synthetic-new-pass','mismatch'); expect(f.auth.updateUser).not.toHaveBeenCalled();
    await f.controller.update('synthetic-new-pass','synthetic-new-pass');
    expect(f.auth.updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-pass' });
    expect(f.auth.getUser).toHaveBeenCalledTimes(2); expect(f.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(f.controller.phase).toBe('done'); await f.controller.update('again-pass','again-pass'); expect(f.auth.updateUser).toHaveBeenCalledTimes(1);
  });
  it.each(['expired','mismatch','missing-client'])('denies invalid recovery %s', async reason => {
    const f = fixture();
    if (reason === 'expired') f.auth.setSession.mockResolvedValue({ data: { user: null }, error: {} });
    if (reason === 'mismatch') f.auth.getUser.mockResolvedValue({ data: { user: { id: 'foreign' } }, error: null });
    if (reason === 'missing-client') f.factory.mockResolvedValue(null);
    await f.controller.start(callback()); expect(f.controller.phase).toBe('invalid'); expect(f.controller.message).toBe(INVALID_RECOVERY);
    await f.controller.update('synthetic-new-pass','synthetic-new-pass'); expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it('rechecks expiry/identity before update', async () => {
    const f = fixture(); await f.controller.start(callback()); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    await f.controller.update('synthetic-new-pass','synthetic-new-pass'); expect(f.controller.phase).toBe('invalid'); expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it('suppresses concurrent updates and discards completion after cancellation', async () => {
    const f = fixture(); await f.controller.start(callback());
    let finish!: (value: unknown) => void;
    f.auth.updateUser.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const task = f.controller.update('synthetic-new-pass','synthetic-new-pass'); await Promise.resolve();
    await f.controller.update('synthetic-new-pass','synthetic-new-pass'); await vi.waitFor(() => expect(f.auth.updateUser).toHaveBeenCalledTimes(1));
    await f.controller.cancel(); finish({ data: { user: { id: 'verified-test-user' } }, error: null }); await task;
    expect(f.controller.phase).not.toBe('done');
  });
  it('does not display provider messages or falsely report a failed update as successful', async () => {
    const f = fixture(); await f.controller.start(callback()); f.auth.updateUser.mockRejectedValue(new Error('private-details'));
    await f.controller.update('synthetic-new-pass','synthetic-new-pass'); expect(f.controller.phase).toBe('ready'); expect(f.controller.message).not.toContain('private-details');
  });
});
