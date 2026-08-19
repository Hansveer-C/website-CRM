import { describe, expect, it, vi } from 'vitest';
import { BuilderReorderPagesController } from './builder_reorder_pages_controller';
import { PagesRepo } from './pages_repo_supabase';
import type { Page } from './types';

describe('BuilderReorderPagesController', () => {
  const samplePages: Page[] = [
    { id: 'p1', user_id: 'u1', name: 'Page 1', slug: 'page-1', status: 'draft', funnel_id: 'f1', step_order: 0, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01' },
    { id: 'p2', user_id: 'u1', name: 'Page 2', slug: 'page-2', status: 'draft', funnel_id: 'f1', step_order: 1, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-02' },
    { id: 'p3', user_id: 'u1', name: 'Page 3', slug: 'page-3', status: 'draft', funnel_id: 'f1', step_order: 2, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-03' }
  ];

  it('moves page down correctly and invokes PagesRepo.reorderPages', async () => {
    let reorderedPages: Page[] | undefined;
    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
      success: true,
      data: {
        funnel_id: 'f1',
        pages: [
          { ...samplePages[1], step_order: 0 },
          { ...samplePages[0], step_order: 1 },
          { ...samplePages[2], step_order: 2 }
        ]
      }
    });

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: (pages) => {
        reorderedPages = pages;
      }
    }));

    const result = await controller.movePageDown('p1');
    expect(result).toBe(true);
    expect(reorderSpy).toHaveBeenCalledWith('f1', ['p2', 'p1', 'p3'], ['p1', 'p2', 'p3'], 'u1', undefined);
    expect(controller.status).toBe('success');
    expect(reorderedPages?.map(p => p.id)).toEqual(['p2', 'p1', 'p3']);
    reorderSpy.mockRestore();
  });

  it('moves page up correctly', async () => {
    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
      success: true,
      data: {
        funnel_id: 'f1',
        pages: [
          { ...samplePages[0], step_order: 0 },
          { ...samplePages[2], step_order: 1 },
          { ...samplePages[1], step_order: 2 }
        ]
      }
    });

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages
    }));

    const result = await controller.movePageUp('p3');
    expect(result).toBe(true);
    expect(reorderSpy).toHaveBeenCalledWith('f1', ['p1', 'p3', 'p2'], ['p1', 'p2', 'p3'], 'u1', undefined);
    expect(controller.status).toBe('success');
    reorderSpy.mockRestore();
  });

  it('first page cannot move up (returns false, 0 RPC calls)', async () => {
    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages');
    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages
    }));

    const result = await controller.movePageUp('p1');
    expect(result).toBe(false);
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(controller.status).toBe('idle');
    reorderSpy.mockRestore();
  });

  it('last page cannot move down (returns false, 0 RPC calls)', async () => {
    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages');
    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages
    }));

    const result = await controller.movePageDown('p3');
    expect(result).toBe(false);
    expect(reorderSpy).not.toHaveBeenCalled();
    expect(controller.status).toBe('idle');
    reorderSpy.mockRestore();
  });

  it('ignores rapid repeated calls while reordering is in progress', async () => {
    let resolveReorder: (val: any) => void;
    const pendingPromise = new Promise(resolve => {
      resolveReorder = resolve;
    });

    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => pendingPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages
    }));

    const firstCall = controller.movePageDown('p1');
    expect(controller.isReordering).toBe(true);

    const secondCall = await controller.movePageDown('p2');
    expect(secondCall).toBe(false);
    expect(reorderSpy).toHaveBeenCalledTimes(1);

    resolveReorder!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });
    await firstCall;
    expect(controller.isReordering).toBe(false);
    reorderSpy.mockRestore();
  });

  it('handles CONFLICT error with truthful user message and triggers onConflict callback', async () => {
    let conflictTriggered = false;
    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
      success: false,
      code: 'CONFLICT',
      error: 'The page order changed elsewhere. Reload and try again.'
    });

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onConflict: () => {
        conflictTriggered = true;
      }
    }));

    const result = await controller.movePageDown('p1');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('The page order changed elsewhere. Reload and try again.');
    expect(conflictTriggered).toBe(true);
    reorderSpy.mockRestore();
  });

  it('stale async guard: switching website while RPC is in flight suppresses state mutation', async () => {
    let website = 'w1';
    let reorderedInvoked = false;

    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => {
      resolveRpc = resolve;
    });

    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: website,
      pages: samplePages,
      onPagesReordered: () => {
        reorderedInvoked = true;
      }
    }));

    const reorderPromise = controller.movePageDown('p1');

    // Switch website before RPC completes
    website = 'w2';

    resolveRpc!({
      success: true,
      data: {
        funnel_id: 'f1',
        pages: [
          { ...samplePages[1], step_order: 0 },
          { ...samplePages[0], step_order: 1 },
          { ...samplePages[2], step_order: 2 }
        ]
      }
    });

    const result = await reorderPromise;
    expect(result).toBe(false);
    expect(reorderedInvoked).toBe(false);
    reorderSpy.mockRestore();
  });
});
