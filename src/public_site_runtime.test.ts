import { describe, expect, it } from 'vitest';
import {
  PublicSiteRequestGate,
  derivePublicSiteLocation,
  normalizePublicSiteEndpoint,
  resolvePublicSiteRuntime
} from './public_site_runtime';

describe('resolvePublicSiteRuntime', () => {
  it('selects explicit local without an endpoint', () => {
    expect(resolvePublicSiteRuntime({ configuredMode: ' LOCAL ', production: true })).toEqual({
      success: true, value: { source: 'local' }
    });
  });

  it('selects explicit edge', () => {
    expect(resolvePublicSiteRuntime({ configuredMode: 'EdGe', production: false, supabaseUrl: 'https://project.supabase.co/' })).toEqual({
      success: true, value: { source: 'edge', endpoint: 'https://project.supabase.co/functions/v1/public-site' }
    });
  });

  it.each([undefined, '', '  ', 'auto'])('auto development selects local for %s', configuredMode => {
    expect(resolvePublicSiteRuntime({ configuredMode, production: false, supabaseUrl: 'https://project.supabase.co' })).toEqual({
      success: true, value: { source: 'local' }
    });
  });

  it('auto production selects edge', () => {
    expect(resolvePublicSiteRuntime({ production: true, supabaseUrl: 'https://project.supabase.co' })).toEqual({
      success: true, value: { source: 'edge', endpoint: 'https://project.supabase.co/functions/v1/public-site' }
    });
  });

  it('rejects an invalid mode', () => {
    expect(resolvePublicSiteRuntime({ configuredMode: 'fallback', production: false })).toMatchObject({ success: false, code: 'INVALID_MODE' });
  });

  it.each([
    { configuredMode: 'edge', production: false },
    { configuredMode: 'auto', production: true }
  ])('requires Edge configuration and never falls back: %#', options => {
    expect(resolvePublicSiteRuntime(options)).toMatchObject({ success: false, code: 'EDGE_NOT_CONFIGURED' });
  });

  it('normalizes an explicit endpoint', () => {
    expect(resolvePublicSiteRuntime({
      configuredMode: 'edge', production: false,
      explicitEndpoint: 'https://edge.example.com/functions/v1/public-site///'
    })).toMatchObject({
      success: true,
      value: { endpoint: 'https://edge.example.com/functions/v1/public-site' }
    });
  });

  it('requires HTTPS in production', () => {
    expect(resolvePublicSiteRuntime({
      configuredMode: 'edge', production: true,
      explicitEndpoint: 'http://edge.example.com/functions/v1/public-site'
    })).toMatchObject({ success: false, code: 'EDGE_NOT_CONFIGURED' });
  });

  it('allows explicit localhost HTTP only in development', () => {
    expect(normalizePublicSiteEndpoint('http://localhost:54321/functions/v1/public-site', false, true))
      .toBe('http://localhost:54321/functions/v1/public-site');
  });

  it('does not mutate resolver inputs', () => {
    const options = Object.freeze({ configuredMode: 'edge', production: false, supabaseUrl: 'https://project.supabase.co/' });
    resolvePublicSiteRuntime(options);
    expect(options).toEqual({ configuredMode: 'edge', production: false, supabaseUrl: 'https://project.supabase.co/' });
  });
});

describe('public route derivation and request generations', () => {
  it.each([
    ['/site', '/'], ['/site/', '/'], ['/site/driveway-cleaning', '/driveway-cleaning'],
    ['/preview', '/'], ['/preview/home', '/home'], ['/', '/'],
    ['/site/pressure%20washing', '/pressure washing']
  ])('derives %s as %s', (pathname, path) => {
    expect(derivePublicSiteLocation({
      pathname, hostname: 'clean.example.com', source: 'local', production: false
    })).toMatchObject({ success: true, path });
  });

  it('uses a development host override only for Edge development', () => {
    expect(derivePublicSiteLocation({
      pathname: '/site', hostname: 'localhost', source: 'edge', production: false,
      developmentHostOverride: 'clean.example.com'
    })).toMatchObject({ success: true, host: 'clean.example.com' });
  });

  it('never overrides a production host', () => {
    expect(derivePublicSiteLocation({
      pathname: '/', hostname: 'real.example.com', source: 'edge', production: true,
      developmentHostOverride: 'override.example.com'
    })).toMatchObject({ success: true, host: 'real.example.com' });
  });

  it('rejects localhost as an Edge customer host', () => {
    expect(derivePublicSiteLocation({
      pathname: '/site', hostname: 'localhost', source: 'edge', production: false
    })).toMatchObject({ success: false });
  });

  it('ignores stale request generations', () => {
    const gate = new PublicSiteRequestGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });
});
