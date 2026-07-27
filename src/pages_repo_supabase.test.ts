import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPages, mockPageSections } from './db';
import { PagesRepo } from './pages_repo_supabase';
import type { Page } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

let originalPages: Page[];

beforeEach(() => {
  originalPages = structuredClone(mockPages);
  mockPages.push(
    { id: 'settings-page-a', user_id: 'settings-owner', name: 'A', slug: 'a', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-a' },
    { id: 'settings-page-b', user_id: 'settings-owner', name: 'B', slug: 'b', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-b' }
  );
});

afterEach(() => {
  mockPages.splice(0, mockPages.length, ...originalPages);
  vi.unstubAllGlobals();
});

describe('PagesRepo.createPage local adapter', () => {
  it('creates one owned draft with allowlisted defaults and no sections', async () => {
    const result = await PagesRepo.createPage({
      id: 'new-page-local', name: 'New page', slug: 'new-page', funnelId: 'fnl-1', stepOrder: 9
    }, 'system');
    expect(result).toMatchObject({
      success: true,
      data: { id: 'new-page-local', user_id: 'system', status: 'draft', funnel_id: 'fnl-1', step_order: 9 }
    });
    expect(mockPageSections.some(section => section.page_id === 'new-page-local')).toBe(false);
  });

  it('is idempotent by ID and rejects conflicting IDs and owner-wide slugs', async () => {
    const input = { id: 'new-page-idempotent', name: 'Idempotent', slug: 'idempotent', funnelId: 'fnl-1' };
    expect((await PagesRepo.createPage(input, 'system')).success).toBe(true);
    expect((await PagesRepo.createPage(input, 'system')).success).toBe(true);
    expect(mockPages.filter(page => page.id === input.id)).toHaveLength(1);
    expect(await PagesRepo.createPage({ ...input, name: 'Different' }, 'system')).toMatchObject({ success: false, code: 'ID_CONFLICT' });
    expect(await PagesRepo.createPage({ ...input, id: 'other-id' }, 'system')).toMatchObject({ success: false, code: '23505' });
  });

  it('persists and hydrates the shared local Page store', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });
    const input = { id: 'new-page-reload', name: 'Reload', slug: 'reload', funnelId: 'fnl-1' };
    expect((await PagesRepo.createPage(input, 'system')).success).toBe(true);
    mockPages.splice(mockPages.findIndex(page => page.id === input.id), 1);
    PagesRepo.hydrateLocalPages('system');
    expect(mockPages).toContainEqual(expect.objectContaining({ id: input.id, name: 'Reload' }));
  });
});

describe('PagesRepo.createPage Supabase adapter', () => {
  it('uses the trusted acting owner and returns the inserted row', async () => {
    let inserted: Record<string, unknown> | undefined;
    const selectQuery = {
      eq() { return this; },
      limit() { return this; },
      maybeSingle: async () => ({ data: null, error: null })
    };
    const client = {
      from: () => ({
        select: () => selectQuery,
        insert: (payload: Record<string, unknown>) => {
          inserted = payload;
          return { select: () => ({ single: async () => ({ data: { ...payload, created_at: 'now' }, error: null }) }) };
        }
      })
    } as unknown as SupabaseClient;
    const result = await PagesRepo.createPage({
      id: 'remote-id', name: 'Remote', slug: 'remote', funnelId: 'funnel', stepOrder: 4
    }, 'trusted-owner', client);
    expect(inserted).toMatchObject({ user_id: 'trusted-owner', status: 'draft', funnel_id: 'funnel', step_order: 4 });
    expect(inserted).not.toHaveProperty('website_id');
    expect(result).toMatchObject({ success: true, data: { id: 'remote-id', user_id: 'trusted-owner', status: 'draft' } });
  });

  it('returns the database conflict code without local fallback', async () => {
    const selectQuery = {
      eq() { return this; },
      limit() { return this; },
      maybeSingle: async () => ({ data: null, error: null })
    };
    const client = {
      from: () => ({
        select: () => selectQuery,
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '23505' } }) }) })
      })
    } as unknown as SupabaseClient;
    const before = mockPages.length;
    const result = await PagesRepo.createPage({ id: 'remote-conflict', name: 'Remote', slug: 'remote', funnelId: 'funnel' }, 'trusted-owner', client);
    expect(result).toMatchObject({ success: false, code: '23505' });
    expect(mockPages).toHaveLength(before);
  });
});

describe('PagesRepo.updatePageSettings local adapter', () => {
  it('updates only the supplied page metadata while preserving protected fields', async () => {
    const result = await PagesRepo.updatePageSettings(
      'settings-page-a',
      { name: 'Updated', seo_title: 'SEO' },
      'settings-owner'
    );
    expect(result).toMatchObject({ success: true, data: { id: 'settings-page-a', user_id: 'settings-owner', funnel_id: 'funnel-a', name: 'Updated', seo_title: 'SEO' } });
  });

  it('enforces owner scope and owner-scoped slug uniqueness', async () => {
    expect(await PagesRepo.updatePageSettings('settings-page-a', { name: 'Nope' }, 'other-owner')).toMatchObject({ success: false, code: 'NOT_FOUND' });
    expect(await PagesRepo.updatePageSettings('settings-page-a', { slug: 'b' }, 'settings-owner')).toMatchObject({ success: false, code: '23505' });
    expect(mockPages.find(page => page.id === 'settings-page-a')?.slug).toBe('a');
  });
});
