import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Activity, Contact, Opportunity, Quote } from '../../types';
import { renderApplicationShell } from '../shell';
import {
  createDashboardLoadingShellOptions,
  createDashboardShellOptions,
  renderDashboardContent,
  renderDashboardLoadingContent
} from './dashboard';
import { createDashboardViewModel, type CreateDashboardViewModelInput } from './dashboard_model';

const NOW = new Date('2026-08-21T12:00:00.000Z');

const contacts: Contact[] = [
  {
    id: 'contact-new', user_id: 'user-1', name: 'Avery Client', phone: '555-0101', email: 'avery@example.com',
    address: '1 Main St', tags: ['lead'], source: 'Public website', status: 'lead',
    created_at: '2026-08-21T06:00:00.000Z'
  },
  {
    id: 'contact-customer', user_id: 'user-1', name: 'Morgan Customer', phone: '555-0102', email: 'morgan@example.com',
    address: '2 Main St', tags: ['customer'], source: 'Referral', status: 'customer',
    created_at: '2026-08-18T06:00:00.000Z'
  },
  {
    id: 'contact-foreign', user_id: 'user-2', name: 'Foreign Contact', phone: '555-9999', email: 'foreign@example.com',
    address: 'Outside tenant', tags: ['lead'], source: 'Foreign source', status: 'lead',
    created_at: '2026-08-21T07:00:00.000Z'
  }
];

const opportunities: Opportunity[] = [
  {
    id: 'opportunity-new', user_id: 'user-1', contact_id: 'contact-new', pipeline_stage: 'New Lead',
    value: 250, status: 'open', created_at: '2026-08-21T06:05:00.000Z'
  },
  {
    id: 'opportunity-quoted', user_id: 'user-1', contact_id: 'contact-customer', pipeline_stage: 'Quote Sent',
    value: 350, status: 'open', created_at: '2026-08-20T06:05:00.000Z'
  },
  {
    id: 'opportunity-won', user_id: 'user-1', contact_id: 'contact-customer', pipeline_stage: 'Completed',
    value: 900, status: 'won', created_at: '2026-08-18T06:05:00.000Z'
  },
  {
    id: 'opportunity-foreign', user_id: 'user-2', contact_id: 'contact-foreign', pipeline_stage: 'New Lead',
    value: 99_999, status: 'open', created_at: '2026-08-21T07:05:00.000Z'
  }
];

const activities: Activity[] = [
  {
    id: 'activity-overdue', user_id: 'user-1', contact_id: 'contact-new', type: 'call',
    description: 'Follow up on house wash estimate', due_date: '2026-08-20T09:00:00.000Z', completed: false
  },
  {
    id: 'activity-completed', user_id: 'user-1', contact_id: 'contact-customer', type: 'sms',
    description: 'Sent appointment details', due_date: '2026-08-21T10:00:00.000Z', completed: true
  },
  {
    id: 'activity-foreign', user_id: 'user-2', contact_id: 'contact-foreign', type: 'visit',
    description: 'Foreign tenant activity', due_date: '2026-08-19T10:00:00.000Z', completed: false
  }
];

const quotes: Quote[] = [
  {
    id: 'quote-sent', user_id: 'user-1', contact_id: 'contact-new', opportunity_id: 'opportunity-new',
    status: 'sent', total_amount: 250, notes: 'House wash', created_at: '2026-08-21T07:00:00.000Z'
  },
  {
    id: 'quote-approved', user_id: 'user-1', contact_id: 'contact-customer', opportunity_id: 'opportunity-won',
    status: 'approved', total_amount: 900, notes: 'Completed work', created_at: '2026-08-18T07:00:00.000Z'
  },
  {
    id: 'quote-foreign', user_id: 'user-2', contact_id: 'contact-foreign', opportunity_id: 'opportunity-foreign',
    status: 'sent', total_amount: 99_999, notes: 'Foreign tenant', created_at: '2026-08-21T07:00:00.000Z'
  }
];

function input(overrides: Partial<CreateDashboardViewModelInput> = {}): CreateDashboardViewModelInput {
  return {
    userId: 'user-1',
    now: NOW,
    contacts,
    opportunities,
    activities,
    quotes,
    pipelineStages: ['New Lead', 'Quote Sent', 'Scheduled', 'Completed', 'Paid'],
    ...overrides
  };
}

function classCount(html: string, className: string): number {
  return [...html.matchAll(/class="([^"]*)"/g)]
    .filter(match => match[1].split(/\s+/).includes(className))
    .length;
}

function tagCount(html: string, tagName: string): number {
  return (html.match(new RegExp(`<${tagName}(?:\\s|>)`, 'g')) ?? []).length;
}

describe('Phase 1C / Task 7C.1 Dashboard visual and data architecture', () => {
  it('A. derives tenant-scoped KPI, attention, pipeline, quote, and lead-source values from real records', () => {
    const model = createDashboardViewModel(input());
    expect(Object.fromEntries(model.metrics.map(metric => [metric.id, metric.value]))).toEqual({
      'new-leads': 1,
      'open-opportunities': 2,
      'pipeline-value': 600,
      'sent-quotes': 1,
      'overdue-activities': 1
    });
    expect(model.attentionItems.map(item => [item.id, item.count])).toEqual([
      ['new-leads', 1],
      ['early-opportunities', 1],
      ['sent-quotes', 1],
      ['overdue-activities', 1]
    ]);
    expect(model.pipeline).toMatchObject({ openCount: 2, openValue: 600 });
    expect(model.pipeline.stages.map(stage => [stage.stage, stage.count, stage.value])).toEqual([
      ['New Lead', 1, 250],
      ['Quote Sent', 1, 350]
    ]);
    expect(model.quotes).toMatchObject({ totalCount: 2, sentValue: 250 });
    expect(model.leadSources).toMatchObject({ totalLeads: 1 });
    expect(model.leadSources.sources).toEqual([{ source: 'Public website', count: 1, percentage: 100 }]);
    expect(renderDashboardContent(model)).toContain('1 active lead');
    expect(JSON.stringify(model)).not.toContain('99999');
    expect(JSON.stringify(model)).not.toContain('Foreign');
  });

  it('B. renders coherent zero and empty states without customer-like placeholder records', () => {
    const model = createDashboardViewModel(input({ contacts: [], opportunities: [], activities: [], quotes: [] }));
    expect(model.metrics.map(metric => metric.value)).toEqual([0, 0, 0, 0, 0]);
    expect(model.attentionItems).toEqual([]);
    expect(model.pipeline.stages).toEqual([]);
    expect(model.activities.rows).toEqual([]);

    const html = renderDashboardContent(model);
    expect(html).toContain('Nothing needs immediate attention');
    expect(html).toContain('No open opportunities');
    expect(html).toContain('No quotes yet');
    expect(html).toContain('No activity yet');
    expect(html).toContain('No active lead sources');
    expect(html).not.toContain('John Doe');
    expect(html).not.toContain('Jane Smith');
  });

  it('C. escapes tenant-controlled contact, stage, source, and activity values in the actual Dashboard renderer', () => {
    const dangerous = '"><img src=x onerror=alert(1)>';
    const model = createDashboardViewModel(input({
      contacts: [{ ...contacts[0], name: dangerous, source: dangerous }],
      opportunities: [{ ...opportunities[0], pipeline_stage: dangerous }],
      pipelineStages: [dangerous],
      activities: [{ ...activities[0], description: `<script>${dangerous}</script>` }],
      quotes: []
    }));
    const html = renderDashboardContent(model);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;&gt;&lt;img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('D. contains no fabricated analytics, random business values, or fake trend deltas', () => {
    const rendererSource = readFileSync(new URL('./dashboard.ts', import.meta.url), 'utf8');
    const modelSource = readFileSync(new URL('./dashboard_model.ts', import.meta.url), 'utf8');
    const mainSource = readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');
    const dashboardSource = `${rendererSource}\n${modelSource}`;
    expect(dashboardSource).not.toContain('Math.random');
    expect(dashboardSource).not.toContain('formSubmissions');
    expect(dashboardSource).not.toContain('Top Converting Page');
    expect(dashboardSource).not.toMatch(/\+\d+(?:\.\d+)?%/);
    expect(dashboardSource.toLowerCase()).not.toContain('trend percentage');
    expect(mainSource).not.toContain('const formSubmissions =');
    expect(mainSource).not.toContain('const topPageName =');
  });

  it('E. renders real activity fields in operational order with explicit, honest timestamps and statuses', () => {
    const futureActivity: Activity = {
      ...activities[0],
      id: 'activity-future',
      description: 'Future annual reminder',
      due_date: '2027-08-21T10:00:00.000Z'
    };
    const model = createDashboardViewModel(input({ activities: [...activities, futureActivity], activityLimit: 3 }));
    expect(model.activities.rows.map(row => [row.id, row.contactName, row.status])).toEqual([
      ['activity-completed', 'Morgan Customer', 'Completed'],
      ['activity-overdue', 'Avery Client', 'Overdue'],
      ['activity-future', 'Avery Client', 'Open']
    ]);
    const html = renderDashboardContent(model);
    const completedIndex = html.indexOf('activity-completed');
    const overdueIndex = html.indexOf('activity-overdue');
    expect(completedIndex).toBeGreaterThan(-1);
    expect(overdueIndex).toBeGreaterThan(completedIndex);
    expect(html).toContain('<time datetime="2026-08-21T10:00:00.000Z">');
    expect(html).toContain('Date');
    expect(html).toContain('Was due');
    expect(html).toContain('Due');
    expect(html).not.toContain('Recorded');
    expect(html).toContain('Sent appointment details');
    expect(html).toContain('Follow up on house wash estimate');
  });

  it('F–H. composes the ready Dashboard inside one permanent shell, one main landmark, and one shell-owned h1', () => {
    const model = createDashboardViewModel(input());
    const content = renderDashboardContent(model);
    const html = renderApplicationShell(createDashboardShellOptions(model));
    expect(classCount(html, 'wo-shell')).toBe(1);
    expect(classCount(html, 'wo-shell-main')).toBe(1);
    expect(classCount(html, 'sidebar')).toBe(0);
    expect(tagCount(html, 'main')).toBe(1);
    expect(tagCount(html, 'h1')).toBe(1);
    expect(tagCount(content, 'h1')).toBe(0);
    expect(tagCount(content, 'h2')).toBe(3);
    expect(html).toContain('<h1 class="wo-shell-topbar-title">Dashboard</h1>');
  });

  it('I. represents partial failures as unavailable rather than false zeroes', () => {
    const model = createDashboardViewModel(input({
      availability: { quotes: false, activities: false }
    }));
    expect(model.metrics.find(metric => metric.id === 'sent-quotes')?.value).toBeNull();
    expect(model.metrics.find(metric => metric.id === 'overdue-activities')?.value).toBeNull();
    expect(model.unavailableEntities.map(entity => entity.key)).toEqual(['activities', 'quotes']);
    const html = renderDashboardContent(model);
    expect(html).toContain('data-crm-hydration-error');
    expect(html).toContain('Affected metrics show unavailable instead of zero.');
    expect(html).toContain('Quotes unavailable');
    expect(html).toContain('Activity unavailable');
    expect(html).toContain('data-dashboard-metric="sent-quotes">—</strong>');
  });

  it('J. keeps the loading state in the same shell architecture without fake record placeholders', () => {
    const content = renderDashboardLoadingContent();
    const html = renderApplicationShell(createDashboardLoadingShellOptions());
    expect(content).toContain('data-dashboard-state="loading"');
    expect(content).toContain('aria-busy="true"');
    expect(content).toContain('wo-dashboard-skeleton-card');
    expect(content).not.toContain('John Doe');
    expect(content).not.toMatch(/data-dashboard-metric=/);
    expect(classCount(html, 'wo-shell')).toBe(1);
    expect(classCount(html, 'wo-shell-main')).toBe(1);
    expect(tagCount(html, 'main')).toBe(1);
    expect(classCount(html, 'sidebar')).toBe(0);
  });

  it('K. exposes deliberate responsive structure and token-only Dashboard color ownership', () => {
    const css = readFileSync(new URL('./dashboard.css', import.meta.url), 'utf8');
    const html = renderDashboardContent(createDashboardViewModel(input()));
    expect(html).toContain('wo-dashboard-kpi-grid');
    expect(html).toContain('wo-dashboard-workflow-grid');
    expect(html).toContain('wo-dashboard-detail-grid');
    expect(html).toContain('wo-dashboard-activity-row');
    expect(css).toContain('@media (max-width: 1023px)');
    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('min-width: 0');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });

  it('L. reuses Task 7A cards, badges, buttons, and state primitives without an invoice KPI or parallel legacy cards', () => {
    const readyHtml = renderDashboardContent(createDashboardViewModel(input()));
    const emptyHtml = renderDashboardContent(createDashboardViewModel(input({ contacts: [], opportunities: [], activities: [], quotes: [] })));
    expect(readyHtml).toContain('class="wo-card');
    expect(readyHtml).toContain('class="wo-badge');
    expect(readyHtml).toContain('class="wo-button');
    expect(emptyHtml).toContain('class="wo-empty-state');
    expect(readyHtml).not.toMatch(/class="card(?:\s|")/);
    expect(readyHtml).not.toContain('data-dashboard-metric="invoice');
    expect(readyHtml).toContain('Estimated pipeline');
    expect(readyHtml).toContain('Sent quote value');
    expect(readyHtml).not.toContain('Pipeline revenue');
  });
});
