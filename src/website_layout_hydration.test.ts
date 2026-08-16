import { describe, expect, it } from 'vitest';
import type { Website, WebsiteLayout } from './types';
import { WebsiteLayoutHydrator, type WebsiteLayoutHydrationClient } from './website_layout_hydration';

const website = (id: string, userId = 'user-a') => ({ id, user_id: userId } as Website);
const layout = (id: string, websiteId: string): WebsiteLayout => ({
  id,
  website_id: websiteId,
  header_config: { logo_text: '', nav_items: [{ label: 'Home', path: '/', visible: true }] },
  footer_config: {},
  created_at: '2026-08-11T00:00:00Z',
  updated_at: '2026-08-11T00:00:00Z'
});

function client(rows: unknown[] | null, error: unknown = null): WebsiteLayoutHydrationClient {
  return { from: () => ({ select: () => ({ in: async () => ({ data: rows, error }) }) }) };
}

describe('WebsiteLayoutHydrator', () => {
  it('loads owned layouts and rejects wrong-owner rows', async () => {
    const target: WebsiteLayout[] = [];
    const hydrator = new WebsiteLayoutHydrator(async () => client([layout('owned', 'site-a'), layout('other', 'site-b')]), target);
    const state = await hydrator.hydrate('user-a', [website('site-a'), website('site-b', 'user-b')]);
    expect(state.status).toBe('loaded');
    expect(target.map(row => row.id)).toEqual(['owned']);
  });

  it('represents zero layouts without fabricating a fixture', async () => {
    const target = [layout('stale', 'site-old')];
    const hydrator = new WebsiteLayoutHydrator(async () => client([]), target);
    expect((await hydrator.hydrate('user-a', [website('site-a')])).status).toBe('empty');
    expect(target).toEqual([]);
  });

  it('represents load failure and clears previous-user rows', async () => {
    const target = [layout('stale', 'site-old')];
    const hydrator = new WebsiteLayoutHydrator(async () => client(null, { message: 'failed' }), target);
    expect((await hydrator.hydrate('user-b', [website('site-b', 'user-b')])).status).toBe('error');
    expect(target).toEqual([]);
  });

  it('replaces rows on refresh without duplicates', async () => {
    const target: WebsiteLayout[] = [];
    const hydrator = new WebsiteLayoutHydrator(async () => client([layout('one', 'site-a')]), target);
    await hydrator.hydrate('user-a', [website('site-a')]);
    await hydrator.hydrate('user-a', [website('site-a')]);
    expect(target).toHaveLength(1);
  });

  it('clear removes layouts and returns to idle for logout', async () => {
    const target: WebsiteLayout[] = [];
    const hydrator = new WebsiteLayoutHydrator(async () => client([layout('one', 'site-a')]), target);
    await hydrator.hydrate('user-a', [website('site-a')]);
    hydrator.clear();
    expect(hydrator.state.status).toBe('idle');
    expect(target).toEqual([]);
  });

  it('ignores a stale account response after an account switch and preserves the new account layout', async () => {
    const target: WebsiteLayout[] = [];
    let release!: (value: { data: unknown[]; error: null }) => void;
    const delayed = new Promise<{ data: unknown[]; error: null }>(resolve => { release = resolve; });
    const firstClient: WebsiteLayoutHydrationClient = { from: () => ({ select: () => ({ in: () => delayed }) }) };
    let activeClient: WebsiteLayoutHydrationClient = firstClient;
    const hydrator = new WebsiteLayoutHydrator(async () => activeClient, target);
    const first = hydrator.hydrate('user-a', [website('site-a')]);
    activeClient = client([layout('current', 'site-b')]);
    await hydrator.hydrate('user-b', [website('site-b', 'user-b')]);
    release({ data: [layout('stale', 'site-a')], error: null });
    await first;
    expect(target.map(row => row.id)).toEqual(['current']);
  });
});
