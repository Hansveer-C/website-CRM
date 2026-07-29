import { describe, expect, it } from 'vitest';
import { buildApplicationLoginHash, resolveApplicationBootstrap, sanitizeApplicationReturnRoute } from './application_bootstrap';

const unauthenticated = { status: 'unauthenticated' } as const;
const authenticated = { status: 'authenticated', user: { id: 'u1' }, source: 'supabase' } as const;

describe('application bootstrap', () => {
  it.each(['', '#/dashboard', '#/website-dashboard', '#/builder?websiteId=w1&pageId=p1&action=edit'])('protects %s before authenticated rendering', hash => {
    const decision = resolveApplicationBootstrap({ pathname: '/', hash, authState: unauthenticated });
    expect(decision.action).toBe('login');
    if (hash) expect(decision).toMatchObject({ returnTo: hash });
  });

  it('keeps login stable while unauthenticated and avoids a redirect loop', () => {
    expect(resolveApplicationBootstrap({ pathname: '/', hash: '#/login', authState: unauthenticated })).toEqual({ action: 'login' });
    expect(resolveApplicationBootstrap({ pathname: '/', hash: '#/login?returnTo=%23%2Fdashboard', authState: unauthenticated })).toEqual({ action: 'login', returnTo: '#/dashboard' });
  });

  it('sends an authenticated login route to its safe return route or dashboard', () => {
    expect(resolveApplicationBootstrap({ pathname: '/', hash: '#/login', authState: authenticated })).toEqual({ action: 'authenticated', hash: '#/dashboard' });
    expect(resolveApplicationBootstrap({ pathname: '/', hash: buildApplicationLoginHash('#/website-dashboard'), authState: authenticated })).toEqual({ action: 'authenticated', hash: '#/website-dashboard' });
  });

  it('keeps explicit customer site paths outside CRM authentication', () => {
    expect(resolveApplicationBootstrap({ pathname: '/site/example', hash: '', authState: unauthenticated })).toEqual({ action: 'public' });
  });

  it('fails safely while auth/configuration is unavailable', () => {
    expect(resolveApplicationBootstrap({ pathname: '/', hash: '#/dashboard', authState: { status: 'unavailable' } })).toEqual({ action: 'unavailable' });
    expect(resolveApplicationBootstrap({ pathname: '/', hash: '#/dashboard', authState: { status: 'initializing' } })).toEqual({ action: 'unavailable' });
  });

  it('rejects unsafe or public return destinations', () => {
    expect(sanitizeApplicationReturnRoute('https://evil.example')).toBeUndefined();
    expect(sanitizeApplicationReturnRoute('#/login')).toBeUndefined();
    expect(sanitizeApplicationReturnRoute('#/site/secret')).toBeUndefined();
    expect(sanitizeApplicationReturnRoute('#/website-dashboard')).toBe('#/website-dashboard');
  });
});
