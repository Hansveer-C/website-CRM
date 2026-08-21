import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderApplicationShell } from '../shell';
import { createPipelineStages, renderOpportunitiesContent } from './opportunities';

const owner = 'owner';
const contact = { id: 'c1', user_id: owner, name: 'Owner contact', phone: null, email: null, address: '', tags: [], source: 'Referral', status: 'lead' as const, created_at: '2026-08-01T00:00:00Z' };
const pipeline = { id: 'p1', name: 'Pipeline', stages: ['New Lead', 'Quote Sent'] };
const opportunity = { id: 'o1', user_id: owner, contact_id: 'c1', pipeline_stage: 'New Lead', value: 250, status: 'open' as const, notes: 'Owned note', created_at: '2026-08-01T00:00:00Z' };
const base = { userId: owner, pipeline, opportunities: [opportunity], contacts: [contact], editable: true };

describe('WashOps opportunities pipeline', () => {
  it('scopes opportunities and related contacts to the acting tenant', () => {
    const html = renderOpportunitiesContent({ ...base, opportunities: [opportunity, { ...opportunity, id: 'foreign', user_id: 'other', value: 99999 }], contacts: [{ ...contact, user_id: 'other', name: 'FOREIGN CONTACT' }] });
    expect(html).toContain('Contact unavailable');
    expect(html).not.toContain('FOREIGN CONTACT');
    expect(html).not.toContain('99,999');
  });
  it('derives stage counts and estimated values from owned opportunities', () => {
    expect(createPipelineStages(base)).toEqual([{ stage: 'New Lead', opportunities: [opportunity], value: 250 }, { stage: 'Quote Sent', opportunities: [], value: 0 }]);
  });
  it('escapes tenant-controlled opportunity and contact values', () => {
    const html = renderOpportunitiesContent({ ...base, contacts: [{ ...contact, name: '<img onerror=1>' }], opportunities: [{ ...opportunity, notes: '<script>x</script>', service: '<svg>' }] });
    expect(html).toContain('&lt;img onerror=1&gt;'); expect(html).toContain('&lt;script&gt;x&lt;/script&gt;'); expect(html).not.toContain('<script>');
  });
  it('renders stage empty states and honest production read-only presentation', () => {
    const html = renderOpportunitiesContent({ ...base, opportunities: [], editable: false });
    expect(html).toContain('No opportunities'); expect(html).toContain('Read-only in production'); expect(html).not.toContain('draggable="true"');
  });
  it('composes in one shell and preserves contact-detail navigation', () => {
    const content = renderOpportunitiesContent(base); const html = renderApplicationShell({ activeView: 'opportunities', title: 'Pipeline', contentHtml: content, contentVariant: 'wide' });
    expect(content).toContain("window.navigateTo('contact-detail', 'c1')"); expect((html.match(/class="wo-shell"/g) ?? []).length).toBe(1); expect((html.match(/<main\b/g) ?? []).length).toBe(1); expect(html).not.toContain('class="sidebar"');
  });
  it('keeps local opportunity mutations scoped to the acting tenant', () => {
    const main = readFileSync(fileURLToPath(new URL('../../main.ts', import.meta.url)), 'utf8');
    expect(main).toContain('mockOpportunities.find(o => o.user_id === getActingUserId() && o.id === opportunity_id)');
    expect(main).toContain('mockOpportunities.find(o => o.user_id === getActingUserId() && o.id === oppId)');
  });
});
