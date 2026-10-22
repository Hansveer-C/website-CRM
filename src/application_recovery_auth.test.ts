import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the real main-router auth bridge with controlled auth events and timing.
const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
const bridge = source.slice(source.indexOf('async function ensureApplicationAuth()'), source.indexOf('(window as any).switchUser'));
const signedIn = { status: 'authenticated', user: { id: 'synthetic-owner' }, source: 'supabase' };
function harness(pending = false) {
  let recovery = false;
  let notify: (state: any) => void = () => {};
  let finish: (state: any) => void = () => {};
  const controller = {
    state: signedIn as any,
    onChange: (listener: typeof notify) => { notify = listener; },
    initialize: () => pending ? new Promise(resolve => { finish = state => { controller.state = state; notify(state); resolve(state); }; }) : Promise.resolve(controller.state)
  };
  const apply = vi.fn();
  const js = ts.transpileModule(`let applicationAuthInitialization = null;
    let applicationAuthHasInitialized = false;
    let applicationAuthFormSubmissionInProgress = false;
    ${bridge}\nreturn ensureApplicationAuth;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const ensure = new Function('applicationAuthController', 'handlePasswordRecovery', 'readRecoveryRoute', 'location', 'applyApplicationAuthState', 'getActingUserId', 'isCrmApplicationHost', 'window', 'bootRouter', js)(
    controller, { isActive: () => recovery }, () => ({kind: recovery ? 'request' : 'none'}), {}, apply,
    () => undefined, () => true, {location:{hostname:'localhost'}}, vi.fn());
  return { ensure, apply, recover: (value: boolean) => { recovery = value; }, finish: () => finish(signedIn),
    signOut: () => { controller.state = {status:'unauthenticated'}; notify(controller.state); } };
}
describe('recovery and ordinary authentication interleaving', () => {
  it('retains cross-tab sign-out during recovery when returning to sign-in', async () => {
    const h = harness();
    expect(await h.ensure()).toEqual(signedIn);
    h.recover(true);
    h.signOut();
    h.recover(false);
    expect(await h.ensure()).toEqual({status:'unauthenticated'});
    expect(h.apply).toHaveBeenLastCalledWith({status:'unauthenticated'});
  });
  it('does not apply a pending authenticated initialization after entering recovery', async () => {
    const h = harness(true);
    const waiting = h.ensure();
    h.recover(true);
    h.finish();
    expect(await waiting).toEqual({status:'unauthenticated'});
    expect(h.apply.mock.calls.every(([state]) => state.status === 'unauthenticated')).toBe(true);
    h.recover(false);
    expect(await h.ensure()).toEqual(signedIn);
  });
  it('uses the latest notification if sign-out follows initialization before its waiter resumes', async () => {
    const h = harness(true);
    const waiting = h.ensure();
    h.finish();
    h.signOut();
    expect(await waiting).toEqual({status:'unauthenticated'});
    expect(h.apply).toHaveBeenLastCalledWith({status:'unauthenticated'});
  });
});

const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const navigation = parsed.statements.find(statement => statement.getText(parsed).startsWith('(window as any).navigateTo ='))!.getText(parsed);
function navigationHarness() {
  let recovery = false;
  let finish: (state: any) => void = () => {};
  const ensure = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const boot = vi.fn();
  const bind = vi.fn(() => null);
  const browser: any = {};
  const js = ts.transpileModule(`let publicSiteRenderSequence = 0; let publicSiteAbortController = null; ${navigation}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function('window', 'handlePasswordRecovery', 'readRecoveryRoute', 'location', 'bootRouter', 'ensureApplicationAuth', 'protectedAsyncOperationGuard', 'getActingUserId', js)(
    browser, {isActive: () => recovery}, () => ({kind:recovery ? 'request' : 'none'}), {}, boot, ensure,
    {beginUnbound:vi.fn(), bindCurrent:bind}, () => undefined);
  return {navigate:browser.navigateTo, recover:() => {recovery = true;}, finish:() => finish(signedIn), ensure, boot, bind};
}
describe('direct navigation recovery guard', () => {
  it.each(['dashboard', 'login', 'site'])('keeps recovery in control of %s navigation', async view => {
    const h = navigationHarness(); h.recover();
    await h.navigate(view);
    expect(h.boot).toHaveBeenCalledOnce();
    expect(h.ensure).not.toHaveBeenCalled();
    expect(h.bind).not.toHaveBeenCalled();
  });
  it('rechecks recovery after waiting for normal authentication', async () => {
    const h = navigationHarness();
    const waiting = h.navigate('dashboard');
    h.recover(); h.finish(); await waiting;
    expect(h.boot).toHaveBeenCalledOnce();
    expect(h.bind).not.toHaveBeenCalled();
  });
  it('preserves ordinary navigation when recovery is absent', async () => {
    const h = navigationHarness();
    const waiting = h.navigate('dashboard'); h.finish(); await waiting;
    expect(h.bind).toHaveBeenCalledOnce();
    expect(h.boot).not.toHaveBeenCalled();
  });
});
