import { describe, expect, it } from 'vitest';
import { getWebsiteScopedEffectiveRoutes, renderWebsiteNavigationContent } from './website_navigation';

const actions = { add: '<button>Add</button>', edit: (id: string) => `<button>${id} Edit</button>`, remove: () => '<button>Delete</button>', move: () => '<button>Move</button>', toggle: () => '<button>Toggle</button>', adopt: 'window.adopt()', discard: '<button>Discard</button>', reload: '<button>Reload</button>' };
const item = { id: '00000000-0000-4000-8000-000000000001', label: 'Services', target_kind: 'internal' as const, target_value: 'f1', position: 0, visible: true, is_cta: false, resolved_href: '/services', resolution_status: 'resolved' as const };
describe('Website Navigation CRM renderer', () => {
  it('renders live, draft, and empty canonical states with actions', () => {
    expect(renderWebsiteNavigationContent({ websiteName: 'WashOps', authority: 'live', items: [item], legacyItems: [] }, actions)).toContain('Live');
    expect(renderWebsiteNavigationContent({ websiteName: 'WashOps', authority: 'draft', items: [item], legacyItems: [] }, actions)).toContain('Discard');
    expect(renderWebsiteNavigationContent({ websiteName: 'WashOps', authority: 'live', items: [], legacyItems: [] }, actions)).toContain('No menu items yet');
  });
  it('keeps legacy authority visible and read-only until explicit adoption', () => {
    const html = renderWebsiteNavigationContent({ websiteName: 'Wash<script>', authority: 'legacy', items: [], legacyItems: [{ label: '<Home>', path: '/<home>', visible: true }] }, actions);
    expect(html).toContain('Legacy navigation'); expect(html).toContain('&lt;Home&gt;'); expect(html).toContain('Review conversion'); expect(html).not.toContain('Unpublished changes');
  });
  it('escapes hostile labels/targets and shows unresolved attention', () => {
    const html = renderWebsiteNavigationContent({ websiteName: 'W', authority: 'live', legacyItems: [], items: [{ ...item, label: '<img onerror=1>', target_value: 'javascript:alert(1)', resolved_href: null, resolution_status: 'unrouted', resolution_details: '<script>alert(1)</script>' }] }, actions);
    expect(html).toContain('&lt;img onerror=1&gt;'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Needs attention'); expect(html).not.toContain('<script>');
  });
  it('renders conflict as reload-required error', () => { const html = renderWebsiteNavigationContent({ websiteName: 'W', authority: 'conflict', items: [], legacyItems: [], error: 'Conflict' }, actions); expect(html).toContain('Navigation conflict'); expect(html).toContain('Reload'); expect(html).not.toContain('Discard'); });
  it('renders the canonical editor with every target kind and scoped internal choices', () => {
    const base = { websiteName: 'W', authority: 'live' as const, items: [item], legacyItems: [], editor: { isOpen: true, mode: 'add' as const, label: 'Call us', targetKind: 'internal' as const, targetValue: 'owned-funnel', visible: true, isCta: true, isSaving: false, errorMessage: null, destinations: [{ value: 'owned-funnel', label: 'Owned Page (/owned)' }] } };
    const internal = renderWebsiteNavigationContent(base, actions);
    expect(internal).toContain('Owned Page (/owned)'); expect(internal).toContain('Display as CTA'); expect(internal).not.toContain('foreign-funnel');
    for (const targetKind of ['homepage', 'external', 'phone', 'email'] as const) expect(renderWebsiteNavigationContent({ ...base, editor: { ...base.editor, targetKind } }, actions)).toContain(targetKind === 'homepage' ? 'homepage' : targetKind === 'external' ? 'External URL' : targetKind === 'phone' ? 'Phone number' : 'Email address');
  });
  it('renders visible legacy review with unresolved candidates and confirmation guard', () => {
    const html = renderWebsiteNavigationContent({ websiteName: 'W', authority: 'legacy', items: [], legacyItems: [], adoptionReview: { isOpen: true, isSubmitting: false, errorMessage: null, candidates: [{ id: 'candidate-1', label: 'Legacy', originalTarget: '/missing', status: 'needs_attention', reason: 'No matching page' }] } }, actions);
    expect(html).toContain('Review legacy conversion'); expect(html).toContain('needs attention'); expect(html).toContain('disabled'); expect(html).toContain('Choose destination');
  });
  it('renders the candidate editor as the only active CRM modal while preserving adoption review state', () => {
    const html = renderWebsiteNavigationContent({ websiteName: 'W', authority: 'legacy', items: [], legacyItems: [], editor: { isOpen: true, mode: 'resolve_legacy', label: 'Legacy', targetKind: 'internal', targetValue: 'a-funnel', visible: true, isCta: false, isSaving: false, errorMessage: null, destinations: [{ value: 'a-funnel', label: 'Site A page (/a)' }] }, adoptionReview: { isOpen: true, isSubmitting: false, errorMessage: null, candidates: [{ id: 'candidate-1', label: 'Legacy', originalTarget: '/missing', status: 'needs_attention', reason: 'No matching page' }] } }, actions);
    expect((html.match(/aria-modal="true"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('Resolve legacy destination');
    expect(html).not.toContain('Review legacy conversion');
  });
  it('scopes effective routes to the explicitly selected navigation website, including draft routes', () => {
    const routes = [
      { id: 'route-a', website_id: 'site-a', path: '/a-draft', funnel_id: 'funnel-a', live_path: null, draft_path: '/a-draft', is_draft_override: true, is_staged_delete: false, is_new_draft: true },
      { id: 'route-b', website_id: 'site-b', path: '/b', funnel_id: 'funnel-b', live_path: '/b', draft_path: null, is_draft_override: false, is_staged_delete: false, is_new_draft: false }
    ];
    expect(getWebsiteScopedEffectiveRoutes('site-a', routes)).toEqual([routes[0]]);
    expect(getWebsiteScopedEffectiveRoutes('site-a', routes).map(route => route.funnel_id)).not.toContain('funnel-b');
  });
  it('surfaces non-conflict save errors in ready state', () => {
    expect(renderWebsiteNavigationContent({ websiteName: 'W', authority: 'live', items: [item], legacyItems: [], error: 'Navigation repository unavailable' }, actions)).toContain('Navigation repository unavailable');
  });
});
