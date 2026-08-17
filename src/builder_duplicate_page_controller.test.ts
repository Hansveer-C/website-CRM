import { describe, expect, it, vi } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  BuilderDuplicatePageController,
  type BuilderDuplicatePageContext,
  type BuilderDuplicatePagePersistRequest,
  type BuilderDuplicatePagePersistResult
} from './builder_duplicate_page_controller';

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

const sourcePage: Page = {
  id: 'page-driveway',
  user_id: 'owner-1',
  name: 'Driveway Cleaning',
  slug: 'driveway',
  status: 'published',
  seo_title: 'Driveway Cleaning',
  seo_description: 'Best driveway cleaning',
  seo_keywords: ['driveway'],
  created_at: '',
  funnel_id: 'funnel-1',
  step_order: 1
};

function setup(overrides: Partial<BuilderDuplicatePageContext> = {}) {
  let context: BuilderDuplicatePageContext = {
    actingUserId: 'owner-1',
    website,
    websiteRoutes: [route],
    funnels: [funnel],
    pages: [sourcePage],
    activePageId: 'page-driveway',
    ...overrides
  };

  const persist = vi.fn(async (request: BuilderDuplicatePagePersistRequest): Promise<BuilderDuplicatePagePersistResult> => ({
    success: true,
    data: {
      page: {
        id: request.newPageId,
        user_id: 'owner-1',
        name: 'Driveway Cleaning (Copy)',
        slug: 'driveway-copy',
        status: 'draft',
        seo_title: 'Driveway Cleaning',
        seo_description: 'Best driveway cleaning',
        seo_keywords: ['driveway'],
        created_at: '',
        funnel_id: 'funnel-1',
        step_order: 2
      },
      sections: [
        {
          id: 'new-sec-1',
          page_id: request.newPageId,
          funnel_id: 'funnel-1',
          type: 'hero',
          content: { heading: 'Hello' },
          styles: {},
          order: 0
        }
      ]
    }
  }));

  const onDuplicated = vi.fn();
  const controller = new BuilderDuplicatePageController({
    getContext: () => context,
    persist,
    onDuplicated,
    generateId: () => 'generated-new-page-id'
  });

  return {
    controller,
    persist,
    onDuplicated,
    setContext: (next: BuilderDuplicatePageContext) => { context = next; }
  };
}

describe('BuilderDuplicatePageController', () => {
  it('starts in idle status', () => {
    const { controller } = setup();
    expect(controller.status).toBe('idle');
    expect(controller.isDuplicating).toBe(false);
    expect(controller.duplicatingPageId).toBeNull();
  });

  it('successfully duplicates a page and triggers onDuplicated callback', async () => {
    const { controller, persist, onDuplicated } = setup();

    const promise = controller.duplicate('page-driveway');
    expect(controller.status).toBe('duplicating');
    expect(controller.duplicatingPageId).toBe('page-driveway');

    const result = await promise;
    expect(result).toBe(true);
    expect(persist).toHaveBeenCalledWith({
      sourcePageId: 'page-driveway',
      newPageId: 'generated-new-page-id'
    });
    expect(onDuplicated).toHaveBeenCalledTimes(1);
    expect(onDuplicated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-new-page-id',
        name: 'Driveway Cleaning (Copy)',
        status: 'draft'
      }),
      expect.arrayContaining([
        expect.objectContaining({ id: 'new-sec-1' })
      ])
    );
    expect(controller.status).toBe('idle');
  });

  it('prevents rapid double-clicks while duplication is in flight', async () => {
    let resolvePersist!: (value: any) => void;
    const { controller, persist } = setup();
    persist.mockImplementation(() => new Promise(resolve => { resolvePersist = resolve; }));

    const first = controller.duplicate('page-driveway');
    const second = controller.duplicate('page-driveway');

    expect(await second).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);

    resolvePersist({
      success: true,
      data: {
        page: {
          id: 'generated-new-page-id',
          user_id: 'owner-1',
          name: 'Driveway Cleaning (Copy)',
          slug: 'driveway-copy',
          status: 'draft',
          seo_title: '',
          seo_description: '',
          seo_keywords: [],
          created_at: '',
          funnel_id: 'funnel-1'
        },
        sections: []
      }
    });
    await first;
  });

  it('handles source page not found in context', async () => {
    const { controller, persist, onDuplicated } = setup();
    const result = await controller.duplicate('non-existent-page');

    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('The source page could not be found.');
    expect(persist).not.toHaveBeenCalled();
    expect(onDuplicated).not.toHaveBeenCalled();
  });

  it('handles persistence conflict errors with user-friendly error message', async () => {
    const { controller, persist, onDuplicated } = setup();
    persist.mockResolvedValueOnce({ success: false, code: 'CONFLICT' });

    const result = await controller.duplicate('page-driveway');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.message).toBe('A page with that name or URL already exists.');
    expect(onDuplicated).not.toHaveBeenCalled();
  });

  it('suppresses result if user or website context changes while request is in flight', async () => {
    let resolvePersist!: (value: any) => void;
    const { controller, persist, onDuplicated, setContext } = setup();
    persist.mockImplementation(() => new Promise(resolve => { resolvePersist = resolve; }));

    const pending = controller.duplicate('page-driveway');

    // Context changes (e.g. user switched site or logged out)
    setContext({
      actingUserId: 'different-user',
      website: { ...website, user_id: 'different-user' },
      websiteRoutes: [],
      funnels: [],
      pages: []
    });

    resolvePersist({
      success: true,
      data: {
        page: {
          id: 'generated-new-page-id',
          user_id: 'owner-1',
          name: 'Driveway Cleaning (Copy)',
          slug: 'driveway-copy',
          status: 'draft',
          seo_title: '',
          seo_description: '',
          seo_keywords: [],
          created_at: '',
          funnel_id: 'funnel-1'
        },
        sections: []
      }
    });

    expect(await pending).toBe(false);
    expect(onDuplicated).not.toHaveBeenCalled();
  });

  it('resets status cleanly', () => {
    const { controller } = setup();
    controller.status = 'error';
    controller.message = 'An error occurred';
    controller.reset();

    expect(controller.status).toBe('idle');
    expect(controller.message).toBe('');
  });
});
