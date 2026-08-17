import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPages, mockPageSections } from './db';
import { PagesRepo } from './pages_repo_supabase';
import type { Page, PageSection } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

let originalPages: Page[];
let originalSections: PageSection[];

beforeEach(() => {
  originalPages = structuredClone(mockPages);
  originalSections = structuredClone(mockPageSections);
  mockPages.push(
    { id: 'settings-page-a', user_id: 'settings-owner', name: 'A', slug: 'a', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-a' },
    { id: 'settings-page-b', user_id: 'settings-owner', name: 'B', slug: 'b', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-b' }
  );
});

afterEach(() => {
  mockPages.splice(0, mockPages.length, ...originalPages);
  mockPageSections.splice(0, mockPageSections.length, ...originalSections);
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
  it('calls create_builder_page RPC with reduced surface and returns the created draft page', async () => {
    let rpcCalledWith: { functionName: string; payload: Record<string, unknown> } | undefined;

    const rpcResponse = {
      id: 'remote-id',
      user_id: 'trusted-owner',
      name: 'Remote',
      slug: 'remote',
      status: 'draft',
      seo_title: '',
      seo_description: '',
      seo_keywords: [],
      schema_markup: '',
      created_at: '2026-08-17T05:00:00.000Z',
      funnel_id: 'funnel',
      step_order: 4
    };

    const client = {
      rpc: (functionName: string, payload: Record<string, unknown>) => {
        rpcCalledWith = { functionName, payload };
        return Promise.resolve({ data: rpcResponse, error: null });
      }
    } as unknown as SupabaseClient;

    const result = await PagesRepo.createPage({
      id: 'remote-id', name: 'Remote', slug: 'remote', funnelId: 'funnel'
    }, 'trusted-owner', client);

    expect(rpcCalledWith).toEqual({
      functionName: 'create_builder_page',
      payload: {
        p_id: 'remote-id',
        p_name: 'Remote',
        p_slug: 'remote',
        p_funnel_id: 'funnel'
      }
    });
    expect(result).toMatchObject({ success: true, data: { id: 'remote-id', user_id: 'trusted-owner', status: 'draft', funnel_id: 'funnel', step_order: 4 } });
  });

  it('returns database conflict code on duplicate slug error', async () => {
    const client = {
      rpc: () => Promise.resolve({ data: null, error: { code: 'PT409', message: 'Another page in this account already uses this URL.' } })
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

describe('PagesRepo.duplicatePage local adapter', () => {
  beforeEach(() => {
    mockPageSections.push(
      { id: 'sec-a-1', page_id: 'settings-page-a', type: 'hero', content: { title: 'Hero A' }, styles: {}, order: 0 },
      { id: 'sec-a-2', page_id: 'settings-page-a', type: 'services', content: { title: 'Services A' }, styles: {}, order: 1 }
    );
  });

  it('duplicates source page and its sections with new IDs, draft status, and preserved content', async () => {
    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'settings-page-a',
      newPageId: 'settings-page-a-copy'
    }, 'settings-owner');

    expect(result.success).toBe(true);
    expect(result.data?.page).toMatchObject({
      id: 'settings-page-a-copy',
      user_id: 'settings-owner',
      name: 'A (Copy)',
      slug: 'a-copy',
      status: 'draft',
      funnel_id: 'funnel-a'
    });

    expect(result.data?.sections).toHaveLength(2);
    expect(result.data?.sections[0].page_id).toBe('settings-page-a-copy');
    expect(result.data?.sections[0].id).not.toBe('sec-a-1');
    expect(result.data?.sections[0].type).toBe('hero');
    expect(result.data?.sections[1].type).toBe('services');

    // Confirm stored in mock storage
    expect(mockPages.some(p => p.id === 'settings-page-a-copy')).toBe(true);
    expect(mockPageSections.some(s => s.page_id === 'settings-page-a-copy')).toBe(true);
  });

  it('rejects cross-tenant duplication attempt', async () => {
    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'settings-page-a',
      newPageId: 'new-id'
    }, 'foreign-owner');

    expect(result).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('rejects duplicate newPageId conflict', async () => {
    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'settings-page-a',
      newPageId: 'settings-page-b'
    }, 'settings-owner');

    expect(result).toMatchObject({ success: false, code: 'ID_CONFLICT' });
  });

  it('rolls back in-memory changes if local section persistence throws an exception', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: (key: string) => {
          if (key.startsWith('mock_sections_')) {
            throw new Error('Disk full on sections');
          }
        },
        removeItem: () => {}
      }
    });

    const pageCountBefore = mockPages.length;
    const sectionCountBefore = mockPageSections.length;

    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'settings-page-a',
      newPageId: 'settings-page-rollback-1'
    }, 'settings-owner');

    expect(result).toMatchObject({ success: false, code: 'PERSISTENCE_ERROR' });
    expect(mockPages).toHaveLength(pageCountBefore);
    expect(mockPageSections).toHaveLength(sectionCountBefore);
    expect(mockPages.some(p => p.id === 'settings-page-rollback-1')).toBe(false);
  });

  it('rolls back sections key from localStorage if page persistence fails after section write', async () => {
    const removedKeys: string[] = [];
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: (key: string) => {
          if (key.startsWith('mock_pages_')) {
            throw new Error('Disk full on pages');
          }
        },
        removeItem: (key: string) => {
          removedKeys.push(key);
        }
      }
    });

    const pageCountBefore = mockPages.length;
    const sectionCountBefore = mockPageSections.length;

    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'settings-page-a',
      newPageId: 'settings-page-rollback-2'
    }, 'settings-owner');

    expect(result).toMatchObject({ success: false, code: 'PERSISTENCE_ERROR' });
    expect(mockPages).toHaveLength(pageCountBefore);
    expect(mockPageSections).toHaveLength(sectionCountBefore);
    expect(removedKeys).toContain('mock_sections_settings-owner:settings-page-rollback-2');
  });
});

describe('PagesRepo.duplicatePage Supabase adapter', () => {
  it('calls duplicate_builder_page RPC with p_page_id and p_new_page_id and returns mapped records', async () => {
    let rpcCalledWith: { functionName: string; payload: Record<string, unknown> } | undefined;

    const rpcResponse = {
      page: {
        id: 'dup-id',
        user_id: 'trusted-owner',
        name: 'Original (Copy)',
        slug: 'original-copy',
        status: 'draft',
        seo_title: 'SEO Title',
        seo_description: 'SEO Desc',
        seo_keywords: ['a'],
        schema_markup: '<script></script>',
        created_at: '2026-08-17T05:00:00.000Z',
        funnel_id: 'fnl-1',
        step_order: 2
      },
      sections: [
        {
          id: 'new-sec-1',
          page_id: 'dup-id',
          type: 'hero',
          content: { heading: 'Hello' },
          styles: { bg: '#fff' },
          order: 0
        }
      ]
    };

    const client = {
      rpc: (functionName: string, payload: Record<string, unknown>) => {
        rpcCalledWith = { functionName, payload };
        return Promise.resolve({ data: rpcResponse, error: null });
      }
    } as unknown as SupabaseClient;

    const result = await PagesRepo.duplicatePage({
      sourcePageId: 'src-id',
      newPageId: 'dup-id'
    }, 'trusted-owner', client);

    expect(result.success).toBe(true);
    expect(rpcCalledWith).toEqual({
      functionName: 'duplicate_builder_page',
      payload: {
        p_page_id: 'src-id',
        p_new_page_id: 'dup-id'
      }
    });
    expect(result.data?.page).toMatchObject({
      id: 'dup-id',
      user_id: 'trusted-owner',
      name: 'Original (Copy)',
      slug: 'original-copy',
      status: 'draft',
      schema_markup: '<script></script>'
    });
    expect(result.data?.sections).toHaveLength(1);
    expect(result.data?.sections[0].id).toBe('new-sec-1');
  });

  it('maps RPC error codes accurately', async () => {
    const errorCases = [
      { rpcError: { code: 'PT404', message: 'Page not found' }, expectedCode: 'NOT_FOUND' },
      { rpcError: { code: 'PT401', message: 'Authentication required' }, expectedCode: 'UNAUTHORIZED' },
      { rpcError: { code: 'PT403', message: 'Funnel ownership required' }, expectedCode: 'FORBIDDEN' },
      { rpcError: { code: 'PT409', message: 'Another page in this account already uses this URL.' }, expectedCode: 'CONFLICT' }
    ];

    for (const { rpcError, expectedCode } of errorCases) {
      const client = {
        rpc: () => Promise.resolve({ data: null, error: rpcError })
      } as unknown as SupabaseClient;

      const result = await PagesRepo.duplicatePage({
        sourcePageId: 'src-id',
        newPageId: 'dup-id'
      }, 'trusted-owner', client);

      expect(result).toMatchObject({ success: false, code: expectedCode });
    }
  });
});
