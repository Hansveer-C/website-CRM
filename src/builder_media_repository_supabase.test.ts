import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseBuilderMediaRepository } from './builder_media_repository_supabase';

function png(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
}

function client(metadataError = false) {
  const upload = vi.fn(async () => ({ data: { path: 'path' }, error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const insert = vi.fn((row: Record<string, unknown>) => ({
    select: () => ({
      single: async () => metadataError
        ? { data: null, error: { message: 'insert failed' } }
        : {
            data: {
              ...row,
              created_at: '2026-07-26T00:00:00.000Z',
              updated_at: '2026-07-26T00:00:00.000Z'
            },
            error: null
          }
    })
  }));
  const value = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => {
      if (table === 'websites') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { id: 'site-1' }, error: null })
        };
        return query;
      }
      return { insert };
    }),
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } })
      }))
    }
  };
  return { value: value as unknown as SupabaseClient, upload, remove, insert };
}

describe('SupabaseBuilderMediaRepository', () => {
  it('authenticates, verifies website ownership, and uploads without overwrite', async () => {
    const mock = client();
    const repository = new SupabaseBuilderMediaRepository({
      client: mock.value,
      decodeDimensions: async () => ({ width: 1200, height: 800 }),
      createId: () => 'asset-1'
    });
    const asset = await repository.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'Clean.png' });
    expect(mock.upload).toHaveBeenCalledWith(
      'user-1/site-1/asset-1.png',
      expect.any(Blob),
      { contentType: 'image/png', upsert: false }
    );
    expect(asset).toMatchObject({ id: 'asset-1', userId: 'user-1', websiteId: 'site-1' });
  });

  it('rejects a foreign website before any object upload', async () => {
    const mock = client();
    const originalFrom = mock.value.from.bind(mock.value);
    (mock.value as unknown as { from: (table: string) => unknown }).from = vi.fn((table: string) => {
      if (table !== 'websites') return originalFrom(table);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: null, error: null })
      };
      return query;
    });
    const repository = new SupabaseBuilderMediaRepository({ client: mock.value });
    await expect(repository.uploadAsset({ websiteId: 'foreign', file: png(), displayName: 'No.png' }))
      .rejects.toThrow('BUILDER_MEDIA_WEBSITE_FORBIDDEN');
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it('inserts no metadata after a physical upload failure', async () => {
    const mock = client();
    mock.upload.mockResolvedValueOnce({ data: null, error: { message: 'network' } } as never);
    const repository = new SupabaseBuilderMediaRepository({
      client: mock.value,
      decodeDimensions: async () => ({ width: 1, height: 1 })
    });
    await expect(repository.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'No.png' }))
      .rejects.toThrow('BUILDER_MEDIA_UPLOAD_FAILED');
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it('lists only website-scoped metadata with deterministic pagination and escaped search', async () => {
    const row = {
      id: 'asset-1', user_id: 'user-1', website_id: 'site-1', bucket_id: 'media',
      object_path: 'user-1/site-1/asset-1.png', display_name: 'Driveway.png', mime_type: 'image/png',
      size_bytes: 8, width: 1, height: 1, created_at: '2026-07-26T00:00:00.000Z',
      updated_at: '2026-07-26T00:00:00.000Z'
    };
    const eq = vi.fn();
    const ilike = vi.fn();
    const range = vi.fn(async () => ({ data: [row], error: null }));
    const query: Record<string, unknown> = {};
    Object.assign(query, {
      select: () => query,
      eq: (...args: unknown[]) => { eq(...args); return query; },
      order: () => query,
      limit: () => query,
      ilike: (...args: unknown[]) => { ilike(...args); return query; },
      range
    });
    const mock = client();
    const originalFrom = mock.value.from.bind(mock.value);
    (mock.value as unknown as { from: (table: string) => unknown }).from = vi.fn(
      (table: string) => table === 'builder_media_assets' ? query : originalFrom(table)
    );
    const repository = new SupabaseBuilderMediaRepository({ client: mock.value });
    const page = await repository.listAssets('site-1', { search: '100%_clean', cursor: '40', limit: 20 });
    expect(eq).toHaveBeenCalledWith('website_id', 'site-1');
    expect(ilike).toHaveBeenCalledWith('display_name', '%100\\%\\_clean%');
    expect(range).toHaveBeenCalledWith(40, 60);
    expect(page.items[0]).toMatchObject({ id: 'asset-1', websiteId: 'site-1' });
    expect(Object.isFrozen(page.items[0])).toBe(true);
  });

  it('removes only the newly uploaded object when metadata creation fails', async () => {
    const mock = client(true);
    const repository = new SupabaseBuilderMediaRepository({
      client: mock.value,
      decodeDimensions: async () => ({ width: 1, height: 1 }),
      createId: () => 'asset-2'
    });
    await expect(repository.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'Broken.png' }))
      .rejects.toThrow('BUILDER_MEDIA_METADATA_FAILED');
    expect(mock.remove).toHaveBeenCalledWith(['user-1/site-1/asset-2.png']);
  });

  it('coalesces duplicate pending uploads of the same file and website', async () => {
    const mock = client();
    const repository = new SupabaseBuilderMediaRepository({
      client: mock.value,
      decodeDimensions: async () => ({ width: 1, height: 1 }),
      createId: () => 'asset-one-attempt'
    });
    const file = png();
    const input = { websiteId: 'site-1', file, displayName: 'Once.png' };
    const [first, second] = await Promise.all([
      repository.uploadAsset(input),
      repository.uploadAsset(input)
    ]);
    expect(first.id).toBe(second.id);
    expect(mock.upload).toHaveBeenCalledTimes(1);
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });
});
