import { describe, expect, it, vi } from 'vitest';
import { BuilderMediaController, applyBuilderMediaAssetSelection } from './builder_media_controller';
import type { BuilderMediaAsset } from './builder_media_asset';
import type { BuilderDocument } from './builder_document';
import { BuilderHistoryController } from './builder_history_controller';

const asset = (id: string): BuilderMediaAsset => ({
  id, userId: 'user-1', websiteId: 'site-1', bucketId: 'media', objectPath: `p/${id}.png`,
  publicUrl: `blob:${id}`, displayName: `${id}.png`, mimeType: 'image/png', sizeBytes: 8,
  width: 1, height: 1, createdAt: '2026-07-26T00:00:00.000Z', updatedAt: '2026-07-26T00:00:00.000Z'
});

const document = (): BuilderDocument => ({
  schemaVersion: 1,
  page: {
    id: 'page-1', user_id: 'user-1', name: 'Home', slug: 'home', status: 'draft',
    seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z'
  },
  sections: [{
    id: 'hero-1', page_id: 'page-1', type: 'hero', order: 0, variant: 'standard',
    content: { background_image: 'old-url', alt: 'Driveway cleaning', unknown: { keep: true } },
    styles: { visible: true }
  }, {
    id: 'gallery-1', page_id: 'page-1', type: 'gallery', order: 1, variant: 'comparison',
    content: { items: [{ id: 'existing', before: 'before', after: 'after', caption: 'Keep me' }], unknown: 7 },
    styles: { visible: true }
  }]
});

describe('BuilderMediaController', () => {
  it('guards against stale list responses', async () => {
    let resolveFirst: ((value: { items: BuilderMediaAsset[] }) => void) | undefined;
    const first = new Promise<{ items: BuilderMediaAsset[] }>(resolve => { resolveFirst = resolve; });
    const listAssets = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ items: [asset('new')] });
    const controller = new BuilderMediaController({ listAssets, uploadAsset: vi.fn() }, 'site-1');
    const oldLoad = controller.load();
    await controller.load();
    resolveFirst?.({ items: [asset('old')] });
    await oldLoad;
    expect(controller.state.assets.map(item => item.id)).toEqual(['new']);
  });

  it('uploads files independently and retains picker context', async () => {
    const uploadAsset = vi.fn()
      .mockResolvedValueOnce(asset('ok'))
      .mockRejectedValueOnce(new Error('bad image'));
    const controller = new BuilderMediaController({
      listAssets: vi.fn(async () => ({ items: [asset('ok')] })), uploadAsset
    }, 'site-1');
    controller.openPicker({ pageId: 'page-1', sectionId: 'hero-1', field: 'background_image' });
    const files = [
      { name: 'ok.png' } as File,
      { name: 'bad.png' } as File
    ];
    const results = await controller.upload(files);
    expect(results).toEqual([
      expect.objectContaining({ fileName: 'ok.png', asset: expect.objectContaining({ id: 'ok' }) }),
      { fileName: 'bad.png', error: 'bad image' }
    ]);
    expect(controller.state.pickerTarget).toMatchObject({ sectionId: 'hero-1' });
    expect(controller.state.uploading).toBe(0);
  });

  it('debounces search and appends pagination without duplicate cards', async () => {
    vi.useFakeTimers();
    const listAssets = vi.fn()
      .mockResolvedValueOnce({ items: [asset('a'), asset('b')], nextCursor: '2' })
      .mockResolvedValueOnce({ items: [asset('b'), asset('c')] });
    const controller = new BuilderMediaController({ listAssets, uploadAsset: vi.fn() }, 'site-1');
    controller.setSearch('drive');
    controller.setSearch('driveway');
    expect(listAssets).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(listAssets).toHaveBeenCalledTimes(1);
    await controller.load({ append: true });
    expect(controller.state.assets.map(item => item.id)).toEqual(['a', 'b', 'c']);
    vi.useRealTimers();
  });

  it('applies one image mutation without changing alt text or sibling fields and supports undo/redo', () => {
    const history = new BuilderHistoryController(document());
    const target = { pageId: 'page-1', sectionId: 'hero-1', field: 'background_image' };
    const result = history.applyMutation(
      current => applyBuilderMediaAssetSelection(current, target, [asset('selected')]),
      { category: 'content', sectionId: 'hero-1', fieldId: 'background_image', coalesce: false }
    );
    expect(result.changed).toBe(true);
    expect(history.document.sections[0].content).toEqual({
      background_image: 'blob:selected', alt: 'Driveway cleaning', unknown: { keep: true }
    });
    expect(history.undo()).toBe(true);
    expect(history.document.sections[0].content.background_image).toBe('old-url');
    expect(history.redo()).toBe(true);
    expect(history.document.sections[0].content.background_image).toBe('blob:selected');
  });

  it('adds multiple gallery assets in deterministic order with stable IDs and preserves existing fields', () => {
    let id = 0;
    const next = applyBuilderMediaAssetSelection(
      document(),
      { pageId: 'page-1', sectionId: 'gallery-1', field: 'items', multiple: true },
      [asset('one'), asset('two')],
      () => `gallery-item-${++id}`
    );
    expect(next.sections[1].content).toEqual({
      items: [
        { id: 'existing', before: 'before', after: 'after', caption: 'Keep me' },
        { id: 'gallery-item-1', before: 'blob:one', after: 'blob:one' },
        { id: 'gallery-item-2', before: 'blob:two', after: 'blob:two' }
      ],
      unknown: 7
    });
    expect(JSON.stringify(next)).not.toContain('userId');
  });

  it('rejects deleted sections and page switches without mutating the document', () => {
    const original = document();
    expect(() => applyBuilderMediaAssetSelection(original, {
      pageId: 'other-page', sectionId: 'hero-1', field: 'background_image'
    }, [asset('x')])).toThrow('BUILDER_MEDIA_TARGET_UNAVAILABLE');
    expect(() => applyBuilderMediaAssetSelection(original, {
      pageId: 'page-1', sectionId: 'deleted', field: 'background_image'
    }, [asset('x')])).toThrow('BUILDER_MEDIA_TARGET_UNAVAILABLE');
    expect(original.sections[0].content.background_image).toBe('old-url');
  });
});
