import { describe, expect, it } from 'vitest';
import { renderWebsiteNavigationContent } from './website_navigation';

const actions = { add: '<button>Add</button>', edit: (id: string) => `<button>${id} Edit</button>`, remove: () => '<button>Delete</button>', move: () => '<button>Move</button>', toggle: () => '<button>Toggle</button>', adopt: 'window.adopt()', revert: '<button>Reload</button>' };
const item = { id: '00000000-0000-4000-8000-000000000001', label: 'Services', target_kind: 'internal' as const, target_value: 'f1', position: 0, visible: true, is_cta: false, resolved_href: '/services', resolution_status: 'resolved' as const };
describe('Website Navigation CRM renderer', () => {
  it('renders live, draft, and empty canonical states with actions', () => {
    expect(renderWebsiteNavigationContent({ websiteName: 'WashOps', authority: 'live', items: [item], legacyItems: [] }, actions)).toContain('Live');
    expect(renderWebsiteNavigationContent({ websiteName: 'WashOps', authority: 'draft', items: [item], legacyItems: [] }, actions)).toContain('Unpublished changes');
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
  it('renders conflict as reload-required error', () => { expect(renderWebsiteNavigationContent({ websiteName: 'W', authority: 'conflict', items: [], legacyItems: [], error: 'Conflict' }, actions)).toContain('Navigation conflict'); });
});
