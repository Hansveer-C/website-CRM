import { describe, expect, it } from 'vitest';
import { renderWebsiteStructureContent, renderWebsiteStructureRouteModal } from './website_structure';

const actions = { add: '<button>Add route</button>', edit: () => '<button>Edit page</button>', view: () => '<button>View live</button>', remove: () => '<button>Delete</button>' };

describe('Website Structure CRM renderer', () => {
  it('renders only supplied, escaped route structure for the active website', () => {
    const html = renderWebsiteStructureContent({ websiteName: '<Site A>', websiteUrl: 'https://a.example', canManageRoutes: true, routes: [{ id: 'a', path: '/<long>', destinationName: '<Page A>', isHomepage: false }] }, actions);
    expect(html).toContain('&lt;Site A&gt;'); expect(html).toContain('/&lt;long&gt;'); expect(html).toContain('&lt;Page A&gt;'); expect(html).not.toContain('Site B'); expect(html).toContain('Edit page');
  });
  it('renders empty and truthful unavailable route-management states', () => {
    const html = renderWebsiteStructureContent({ websiteName: 'A', websiteUrl: 'https://a.example', canManageRoutes: false, unavailableReason: 'Production routes are unavailable.', routes: [] }, actions);
    expect(html).toContain('No routes configured'); expect(html).toContain('Production routes are unavailable.');
  });
  it('renders a tokenized route modal with only supplied destination choices', () => {
    const html = renderWebsiteStructureRouteModal({ funnels: [{ id: 'a', name: 'Page A' }] });
    expect(html).toContain('Page A'); expect(html).not.toContain('Page B'); expect(html).toContain('aria-modal="true"'); expect(html).not.toContain('style=');
  });
});
