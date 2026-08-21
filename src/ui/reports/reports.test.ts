import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderApplicationShell } from '../shell';
import { renderReportsContent } from './reports';
import { createReportsViewModel } from './reports_model';

const userId = 'owner';
const contact = { id: 'c1', user_id: userId, name: 'Owned', phone: '', email: '', address: '', tags: [], source: 'Website', service: '', status: 'lead' as const, created_at: '2026-08-21T00:00:00.000Z' };
const opportunity = { id: 'o1', user_id: userId, contact_id: 'c1', pipeline_stage: 'Estimate', value: 1250, status: 'open' as const, created_at: '2026-08-21T00:00:00.000Z' };
const quote = { id: 'q1', user_id: userId, contact_id: 'c1', opportunity_id: 'o1', quote_number: 'Q1', status: 'sent' as const, total_amount: 900, created_at: '2026-08-21T00:00:00.000Z' };
const model = (overrides = {}) => createReportsViewModel({ userId, contacts: [contact], opportunities: [opportunity], quotes: [quote], ...overrides });

describe('Reports analytics', () => {
  it('uses owned rows only and groups deterministic lead sources', () => {
    const reports = model({ contacts: [{ ...contact, source: '  ' }, { ...contact, id: 'c2', source: 'Website' }, { ...contact, id: 'foreign', user_id: 'other', source: 'Foreign' }] });
    expect(reports.leadSources.total).toBe(2);
    expect(reports.leadSources.rows.map(row => [row.label, row.count, row.percentage])).toEqual([['Unspecified', 1, 50], ['Website', 1, 50]]);
  });

  it('uses only owned open opportunities for estimated pipeline', () => {
    const reports = model({ opportunities: [opportunity, { ...opportunity, id: 'closed', status: 'won' }, { ...opportunity, id: 'foreign', user_id: 'other', value: 99999 }] });
    expect(reports.pipeline.total).toBe(1);
    expect(reports.pipeline.value).toBe(1250);
    expect(reports.pipeline.rows[0]).toMatchObject({ label: 'Estimate', count: 1, value: 1250 });
  });

  it('derives quote workflow and quoted value from owned quotes', () => {
    const reports = model({ quotes: [quote, { ...quote, id: 'approved', status: 'approved', total_amount: 300 }, { ...quote, id: 'foreign', user_id: 'other', total_amount: 99999 }] });
    expect(reports.quotes.quotedValue).toBe(1200);
    expect(reports.quotes.statuses).toEqual([{ label: 'Draft', count: 0 }, { label: 'Sent', count: 1 }, { label: 'Approved', count: 1 }, { label: 'Rejected', count: 0 }]);
    expect(renderReportsContent(reports)).toContain('Quoted value');
    expect(renderReportsContent(reports)).not.toContain('Revenue Breakdown');
  });

  it('keeps unavailable data distinct from available empty collections and preserves partial sections', () => {
    const unavailable = model({ availability: { contacts: false, opportunities: true, quotes: false }, opportunities: [] });
    const html = renderReportsContent(unavailable);
    expect(html).toContain('Lead source data unavailable');
    expect(html).toContain('No open opportunities yet');
    expect(html).toContain('Quote data unavailable');
  });

  it('escapes tenant-controlled labels and composes one shell landmark', () => {
    const reports = model({ contacts: [{ ...contact, source: '<img onerror=alert(1)>' }], opportunities: [{ ...opportunity, pipeline_stage: '<script>x</script>' }] });
    const content = renderReportsContent(reports);
    expect(content).toContain('&lt;img onerror=alert(1)&gt;');
    expect(content).toContain('&lt;script&gt;x&lt;/script&gt;');
    const html = renderApplicationShell({ activeView: 'reports', title: 'Reports & Insights', contentVariant: 'wide', contentHtml: content });
    expect((html.match(/class="wo-shell"/g) ?? []).length).toBe(1);
    expect((html.match(/<main\b/g) ?? []).length).toBe(1);
    expect(html).not.toContain('class="sidebar"');
  });

  it('wires reports through production CRM hydration and removes fabricated analytics', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source.slice(source.indexOf('const CRM_DATA_VIEWS'), source.indexOf('function renderCrmDataLoading'))).toContain("'reports'");
    const reports = source.slice(source.indexOf('function renderReports()'), source.indexOf('(window as any).showAttachToWebsiteModal'));
    expect(reports).not.toContain('Google Search');
    expect(reports).not.toContain('Revenue Breakdown');
  });
});
