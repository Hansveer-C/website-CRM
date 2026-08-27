import { describe, expect, it } from 'vitest';
import { DEFERRED_SCREEN_MIGRATION_STATES, validateScreenMigrationStates } from './screen_migration_state';
describe('Task 7C.7 screen migration state registry', () => {
  it('owns exactly the nine audited deferred surfaces with valid metadata', () => { expect(DEFERRED_SCREEN_MIGRATION_STATES).toHaveLength(9); expect(() => validateScreenMigrationStates()).not.toThrow(); });
  it('requires unique ownership and required alias successors', () => { expect(() => validateScreenMigrationStates([...DEFERRED_SCREEN_MIGRATION_STATES, DEFERRED_SCREEN_MIGRATION_STATES[0]])).toThrow('Duplicate'); expect(DEFERRED_SCREEN_MIGRATION_STATES.find(entry => entry.key === 'pages')?.successors).toEqual(['funnels', 'builder']); expect(DEFERRED_SCREEN_MIGRATION_STATES.find(entry => entry.key === 'pages-seo')?.successors).toContain('seo-pages'); });
  it('keeps internal tools explicit and limits deferred funnel detail to marketing mode', () => { expect(DEFERRED_SCREEN_MIGRATION_STATES.filter(entry => entry.state === 'internal-tool').map(entry => entry.key)).toEqual(['event-logs', 'qa-tools']); const detail = DEFERRED_SCREEN_MIGRATION_STATES.find(entry => entry.key === 'marketing-funnel-detail'); expect(detail?.conditional).toBe('marketing-funnel-detail'); expect(DEFERRED_SCREEN_MIGRATION_STATES.some(entry => entry.view === 'builder')).toBe(false); });
});
