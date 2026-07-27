import { describe, expect, it, vi } from 'vitest';
import { LocalBuilderMediaRepository } from './builder_media_repository_local';
import type { BuilderMediaLocalRecord } from './builder_media_repository_local';

function png(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
}

describe('LocalBuilderMediaRepository', () => {
  it('stores binaries outside localStorage, lists website-scoped metadata, and revokes lazy URLs', async () => {
    const records: BuilderMediaLocalRecord[] = [];
    const urls = { createObjectURL: vi.fn(() => 'blob:asset-1'), revokeObjectURL: vi.fn() };
    const repository = new LocalBuilderMediaRepository({
      userId: 'user-1',
      database: {
        put: async record => { records.push(record); },
        getAll: async () => records
      },
      objectUrls: urls,
      decodeDimensions: async () => ({ width: 640, height: 480 }),
      createId: () => 'asset-1',
      now: () => new Date('2026-07-26T00:00:00.000Z')
    });
    const asset = await repository.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'Driveway.png' });
    expect(asset).toMatchObject({
      id: 'asset-1', websiteId: 'site-1', publicUrl: 'blob:asset-1',
      objectPath: 'user-1/site-1/asset-1.png', width: 640, height: 480
    });
    expect(records[0].blob).toBeInstanceOf(Blob);
    expect((records[0].asset as { publicUrl?: string }).publicUrl).toBeUndefined();
    expect((await repository.listAssets('other-site')).items).toEqual([]);
    expect((await repository.listAssets('site-1', { search: 'drive' })).items).toHaveLength(1);
    expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
    repository.dispose();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:asset-1');
  });

  it('persists stable metadata across repository reloads and enforces user and website scope', async () => {
    const records: BuilderMediaLocalRecord[] = [];
    const database = {
      put: async (record: BuilderMediaLocalRecord) => { records.push(record); },
      getAll: async () => records
    };
    const options = {
      database,
      objectUrls: { createObjectURL: () => 'blob:stable', revokeObjectURL: () => undefined },
      decodeDimensions: async () => ({ width: 2, height: 3 }),
      createId: () => 'asset-stable',
      now: () => new Date('2026-07-26T00:00:00.000Z')
    };
    const first = new LocalBuilderMediaRepository({ ...options, userId: 'user-1' });
    const uploaded = await first.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'C:\\fakepath\\Wash.png' });
    const reload = new LocalBuilderMediaRepository({ ...options, userId: 'user-1' });
    expect((await reload.listAssets('site-1')).items[0]).toMatchObject({
      id: uploaded.id, displayName: 'Wash.png', width: 2, height: 3
    });
    const otherUser = new LocalBuilderMediaRepository({ ...options, userId: 'user-2' });
    expect((await otherUser.listAssets('site-1')).items).toEqual([]);
    expect((await reload.listAssets('site-2')).items).toEqual([]);
  });

  it('surfaces IndexedDB quota failures without returning a phantom asset', async () => {
    const repository = new LocalBuilderMediaRepository({
      userId: 'user-1',
      database: {
        put: async () => { throw new Error('QuotaExceededError'); },
        getAll: async () => []
      },
      decodeDimensions: async () => ({ width: 1, height: 1 }),
      createId: () => 'asset-never-stored'
    });
    await expect(repository.uploadAsset({ websiteId: 'site-1', file: png(), displayName: 'Nope.png' }))
      .rejects.toThrow('QuotaExceededError');
    expect((await repository.listAssets('site-1')).items).toEqual([]);
  });
});
