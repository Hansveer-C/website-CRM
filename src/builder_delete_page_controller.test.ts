import { describe, expect, it, vi } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  BuilderDeletePageController,
  type BuilderDeletePageContext,
  type BuilderDeletePagePersistRequest,
  type BuilderDeletePagePersistResult
} from './builder_delete_page_controller';

const website: Website = {
  id: 'site-1',
  user_id: 'owner-1',
  name: 'Pressure Pros',
  domain: null,
  subdomain: 'pressurepros',
  homepage_funnel_id: 'funnel-1',
  created_at: '',
  updated_at: ''
};

const funnel: Funnel = {
  id: 'funnel-1',
  user_id: 'owner-1',
  name: 'Main Funnel',
  status: 'draft',
  created_at: '',
  updated_at: ''
};

const route: WebsiteRoute = {
  id: 'route-1',
  website_id: 'site-1',
  path: '/driveway',
  funnel_id: 'funnel-1',
  created_at: ''
};

const pageA: Page = {
  id: 'page-driveway',
  user_id: 'owner-1',
  name: 'Driveway Cleaning',
  slug: 'driveway',
  status: 'draft',
  seo_title: 'Driveway',
  seo_description: '',
  seo_keywords: [],
  created_at: '',
  funnel_id: 'funnel-1',
  step_order: 0
};

const pageB: Page = {
  id: 'page-about',
  user_id: 'owner-1',
  name: 'About Us',
  slug: 'about',
  status: 'draft',
  seo_title: 'About',
  seo_description: '',
  seo_keywords: [],
  created_at: '',
  funnel_id: 'funnel-1',
  step_order: 1
};

function setup(overrides: Partial<BuilderDeletePageContext> = {}) {
  let context: BuilderDeletePageContext = {
    actingUserId: 'owner-1',
    website,
    websiteRoutes: [route],
    funnels: [funnel],
    pages: [pageA, pageB],
    activePageId: 'page-driveway',
    ...overrides
  };

  const persist = vi.fn(async (request: BuilderDeletePagePersistRequest): Promise<BuilderDeletePagePersistResult> => ({
    success: true,
    data: {
      id: request.pageId,
      funnel_id: 'funnel-1'
    }
  }));

  const onDeleted = vi.fn();
  const controller = new BuilderDeletePageController({
    getContext: () => context,
    persist,
    onDeleted
  });

  return {
    controller,
    persist,
    onDeleted,
    setContext: (next: BuilderDeletePageContext) => { context = next; }
  };
}

describe('BuilderDeletePageController', () => {
  it('starts in idle status', () => {
    const { controller } = setup();
    expect(controller.status).toBe('idle');
    expect(controller.isDeleting).toBe(false);
    expect(controller.isConfirming).toBe(false);
    expect(controller.deletingPageId).toBeNull();
    expect(controller.confirmingPageId).toBeNull();
  });

  it('prompts confirmation naming the page to delete', () => {
    const { controller } = setup();
    const result = controller.promptDelete('page-about');
    expect(result).toBe(true);
    expect(controller.status).toBe('confirming');
    expect(controller.confirmingPageId).toBe('page-about');
    expect(controller.message).toBe('Are you sure you want to delete "About Us"?');
  });

  it('blocks deletion prompt if it is the only page in the funnel/website', () => {
    const { controller } = setup({ pages: [pageA] });
    const result = controller.promptDelete('page-driveway');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('Cannot delete the only page in this destination.');
  });

  it('cancels deletion prompt cleanly', () => {
    const { controller } = setup();
    controller.promptDelete('page-about');
    controller.cancelDelete();
    expect(controller.status).toBe('idle');
    expect(controller.confirmingPageId).toBeNull();
    expect(controller.message).toBe('');
  });

  it('executes deletion upon confirmation and triggers onDeleted with replacement page if active', async () => {
    const { controller, persist, onDeleted } = setup();
    controller.promptDelete('page-driveway');

    const promise = controller.confirmDelete();
    expect(controller.status).toBe('deleting');
    expect(controller.deletingPageId).toBe('page-driveway');

    const result = await promise;
    expect(result).toBe(true);
    expect(persist).toHaveBeenCalledWith({ pageId: 'page-driveway' });
    expect(onDeleted).toHaveBeenCalledWith('page-driveway', {
      shouldNavigate: true,
      replacementPageId: 'page-about'
    });
    expect(controller.status).toBe('idle');
  });

  it('guards against stale navigation if user switched activePageId to B while deleting A', async () => {
    let resolvePersist!: (value: any) => void;
    const { controller, persist, onDeleted, setContext } = setup();
    persist.mockImplementation(() => new Promise(resolve => { resolvePersist = resolve; }));

    controller.promptDelete('page-driveway');
    const pending = controller.confirmDelete();

    setContext({
      actingUserId: 'owner-1',
      website,
      websiteRoutes: [route],
      funnels: [funnel],
      pages: [pageA, pageB],
      activePageId: 'page-about'
    });

    resolvePersist({ success: true, data: { id: 'page-driveway' } });

    expect(await pending).toBe(true);
    expect(onDeleted).toHaveBeenCalledWith('page-driveway', {
      shouldNavigate: false,
      replacementPageId: undefined
    });
  });

  it('suppresses completion callback if user logged out or switched site in flight', async () => {
    let resolvePersist!: (value: any) => void;
    const { controller, persist, onDeleted, setContext } = setup();
    persist.mockImplementation(() => new Promise(resolve => { resolvePersist = resolve; }));

    controller.promptDelete('page-about');
    const pending = controller.confirmDelete();

    setContext({
      actingUserId: 'different-user',
      website: undefined,
      websiteRoutes: [],
      funnels: [],
      pages: []
    });

    resolvePersist({ success: true, data: { id: 'page-about' } });

    expect(await pending).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('blocks prompt when page status is published', () => {
    const publishedPage: Page = { ...pageA, id: 'page-pub', status: 'published' };
    const { controller } = setup({ pages: [pageA, publishedPage] });
    const result = controller.promptDelete('page-pub');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('This page is published. Unpublish it before deleting it.');
  });

  it('handles PUBLISHED_BLOCKED and LEAD_HISTORY_BLOCKED persistence error codes', async () => {
    const draft1: Page = { ...pageA, id: 'page-d1', status: 'draft' };
    const draft2: Page = { ...pageB, id: 'page-d2', status: 'draft' };
    const { controller, persist } = setup({ pages: [draft1, draft2] });

    persist.mockResolvedValueOnce({ success: false, code: 'PUBLISHED_BLOCKED' });
    controller.promptDelete('page-d1');
    await controller.confirmDelete();
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('This page is published. Unpublish it before deleting it.');

    persist.mockResolvedValueOnce({ success: false, code: 'LEAD_HISTORY_BLOCKED' });
    controller.promptDelete('page-d2');
    await controller.confirmDelete();
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('This page has historical lead submissions and cannot be deleted.');
  });
});
