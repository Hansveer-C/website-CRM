import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const localSeoSource = readFileSync(fileURLToPath(new URL('./ui/website-management/local_seo.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

describe('Website Settings explicit-selection wiring', () => {
  it('resolves the owned Website before querying settings', () => {
    const routeCase = source.indexOf("case 'website-settings':");
    const selection = source.indexOf('resolveWebsiteSettingsSelection({', routeCase);
    const query = source.indexOf("fetch('/api/settings')", routeCase);
    expect(routeCase).toBeGreaterThan(-1);
    expect(selection).toBeGreaterThan(routeCase);
    expect(query).toBeGreaterThan(selection);
    expect(source.slice(selection, query)).toContain("selection.status === 'selection-required'");
    expect(source.slice(selection, query)).toContain("selection.status === 'invalid'");
  });

  it('persists the exact selection in the hash and scopes saves through active Settings state', () => {
    expect(source).toContain('buildWebsiteSettingsRoute(activeSettingsWebsiteId)');
    expect(source).toContain("currentView === 'website-settings'\n    ? activeSettingsWebsiteId");
    expect(source).toContain("activeSettingsWebsiteId = selection.website.id");
  });

  it('clears Settings selection on logout/account reset without changing Builder or Preview resolution', () => {
    const clear = source.slice(source.indexOf('function clearProtectedRuntimeData'), source.indexOf('const CRM_DATA_VIEWS'));
    expect(clear).toContain('activeSettingsWebsiteId = null');
    expect(source).toContain('await renderSitePage(target.funnel.id');
    expect(source).toContain('}, true, undefined, target.page);');
  });

  it('resolves all Website-specific management routes before their render switch cases', () => {
    const selection = source.indexOf('if (isExplicitWebsiteManagementView(view))');
    const routeSwitch = source.indexOf('switch (view)', selection);
    expect(selection).toBeGreaterThan(-1);
    expect(routeSwitch).toBeGreaterThan(selection);
    expect(source.slice(selection, routeSwitch)).toContain('activeDashboardWebsiteId = selection.website.id');
    for (const view of ['funnels', 'website-navigation', 'website-structure', 'seo-pages']) {
      expect(source).toContain(`renderWebsiteManagementSwitcher('${view}')`);
    }
    expect(source).toContain('buildWebsiteManagementRoute(view, activeDashboardWebsiteId)');
  });

  it('carries the Website selected in Settings into every Website management link', () => {
    const managementOpen = source.slice(
      source.indexOf('(window as any).openWebsiteManagementView ='),
      source.indexOf('(window as any).selectWebsiteForManagement =')
    );
    expect(managementOpen).toContain("currentView === 'website-settings'\n    ? activeSettingsWebsiteId");
    expect(managementOpen).toContain("currentView === 'website-dashboard'\n      ? activeDashboardWebsiteId");
    expect(managementOpen).toContain("currentView === 'builder'\n        ? activeBuilderWebsiteId");
    expect(managementOpen.indexOf('activeSettingsWebsiteId')).toBeLessThan(managementOpen.indexOf('activeDashboardWebsiteId'));
    expect(managementOpen).toContain('site.id === preferredWebsiteId && site.user_id === userId');
    expect(managementOpen).toContain('websiteManagementRoute: route');
  });

  it('does not select the first Website for page creation, attachments, navigation, structure, or SEO', () => {
    expect(source).not.toMatch(/mockWebsites\.find\([^\n]+\)\s*\|\|\s*mockWebsites\[0\]/);
    expect(source).not.toContain('const websiteId = mockWebsites[0].id');
    expect(source).not.toContain('const website = mockWebsites[0]; // Assuming user has one website');
    expect(localSeoSource).toContain('page.website_id === website.id');
    expect(source).toContain('site.id === websiteId && site.user_id === userId');
  });
});
