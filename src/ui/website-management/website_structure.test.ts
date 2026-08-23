import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Funnel, Website, WebsiteRoute } from '../../types';
import {
  canDeleteWebsiteStructureRoute,
  getEligibleWebsiteStructureFunnels,
  isWebsiteStructureRouteDestination,
  renderWebsiteStructureContent,
  renderWebsiteStructureRouteModal
} from './website_structure';

const actions = { add: '<button>Add route</button>', edit: () => '<button>Edit page</button>', view: () => '<button>View live</button>', remove: () => '<button>Delete</button>' };
const website = (id: string, userId = 'u1'): Website => ({ id, user_id: userId, name: `Site ${id}`, domain: null, subdomain: id, homepage_funnel_id: null, created_at: '', updated_at: '' });
const funnel = (id: string, userId = 'u1', websiteId: string | null = 'site-a', name = `Page ${id}`): Funnel => ({ id, user_id: userId, website_id: websiteId, name, status: 'draft', created_at: '', updated_at: '' });
const route = (id: string, path: string): WebsiteRoute => ({ id, website_id: 'site-a', funnel_id: 'funnel-a', path, created_at: '' });

describe('Website Structure route ownership', () => {
  const siteA = website('site-a');
  const siteB = website('site-b');
  const funnels = [
    funnel('funnel-a', 'u1', 'site-a', 'Unrouted A'),
    funnel('funnel-b', 'u1', 'site-b', 'Only B'),
    funnel('standalone', 'u1', null, 'Standalone'),
    funnel('foreign', 'u2', 'site-a', 'Foreign')
  ];

  it('uses canonical Website ownership so an unrouted Funnel is eligible for its first route', () => {
    expect(getEligibleWebsiteStructureFunnels({ actingUserId: 'u1', website: siteA, funnels }).map(item => item.id)).toEqual(['funnel-a']);
  });

  it('refreshes destination eligibility per Website without leaking same-tenant, standalone, or foreign Funnels', () => {
    expect(getEligibleWebsiteStructureFunnels({ actingUserId: 'u1', website: siteB, funnels }).map(item => item.id)).toEqual(['funnel-b']);
    expect(getEligibleWebsiteStructureFunnels({ actingUserId: 'u1', website: undefined, funnels })).toEqual([]);
  });

  it('fails closed for forged, standalone, foreign, and nonexistent route destinations', () => {
    expect(isWebsiteStructureRouteDestination({ actingUserId: 'u1', website: siteA, funnel: funnels[0] })).toBe(true);
    expect(isWebsiteStructureRouteDestination({ actingUserId: 'u1', website: siteA, funnel: funnels[1] })).toBe(false);
    expect(isWebsiteStructureRouteDestination({ actingUserId: 'u1', website: siteA, funnel: funnels[2] })).toBe(false);
    expect(isWebsiteStructureRouteDestination({ actingUserId: 'u1', website: siteA, funnel: funnels[3] })).toBe(false);
    expect(isWebsiteStructureRouteDestination({ actingUserId: 'u1', website: siteA, funnel: undefined })).toBe(false);
  });

  it('blocks direct root-route deletion while allowing non-root local deletion', () => {
    expect(canDeleteWebsiteStructureRoute(route('home', '/'))).toBe(false);
    expect(canDeleteWebsiteStructureRoute(route('services', '/services'))).toBe(true);
    expect(canDeleteWebsiteStructureRoute(undefined)).toBe(false);
  });

  it('wires the local mutation handlers through canonical ownership and root-delete guards', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).toContain('isWebsiteStructureRouteDestination({ actingUserId: userId, website, funnel: destination })');
    expect(main).toContain('if (!canDeleteWebsiteStructureRoute(route))');
    const editStart = main.indexOf('(window as any).editWebsiteStructureRoute =');
    const viewStart = main.indexOf('(window as any).viewWebsiteStructureRoute =');
    const nextHandlerStart = main.indexOf('(window as any).updateSettingsField =');
    expect(editStart).toBeGreaterThan(-1);
    expect(viewStart).toBeGreaterThan(editStart);
    expect(nextHandlerStart).toBeGreaterThan(viewStart);
    const editHandler = main.slice(editStart, viewStart);
    const viewHandler = main.slice(viewStart, nextHandlerStart);
    expect(editHandler).toContain('isWebsiteStructureRouteDestination');
    expect(viewHandler).toContain('isWebsiteStructureRouteDestination');
  });
});

describe('Website Structure CRM renderer', () => {
  it('renders only supplied, escaped route structure for the active website', () => {
    const html = renderWebsiteStructureContent({ websiteName: '<Site A>', websiteUrl: 'https://a.example', canManageRoutes: true, routes: [{ id: 'a', path: '/<long>', destinationName: '<Page A>', isHomepage: false }] }, actions);
    expect(html).toContain('&lt;Site A&gt;'); expect(html).toContain('/&lt;long&gt;'); expect(html).toContain('&lt;Page A&gt;'); expect(html).not.toContain('Site B'); expect(html).toContain('Edit page');
  });

  it('renders empty and truthful unavailable route-management states', () => {
    const html = renderWebsiteStructureContent({ websiteName: 'A', websiteUrl: 'https://a.example', canManageRoutes: false, unavailableReason: 'Production routes are unavailable.', routes: [] }, actions);
    expect(html).toContain('No routes configured'); expect(html).toContain('Production routes are unavailable.');
  });

  it('renders an accessible, escaped route modal with only supplied destination choices', () => {
    const html = renderWebsiteStructureRouteModal({ funnels: [{ id: 'a', name: '<Page A>' }] });
    expect(html).toContain('&lt;Page A&gt;'); expect(html).not.toContain('Page B'); expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"'); expect(html).toContain('aria-describedby="website-structure-route-description"'); expect(html).toContain("event.key === 'Escape'"); expect(html).not.toContain('style=');
  });
});
