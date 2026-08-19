import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderReorderPagesController, resolveBuilderReorderLiveContext } from './builder_reorder_pages_controller';
import { PagesRepo } from './pages_repo_supabase';
import type { Page } from './types';

describe('BuilderReorderPagesController', () => {
  const samplePages: Page[] = [
    { id: 'p1', user_id: 'u1', name: 'Page 1', slug: 'page-1', status: 'draft', funnel_id: 'f1', step_order: 0, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01' },
    { id: 'p2', user_id: 'u1', name: 'Page 2', slug: 'page-2', status: 'draft', funnel_id: 'f1', step_order: 1, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-02' },
    { id: 'p3', user_id: 'u1', name: 'Page 3', slug: 'page-3', status: 'draft', funnel_id: 'f1', step_order: 2, seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-03' }
  ];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
  });

  it('handles CONFLICT error with truthful user message and triggers onConflict callback', async () => {
    let conflictTriggered = false;
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
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
  });

  it('handles AMBIGUOUS error code with uncertain-result user message and does not mutate pages', async () => {
    let reorderedInvoked = false;
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
      success: false,
      code: 'AMBIGUOUS',
      error: 'The reorder result is uncertain. Please reload to check.'
    });

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => {
        reorderedInvoked = true;
      }
    }));

    const result = await controller.movePageDown('p1');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('The reorder result is uncertain. Please reload to check.');
    expect(reorderedInvoked).toBe(false);
  });

  it('handles network throw with AMBIGUOUS uncertain-result message', async () => {
    let reorderedInvoked = false;
    vi.spyOn(PagesRepo, 'reorderPages').mockRejectedValue(new Error('Network disconnected'));

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => {
        reorderedInvoked = true;
      }
    }));

    const result = await controller.movePageDown('p1');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('The reorder result is uncertain. Please reload to check.');
    expect(reorderedInvoked).toBe(false);
  });

  it('A. Website switch: start reorder on Website A, switch to B, old completion does NOT mutate state', async () => {
    let website = 'site-a';
    let reorderedInvoked = false;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => {
      resolveRpc = resolve;
    });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: website,
      pages: samplePages,
      onPagesReordered: () => {
        reorderedInvoked = true;
      }
    }));

    const reorderPromise = controller.movePageDown('p1');
    website = 'site-b';
    resolveRpc!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });

    expect(await reorderPromise).toBe(false);
    expect(reorderedInvoked).toBe(false);
  });

  it('re-resolves Website identity from live Builder navigation even when caller context is frozen', async () => {
    const fakeWindow = {
      currentUser: 'u1',
      location: { hash: '#/builder?websiteId=w1&pageId=p1&action=pages' }
    } as any;
    vi.stubGlobal('window', fakeWindow);

    let reorderedInvoked = false;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => { resolveRpc = resolve; });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const frozenContext = {
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => { reorderedInvoked = true; }
    };
    const controller = new BuilderReorderPagesController(() => frozenContext);
    const pending = controller.movePageDown('p1');

    fakeWindow.location.hash = '#/builder?websiteId=w2&pageId=p1&action=pages';
    resolveRpc!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });

    expect(await pending).toBe(false);
    expect(reorderedInvoked).toBe(false);
  });

  it('B. Logout: start reorder as user A, log out / clear acting user, old completion does NOT mutate state', async () => {
    let currentUser: string | undefined = 'u1';
    let reorderedInvoked = false;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => {
      resolveRpc = resolve;
    });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: currentUser,
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => {
        reorderedInvoked = true;
      }
    }));

    const reorderPromise = controller.movePageDown('p1');
    currentUser = undefined;
    resolveRpc!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });

    expect(await reorderPromise).toBe(false);
    expect(reorderedInvoked).toBe(false);
  });

  it('re-resolves live authentication so logout suppresses stale completion with frozen caller context', async () => {
    const fakeWindow = {
      currentUser: 'u1',
      location: { hash: '#/builder?websiteId=w1&pageId=p1&action=pages' }
    } as any;
    vi.stubGlobal('window', fakeWindow);

    let reorderedInvoked = false;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => { resolveRpc = resolve; });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => { reorderedInvoked = true; }
    }));
    const pending = controller.movePageDown('p1');

    fakeWindow.currentUser = '';
    resolveRpc!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });

    expect(await pending).toBe(false);
    expect(reorderedInvoked).toBe(false);
  });

  it('C. Same Website active Page switch: start reorder on Page A, switch active page to Page B, completion preserves Page B', async () => {
    let activePageId = 'p1';
    let reorderedPages: Page[] | undefined;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => {
      resolveRpc = resolve;
    });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      activePageId,
      pages: samplePages,
      onPagesReordered: (pages) => {
        reorderedPages = pages;
      }
    }));

    const reorderPromise = controller.movePageDown('p1');
    activePageId = 'p2';
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

    expect(await reorderPromise).toBe(true);
    expect(reorderedPages?.length).toBe(3);
    expect(activePageId).toBe('p2');
  });

  it('same-Website active Page switch does not hijack the new selection', async () => {
    const fakeWindow = {
      currentUser: 'u1',
      location: { hash: '#/builder?websiteId=w1&pageId=p1&action=pages' }
    } as any;
    vi.stubGlobal('window', fakeWindow);

    let reorderedInvoked = false;
    let resolveRpc: (val: any) => void;
    const rpcPromise = new Promise(resolve => { resolveRpc = resolve; });
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => rpcPromise as any);

    const controller = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1',
      websiteId: 'w1',
      pages: samplePages,
      onPagesReordered: () => { reorderedInvoked = true; }
    }));
    const pending = controller.movePageDown('p1');

    fakeWindow.location.hash = '#/builder?websiteId=w1&pageId=p3&action=pages';
    resolveRpc!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });

    expect(await pending).toBe(true);
    expect(reorderedInvoked).toBe(true);
    expect(fakeWindow.location.hash).toContain('pageId=p3');
  });

  it('D. Older completion versus newer authority: older completion does not overwrite newer reorder', async () => {
    let reorderedPages: Page[] | undefined;
    let resolveRpc1: (val: any) => void;
    const rpcPromise1 = new Promise(resolve => {
      resolveRpc1 = resolve;
    });

    vi.spyOn(PagesRepo, 'reorderPages')
      .mockImplementationOnce(() => rpcPromise1 as any)
      .mockResolvedValueOnce({
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
      pages: samplePages,
      onPagesReordered: (pages) => {
        reorderedPages = pages;
      }
    }));

    const promise1 = controller.movePageDown('p1');
    (controller as any)._activeRequestId++;
    (controller as any)._status = 'idle';

    const promise2 = controller.movePageUp('p3');
    await promise2;
    expect(reorderedPages?.map(p => p.id)).toEqual(['p1', 'p3', 'p2']);

    resolveRpc1!({
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

    expect(await promise1).toBe(false);
    expect(reorderedPages?.map(p => p.id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('older completion cannot overwrite a newer authoritative Website lifecycle', async () => {
    const fakeWindow = {
      currentUser: 'u1',
      location: { hash: '#/builder?websiteId=w1&pageId=p1&action=pages' }
    } as any;
    vi.stubGlobal('window', fakeWindow);

    let resolveOld: (val: any) => void;
    const oldPromise = new Promise(resolve => { resolveOld = resolve; });
    let callCount = 0;
    vi.spyOn(PagesRepo, 'reorderPages').mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return oldPromise as any;
      return Promise.resolve({ success: true, data: { funnel_id: 'f1', pages: samplePages } }) as any;
    });

    let oldApplied = false;
    const oldController = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1', websiteId: 'w1', pages: samplePages,
      onPagesReordered: () => { oldApplied = true; }
    }));
    const older = oldController.movePageDown('p1');

    fakeWindow.location.hash = '#/builder?websiteId=w2&pageId=p1&action=pages';
    let newApplied = false;
    const newController = new BuilderReorderPagesController(() => ({
      actingUserId: 'u1', websiteId: 'w2', pages: samplePages,
      onPagesReordered: () => { newApplied = true; }
    }));
    expect(await newController.movePageDown('p1')).toBe(true);
    expect(newApplied).toBe(true);

    resolveOld!({ success: true, data: { funnel_id: 'f1', pages: samplePages } });
    expect(await older).toBe(false);
    expect(oldApplied).toBe(false);
    expect(newApplied).toBe(true);
  });

  it('resolveBuilderReorderLiveContext prefers live user and Website authority when available', () => {
    vi.stubGlobal('window', {
      currentUser: 'live-user',
      location: { hash: '#/builder?websiteId=live-site&pageId=p1&action=pages' }
    } as any);

    expect(resolveBuilderReorderLiveContext({ actingUserId: 'stale-user', websiteId: 'stale-site', pages: samplePages }))
      .toMatchObject({ actingUserId: 'live-user', websiteId: 'live-site' });
  });

  it('Live Context Provider: dynamic callback resolves fresh authority without controller reconstruction', async () => {
    let currentUserId = 'u1';
    let currentWebsiteId = 'w1';

    const getLiveContext = () => ({
      actingUserId: currentUserId,
      websiteId: currentWebsiteId,
      pages: samplePages
    });

    const controller = new BuilderReorderPagesController(getLiveContext);

    const reorderSpy = vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValue({
      success: true,
      data: { funnel_id: 'f1', pages: samplePages }
    });

    await controller.movePageDown('p1');
    expect(reorderSpy).toHaveBeenLastCalledWith('f1', ['p2', 'p1', 'p3'], ['p1', 'p2', 'p3'], 'u1', undefined);

    currentUserId = 'u2';
    currentWebsiteId = 'w2';

    await controller.movePageDown('p1');
    expect(reorderSpy).toHaveBeenLastCalledWith('f1', ['p2', 'p1', 'p3'], ['p1', 'p2', 'p3'], 'u2', undefined);
  });
});
