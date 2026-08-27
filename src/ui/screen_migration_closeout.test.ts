import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFERRED_SCREEN_MIGRATION_STATES } from './screen_migration_state';

describe('Phase 1C Task 7C.7 closeout invariant', () => {
  it('removes Lead Capture from active legacy presentation and explicitly owns every audited deferred route', () => {
    const main = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8'); const start = main.indexOf('function renderLeadCapture'); const end = main.indexOf('async function handleLeadCaptureSubmission', start); const leadRenderer = main.slice(start, end);
    expect(leadRenderer).toContain('renderLeadCaptureContent()'); expect(leadRenderer).not.toContain('form-group'); expect(leadRenderer).not.toContain('btn-primary');
    expect(DEFERRED_SCREEN_MIGRATION_STATES.map(entry => entry.key)).toEqual(['marketing-funnels', 'marketing-funnel-detail', 'pages', 'page-sections', 'templates', 'pages-seo', 'quickstart', 'event-logs', 'qa-tools']);
  });
  it('keeps specialized and public boundaries out of deferred CRM ownership', () => {
    const views = DEFERRED_SCREEN_MIGRATION_STATES.map(entry => entry.view);
    for (const view of ['builder', 'components', 'site', 'preview']) expect(views).not.toContain(view);
  });
});
