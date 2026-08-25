import { describe, expect, it } from 'vitest';
import type { Website, WebsiteRoute } from '../../types';
import { createLocalSeoPreviews, createLocalSeoViewModel, renderLocalSeoList, renderLocalSeoWizard } from './local_seo';

const website = (id = 'site-a', name = 'Wash Co'): Website => ({ id, user_id: 'u1', name, domain: 'wash.example', subdomain: '', homepage_funnel_id: null, created_at: '', updated_at: '' });
const route = (overrides: Partial<WebsiteRoute> = {}): WebsiteRoute => ({ id: 'route-a', website_id: 'site-a', path: '/driveway-cleaning-port-moody', slug: 'driveway-cleaning-port-moody', funnel_id: 'f1', is_seo_page: true, service: 'Driveway Cleaning', city: 'Port Moody', created_at: '', ...overrides });
const state = (overrides = {}) => ({ mode: 'wizard' as const, step: 1 as const, services: [], cities: [], websiteId: 'site-a', ...overrides });

describe('Local SEO presentation', () => {
  it('scopes list rows to the active owned website', () => {
    const model = createLocalSeoViewModel({ userId: 'u1', activeWebsiteId: 'site-a', websites: [website(), website('site-b', 'Second'), { ...website('site-c', 'Foreign'), user_id: 'u2' }], routes: [route(), route({ id: 'b', website_id: 'site-b', path: '/foreign' }), route({ id: 'c', website_id: 'site-c', path: '/foreign-event' })] });
    expect(model.website?.id).toBe('site-a'); expect(model.pages).toHaveLength(1); expect(model.pages[0].path).not.toContain('foreign');
  });

  it('escapes website and route data in the list', () => {
    const html = renderLocalSeoList({ website: website('site-a', '<img src=x onerror=1>'), pages: [route({ service: '<script>x</script>', city: '" autofocus', path: '/<bad>' })], batchAction: 'window.startSeoWizard()', viewAction: () => '', deleteAction: () => '' });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;'); expect(html).toContain('&lt;img src=x onerror=1&gt;'); expect(html).not.toContain('<script>x</script>');
  });

  it('renders canonical list controls without legacy presentation classes', () => {
    const html = renderLocalSeoList({ website: website(), pages: [route()], batchAction: 'window.startSeoWizard()', viewAction: () => '', deleteAction: () => '' });
    expect(html).toContain('wo-button--primary'); expect(html).toContain('wo-local-seo-card'); expect(html).not.toContain('class="card"'); expect(html).not.toContain('btn-primary'); expect(html).not.toMatch(/<h1\b/);
  });

  it('renders accessible services and location steps', () => {
    const stepOne = renderLocalSeoWizard({ state: state(), website: website(), nextAction: step => `window.nextSeoStep(${step})`, generateAction: 'window.finalizeSeoGen()' });
    const stepTwo = renderLocalSeoWizard({ state: state({ step: 2, services: ['Driveway Cleaning'] }), website: website(), nextAction: step => `window.nextSeoStep(${step})`, generateAction: 'window.finalizeSeoGen()' });
    expect(stepOne).toContain('label for="wizard-services"'); expect(stepOne).toContain('Step 1 of 3'); expect(stepTwo).toContain('label for="wizard-cities"'); expect(stepTwo).toContain('Back');
  });

  it('renders escaped combinations and semantic progress for preview', () => {
    const previews = createLocalSeoPreviews(['<b>Driveway</b>'], ['Port <img>']);
    const html = renderLocalSeoWizard({ state: state({ step: 3, services: ['<b>Driveway</b>'], cities: ['Port <img>'] }), website: website(), nextAction: step => `window.nextSeoStep(${step})`, generateAction: 'window.finalizeSeoGen()' });
    expect(previews).toEqual(['/bdrivewayb-port-img']); expect(html).toContain('aria-valuenow="3"'); expect(html).toContain('/bdrivewayb-port-img'); expect(html).not.toContain('<b>Driveway</b>'); expect(html).toContain('pages to generate');
  });
});
