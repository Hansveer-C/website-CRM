import { describe, expect, it, vi } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  BuilderNewPageController,
  type BuilderNewPageContext,
  type BuilderNewPagePersistRequest,
  type BuilderNewPagePersistResult
} from './builder_new_page_controller';

const website: Website = { id: 'w', user_id: 'u', name: 'Site', domain: null, subdomain: 's', homepage_funnel_id: 'f', created_at: '', updated_at: '' };
const funnel: Funnel = { id: 'f', user_id: 'u', name: 'Home', status: 'draft', created_at: '', updated_at: '' };
const route: WebsiteRoute = { id: 'r', website_id: 'w', path: '/driveway', funnel_id: 'f', created_at: '' };
const oldPage: Page = { id: 'old', user_id: 'u', name: 'Old', slug: 'old', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f', step_order: 1 };

function setup(overrides: Partial<BuilderNewPageContext> = {}) {
  let context: BuilderNewPageContext = {
    actingUserId: 'u', website, websiteRoutes: [route], funnels: [funnel], pages: [oldPage], activePageId: 'old', ...overrides
  };
  const persist = vi.fn(async (request: BuilderNewPagePersistRequest): Promise<BuilderNewPagePersistResult> => ({
    success: true as const,
    page: {
      id: request.id, user_id: 'u', name: request.name.trim(), slug: request.slug.toLowerCase(), status: 'draft' as const,
      seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f', step_order: 2
    }
  }));
  const onCreated = vi.fn();
  const controller = new BuilderNewPageController({
    getContext: () => context,
    persist,
    onCreated,
    generateId: () => 'new-id'
  });
  return { controller, persist, onCreated, setContext: (next: BuilderNewPageContext) => { context = next; } };
}

describe('BuilderNewPageController', () => {
  it('opening and canceling create nothing', () => {
    const { controller, persist } = setup();
    controller.open();
    expect(controller.status).toBe('editing');
    expect(controller.cancel()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('generates a slug until the user edits it manually', () => {
    const { controller } = setup();
    controller.open();
    controller.updateName('Driveway Cleaning');
    expect(controller.input.slug).toBe('driveway-cleaning');
    controller.updateSlug('driveway');
    controller.updateName('Changed Name');
    expect(controller.input.slug).toBe('driveway');
  });

  it('invalid input never calls persistence and retains values', async () => {
    const { controller, persist } = setup();
    controller.open();
    controller.updateName('Page');
    controller.updateSlug('not-routed');
    expect(await controller.create()).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(controller.input.slug).toBe('not-routed');
  });

  it('persists once, returns one page, and closes only after success', async () => {
    const { controller, persist, onCreated } = setup();
    controller.open();
    controller.updateName('Driveway');
    expect(await controller.create()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toEqual({ id: 'new-id', name: 'Driveway', slug: 'driveway', destinationKey: 'funnel:f' });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(controller.status).toBe('closed');
  });

  it('coalesces double submission while a request is pending', async () => {
    let resolve!: (value: any) => void;
    const { controller, persist } = setup();
    persist.mockImplementation(() => new Promise(value => { resolve = value; }));
    controller.open();
    controller.updateName('Driveway');
    const first = controller.create();
    const second = controller.create();
    expect(await second).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    resolve({ success: false, code: 'UNAVAILABLE' });
    await first;
  });

  it('reuses the same ID after an ambiguous result and current-input retry', async () => {
    const { controller, persist } = setup();
    persist.mockResolvedValueOnce({ success: false, code: 'AMBIGUOUS' });
    controller.open();
    controller.updateName('Driveway');
    expect(await controller.create()).toBe(false);
    expect(await controller.retry()).toBe(true);
    expect(persist.mock.calls.map(call => call[0].id)).toEqual(['new-id', 'new-id']);
  });

  it('maps slug conflicts without clearing dialog input', async () => {
    const { controller, persist } = setup();
    persist.mockResolvedValue({ success: false, code: 'CONFLICT' });
    controller.open();
    controller.updateName('Driveway');
    await controller.create();
    expect(controller.issues).toContainEqual(expect.objectContaining({ field: 'slug', code: 'duplicate-slug' }));
    expect(controller.input.name).toBe('Driveway');
  });

  it('rejects returned ID, owner, funnel, and status mismatches', async () => {
    for (const mismatch of [
      { id: 'wrong' }, { user_id: 'other' }, { funnel_id: 'other' }, { status: 'published' as const }
    ]) {
      const { controller, persist, onCreated } = setup();
      persist.mockImplementation(async request => ({
        success: true,
        page: {
          id: request.id, user_id: 'u', name: request.name, slug: request.slug, status: 'draft' as const,
          seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f', ...mismatch
        }
      }));
      controller.open();
      controller.updateName('Driveway');
      expect(await controller.create()).toBe(false);
      expect(onCreated).not.toHaveBeenCalled();
    }
  });

  it('invalidates a result when acting user or website changes during creation', async () => {
    let resolve!: (value: any) => void;
    const { controller, persist, onCreated, setContext } = setup();
    persist.mockImplementation(() => new Promise(value => { resolve = result => value(result); }));
    controller.open();
    controller.updateName('Driveway');
    const pending = controller.create();
    setContext({ actingUserId: 'other', website: { ...website, user_id: 'other' }, websiteRoutes: [], funnels: [], pages: [] });
    resolve({ success: true, page: { id: 'new-id', user_id: 'u', name: 'Driveway', slug: 'driveway', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f' } });
    expect(await pending).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('does not mutate supplied context records', () => {
    const context = { actingUserId: 'u', website, websiteRoutes: [route], funnels: [funnel], pages: [oldPage], activePageId: 'old' };
    const snapshot = structuredClone(context);
    const { controller } = setup(context);
    controller.open();
    controller.validate();
    expect(context).toEqual(snapshot);
  });
});
