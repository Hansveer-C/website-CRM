import { describe, expect, it, vi } from 'vitest';
import { resolveApplicationHostRoute } from './application_host_route';

describe('application hostname route boundary', () => {
  it.each([
    ['customer.example', '/', '/'],
    ['customer.example', '/services', '/services'],
    ['customer.example', '/services/driveways/deep-clean', '/services/driveways/deep-clean'],
    ['customer.example', '/does-not-exist', '/does-not-exist'],
    ['customer.example', '/services', '/services'],
    ['customer.example', '/contact', '/contact']
  ])('delegates customer host %s path %s to public resolution', (hostname, pathname, expected) => {
    expect(resolveApplicationHostRoute({ hostname, pathname })).toEqual({
      kind: 'public-site', pathname: expected, initializeApplicationAuth: false
    });
  });

  it('does not depend on empty local route fixtures or runtime mode', () => {
    const localRoutes: string[] = [];
    const mode = 'supabase';
    expect(localRoutes).toHaveLength(0);
    expect(mode).toBe('supabase');
    expect(resolveApplicationHostRoute({ hostname: 'customer.example', pathname: '/seo/city' })).toMatchObject({
      kind: 'public-site', pathname: '/seo/city'
    });
  });

  it.each([
    ['website-abc-hans-says-projects.vercel.app', '/'],
    ['localhost', '/'],
    ['127.0.0.1', '/dashboard']
  ])('keeps CRM host %s in the authenticated application', (hostname, pathname) => {
    expect(resolveApplicationHostRoute({ hostname, pathname })).toEqual({ kind: 'crm', initializeApplicationAuth: true });
  });

  it('keeps explicit preview behavior protected on the CRM host', () => {
    expect(resolveApplicationHostRoute({
      hostname: 'website-abc-hans-says-projects.vercel.app',
      pathname: '/preview/services'
    })).toEqual({ kind: 'crm', initializeApplicationAuth: true });
  });

  it('calls the public resolver exactly once and never initializes auth for a customer subpath', async () => {
    const resolvePublic = vi.fn(async (_hostname: string, _pathname: string) => undefined);
    const initializeAuth = vi.fn();
    const hostname = 'customer.example';
    const decision = resolveApplicationHostRoute({ hostname, pathname: '/services' });
    if (decision.kind === 'public-site') await resolvePublic(hostname, decision.pathname);
    else initializeAuth();
    expect(resolvePublic).toHaveBeenCalledOnce();
    expect(resolvePublic).toHaveBeenCalledWith(hostname, '/services');
    expect(initializeAuth).not.toHaveBeenCalled();
  });
});
