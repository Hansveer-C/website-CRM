import { describe, expect, it } from 'vitest';
import type { PublicSitePayload } from '../supabase/functions/_shared/public_site_contract';
import { adaptPublicSitePayload } from './public_site_adapter';

function payload(): PublicSitePayload {
  return {
    schemaVersion: 1,
    requestedHost: 'clean.example.com',
    requestedPath: '/',
    website: { id: 'website-1', name: 'Clean Co' },
    route: { id: 'route-1', websiteId: 'website-1', path: '/', funnelId: 'funnel-1' },
    settings: { businessName: 'Clean Co', phone: '555-0100' },
    layout: { header: { navigation: [] }, footer: { links: [] } },
    page: { id: 'page-1', name: 'Home', slug: 'home', path: '/' },
    sections: [
      { id: 'b', type: 'unknown-custom', order: 2, content: { custom: true }, styles: {} },
      { id: 'hidden', type: 'offer', order: 1, content: { hidden: true }, styles: { visible: false } },
      { id: 'a', type: 'hero', order: 1, content: { title: 'Hello' }, styles: {} }
    ],
    publication: { source: 'revision', fingerprint: 'fingerprint' }
  };
}

describe('adaptPublicSitePayload', () => {
  it('converts sanitized transport fields to existing render shapes', () => {
    const model = adaptPublicSitePayload(payload());
    expect(model.website).toEqual({ id: 'website-1', name: 'Clean Co' });
    expect(model.route).toEqual({ id: 'route-1', website_id: 'website-1', path: '/', funnel_id: 'funnel-1' });
    expect(model.settings.business_name).toBe('Clean Co');
    expect(model.page.id).toBe('page-1');
  });

  it('does not synthesize owner identities', () => {
    expect(JSON.stringify(adaptPublicSitePayload(payload()))).not.toContain('user_id');
  });

  it('keeps sections deterministically ordered', () => {
    expect(adaptPublicSitePayload(payload()).sections.map(section => section.id)).toEqual(['a', 'b']);
  });

  it('cannot reintroduce a hidden section', () => {
    expect(adaptPublicSitePayload(payload()).sections.some(section => section.id === 'hidden')).toBe(false);
  });

  it('preserves unknown public section types and content', () => {
    expect(adaptPublicSitePayload(payload()).sections[1]).toMatchObject({
      type: 'unknown-custom', content: { custom: true }
    });
  });

  it('does not share mutable content or style references', () => {
    const source = payload();
    const model = adaptPublicSitePayload(source);
    expect(model.sections[0].content).not.toBe(source.sections[2].content);
    expect(model.sections[0].styles).not.toBe(source.sections[2].styles);
  });

  it('contains no publication fingerprint or history', () => {
    const serialized = JSON.stringify(adaptPublicSitePayload(payload()));
    expect(serialized).not.toContain('fingerprint');
    expect(serialized).not.toContain('history');
  });
});
