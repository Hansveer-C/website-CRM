import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderApplicationShell } from '../shell';
import { renderLeadCaptureContent } from './lead_capture';

describe('WashOps Lead Capture', () => {
  it('uses the permanent form primitives without legacy Lead Capture classes', () => {
    const html = renderLeadCaptureContent();
    expect(html).toContain('wo-lead-capture'); expect(html).toContain('wo-card'); expect(html).toContain('wo-button--primary');
    expect(html).not.toContain('form-group'); expect(html).not.toContain('btn-primary'); expect(html).not.toContain('lead-form-container');
  });
  it('preserves every field, ids, labels, types, required semantics, and keyboard submit', () => {
    const html = renderLeadCaptureContent();
    for (const id of ['lead_name', 'lead_phone', 'lead_email', 'lead_address', 'lead_service_type', 'lead_message']) expect(html).toContain(`id="${id}"`);
    for (const id of ['lead_name', 'lead_phone', 'lead_email', 'lead_address', 'lead_service_type', 'lead_message']) expect(html).toContain(`for="${id}"`);
    expect((html.match(/ required/g) ?? []).length).toBe(6); expect(html).toContain('type="tel"'); expect(html).toContain('type="email"'); expect(html).toContain('type="submit"'); expect(html).toContain('autocomplete="street-address"');
  });
  it('contains no competing shell or page-level H1', () => {
    const content = renderLeadCaptureContent(); const shell = renderApplicationShell({ activeView: 'lead-capture', title: 'Lead Capture Form', contentVariant: 'standard', contentHtml: content });
    expect(content).not.toMatch(/<h1\b|<main\b|class="wo-shell"/); expect((shell.match(/<main\b/g) ?? []).length).toBe(1); expect((shell.match(/<h1\b/g) ?? []).length).toBe(1);
  });
  it('keeps the established mutation payload, request key, success, and failure wiring', () => {
    const main = readFileSync(fileURLToPath(new URL('../../main.ts', import.meta.url)), 'utf8'); const start = main.indexOf('async function handleLeadCaptureSubmission'); const end = main.indexOf('function renderOpportunities', start); const wiring = main.slice(start, end);
    for (const field of ['name,', 'phone,', 'email,', 'address,', 'service_type,', 'message,', "source: 'internal'", 'request_key: (window as any).internalLeadRequestKey']) expect(wiring).toContain(field);
    expect(wiring).toContain("window.navigateTo('clients')"); expect(wiring).toContain('Failed to create lead'); expect(wiring).toContain("internalLeadRequestKey = ''");
  });
});
