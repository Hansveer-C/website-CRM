import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Website, WebsiteSettings } from '../../types';
import { renderWebsiteSettingsContent, renderWebsiteSettingsSaveAction } from './website_settings';
const settings = (overrides: Partial<WebsiteSettings> = {}): WebsiteSettings => ({ id: 'settings-a', user_id: 'u1', website_id: 'site-a', business_name: 'Wash Co', phone: '555-0100', sms_number: '', email: 'hello@example.com', logo_url: 'https://cdn.example/logo.png', primary_color: '#123456', facebook_pixel_id: 'pixel-1', gtm_id: 'GTM-1', auto_lead_sms_enabled: false, auto_lead_sms_template: '', missed_call_sms_enabled: false, missed_call_sms_template: '', created_at: '', ...overrides });
const website = (id = 'site-a', name = 'Acme'): Website => ({ id, user_id: 'u1', name, domain: 'acme.example', subdomain: 'acme', homepage_funnel_id: null, created_at: '', updated_at: '' });
describe('Website Settings renderer', () => {
  it('renders all supported sections and canonical save action', () => { const html = renderWebsiteSettingsContent({ settings: settings(), websites: [website()], activeWebsiteId: 'site-a' }); expect(html).toContain('Business Profile'); expect(html).toContain('Branding'); expect(html).toContain('Tracking &amp; Marketing'); expect(html).toContain('value="Wash Co"'); expect(html).toContain('Current value: #123456'); expect(renderWebsiteSettingsSaveAction()).toContain('wo-button--primary'); });
  it('escapes tenant values and rejects unsafe logo previews', () => { const html = renderWebsiteSettingsContent({ settings: settings({ business_name: '<img src=x onerror=1>', phone: '" onfocus="x', logo_url: 'javascript:alert(1)', facebook_pixel_id: '<pixel>' }), websites: [website('site-a', '<Site>'), website('site-b', 'Other')], activeWebsiteId: 'site-a' }); expect(html).toContain('&lt;img src=x onerror=1&gt;'); expect(html).not.toContain('<img src=x onerror=1>'); expect(html).not.toContain('src="javascript:'); expect(html).toContain('Preview unavailable'); expect(html).toContain('&lt;pixel&gt;'); expect(html).toContain('&lt;Site&gt;'); });
  it('renders the active multi-website switcher and no out-of-scope fields', () => { const html = renderWebsiteSettingsContent({ settings: settings(), websites: [website(), website('site-b', 'Second')], activeWebsiteId: 'site-b' }); expect(html).toContain('settings-website-select'); expect(html).toContain('value="site-b" selected'); expect(html).not.toContain('GA4'); expect(html).not.toContain('auto_lead_sms'); });
  it('uses associated labels and no legacy settings presentation', () => { const html = renderWebsiteSettingsContent({ settings: settings(), websites: [website()], activeWebsiteId: 'site-a' }); expect((html.match(/<label for=/g) || []).length).toBe(8); expect(html).not.toContain('class="card"'); expect(html).not.toContain('form-group'); expect(html).not.toContain('btn-primary'); expect(html).not.toMatch(/<h1\b/); });
  it('escapes adversarial payloads in every tenant-controlled field and selector attribute', () => {
    const payload = `"'><&</input><img src=x onerror=alert(1)><svg/onload=alert(1)>&#34;`;
    const html = renderWebsiteSettingsContent({ settings: settings({ business_name: payload, phone: payload, sms_number: payload, email: payload, logo_url: payload, primary_color: payload, facebook_pixel_id: payload, gtm_id: payload }), websites: [{ ...website(payload, payload), domain: payload }], activeWebsiteId: payload });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<svg/onload=alert(1)>');
    expect(html).not.toContain(`value="${payload}"`);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Preview unavailable');
  });
  it('accepts only intended logo preview schemes and emits one useful image', () => {
    for (const url of ['https://cdn.example/logo.png', 'http://cdn.example/logo.jpg', 'data:image/png;base64,aGVsbG8=']) {
      const html = renderWebsiteSettingsContent({ settings: settings({ logo_url: url }), websites: [website()], activeWebsiteId: 'site-a' });
      expect((html.match(/<img\b/g) || []).length).toBe(1);
      expect(html).toContain('alt="Business logo preview"');
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,<svg/onload=1>', 'data:image/svg+xml,<svg/onload=1>', 'ftp://example.com/logo.png', 'https://example.com/" onerror="x']) {
      const html = renderWebsiteSettingsContent({ settings: settings({ logo_url: url }), websites: [website()], activeWebsiteId: 'site-a' });
      expect(html).not.toMatch(/<img\b/);
      expect(html).toContain('Preview unavailable');
    }
  });
  it('uses unique field ids and keeps the application action independent of website color', () => {
    const html = renderWebsiteSettingsContent({ settings: settings({ primary_color: '#ff00ff' }), websites: [website(), website('site-b')], activeWebsiteId: 'site-a' });
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const save = renderWebsiteSettingsSaveAction();
    expect(save).toContain('wo-button--primary');
    expect(save).not.toContain('#ff00ff');
    expect(save).not.toContain('var(--primary-color)');
    expect(save).not.toContain('style=');
  });
  it('removes the duplicate legacy renderer and guards delayed Settings operations by Website context', () => {
    const main = readFileSync(resolve(__dirname, '../../main.ts'), 'utf8');
    expect(main).not.toContain('renderLegacyWebsiteSettings');
    expect(main).toContain("const operationWebsiteId = getActiveSettingsWebsite()?.id ?? null;");
    expect((main.match(/getActiveSettingsWebsite\(\)\?\.id !== operationWebsiteId/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
