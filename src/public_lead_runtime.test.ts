import { describe, expect, it } from 'vitest';
import { resolvePublicLeadRuntime, shouldUsePublicLeadEdge } from './public_lead_runtime';

describe('public lead runtime', () => {
  it('uses local for explicit local and development auto', () => {
    expect(resolvePublicLeadRuntime({ configuredMode: 'local', production: true })).toEqual({ success: true, value: { source: 'local' } });
    const automatic = resolvePublicLeadRuntime({ production: false });
    expect(automatic.success && automatic.value.source).toBe('local');
  });

  it('uses public-lead for edge and production auto', () => {
    const explicit = resolvePublicLeadRuntime({
      configuredMode: 'edge', production: false,
      explicitEndpoint: 'https://project.test/functions/v1/public-lead'
    });
    expect(explicit).toMatchObject({ success: true, value: { source: 'edge' } });
    expect(resolvePublicLeadRuntime({ production: true, supabaseUrl: 'https://project.supabase.co' }))
      .toEqual({ success: true, value: { source: 'edge', endpoint: 'https://project.supabase.co/functions/v1/public-lead' } });
  });

  it('fails closed in production and never falls back', () => {
    expect(resolvePublicLeadRuntime({ production: true })).toEqual({ success: false, message: 'Public lead submission is not configured.' });
    expect(resolvePublicLeadRuntime({ configuredMode: 'edge', production: true, explicitEndpoint: 'http://unsafe.test' }).success).toBe(false);
  });

  it('never selects edge for preview or non-public forms', () => {
    const runtime = resolvePublicLeadRuntime({ configuredMode: 'edge', production: true, explicitEndpoint: 'https://project.test/public-lead' });
    expect(shouldUsePublicLeadEdge(runtime, { isPublic: true, preview: true })).toBe(false);
    expect(shouldUsePublicLeadEdge(runtime, { isPublic: false, preview: false })).toBe(false);
    expect(shouldUsePublicLeadEdge(runtime, { isPublic: true, preview: false })).toBe(true);
  });
});
