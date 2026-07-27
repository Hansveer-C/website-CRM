import { describe, expect, it, vi } from 'vitest';
import type { Page } from './types';
import { BuilderPageSettingsController } from './builder_page_settings_controller';

function makePage(id = 'page-1'): Page {
  return { id, user_id: 'owner-1', name: 'Home', slug: 'home', status: 'draft', seo_title: 'SEO', seo_description: 'Description', seo_keywords: [], created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-1' };
}

describe('BuilderPageSettingsController', () => {
  it('does not save on initial load or for an explicit no-op', async () => {
    const persist = vi.fn();
    const controller = new BuilderPageSettingsController({ page: makePage(), persist });
    expect(persist).not.toHaveBeenCalled();
    expect(await controller.save()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('keeps text changes local until one explicit save', async () => {
    const persist = vi.fn(async (_id, patch) => ({ success: true as const, page: { ...makePage(), ...patch } }));
    const optimistic = vi.fn();
    const controller = new BuilderPageSettingsController({ page: makePage(), persist, onOptimisticPage: optimistic });
    controller.updateField('name', 'Services');
    controller.updateField('name', 'Services');
    expect(persist).not.toHaveBeenCalled();
    expect(controller.status).toBe('unsaved');
    expect(await controller.save()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('page-1', { name: 'Services' });
    expect(optimistic.mock.calls[0][0]).toMatchObject({ id: 'page-1', user_id: 'owner-1', name: 'Services' });
  });

  it('does not save invalid input and preserves its draft', async () => {
    const persist = vi.fn();
    const controller = new BuilderPageSettingsController({ page: makePage(), persist });
    controller.updateField('name', '   ');
    expect(await controller.save()).toBe(false);
    expect(controller.draft.name).toBe('   ');
    expect(controller.issues[0]?.field).toBe('name');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rolls back optimistic state on failure, preserves draft, and retries current values', async () => {
    const persist = vi.fn()
      .mockResolvedValueOnce({ success: false, code: 'UNAVAILABLE' })
      .mockImplementationOnce(async (_id, patch) => ({ success: true, page: { ...makePage(), ...patch } }));
    const settled = vi.fn();
    const controller = new BuilderPageSettingsController({ page: makePage(), persist, onSettledPage: settled });
    controller.updateField('seo_title', 'New SEO');
    expect(await controller.save()).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.draft.seo_title).toBe('New SEO');
    expect(settled.mock.calls[0][0].seo_title).toBe('SEO');
    expect(await controller.retry()).toBe(true);
    expect(persist).toHaveBeenLastCalledWith('page-1', { seo_title: 'New SEO' });
  });

  it('maps a conflict to a safe slug issue', async () => {
    const controller = new BuilderPageSettingsController({ page: makePage(), persist: async () => ({ success: false, code: 'CONFLICT' }) });
    controller.updateField('slug', 'services');
    await controller.save();
    expect(controller.status).toBe('error');
    expect(controller.issues).toContainEqual({ field: 'slug', code: 'duplicate-slug', message: 'Another page already uses this URL.' });
  });

  it('ignores a stale completion after cancellation', async () => {
    let resolve!: (value: { success: true; page: Page }) => void;
    const persisted = new Promise<{ success: true; page: Page }>(done => { resolve = done; });
    const settled = vi.fn();
    const controller = new BuilderPageSettingsController({ page: makePage(), persist: () => persisted, onSettledPage: settled });
    controller.updateField('name', 'Page A edit');
    const save = controller.save();
    controller.cancelPending();
    resolve({ success: true, page: { ...makePage(), name: 'Page A edit' } });
    expect(await save).toBe(false);
    expect(settled).not.toHaveBeenCalled();
  });

  it('preserves edits made while a save is in flight', async () => {
    let resolve!: (value: { success: true; page: Page }) => void;
    const controller = new BuilderPageSettingsController({
      page: makePage(),
      persist: () => new Promise(done => { resolve = done; })
    });
    controller.updateField('name', 'First');
    const save = controller.save();
    controller.updateField('name', 'Second');
    resolve({ success: true, page: { ...makePage(), name: 'First' } });
    expect(await save).toBe(true);
    expect(controller.draft.name).toBe('Second');
    expect(controller.status).toBe('unsaved');
  });

  it('never sends protected Page fields', async () => {
    const persist = vi.fn(async (_id, patch) => ({ success: true as const, page: { ...makePage(), ...patch } }));
    const controller = new BuilderPageSettingsController({ page: makePage(), persist });
    controller.updateField('seo_description', 'Updated');
    await controller.save();
    expect(persist.mock.calls[0][1]).toEqual({ seo_description: 'Updated' });
    expect(persist.mock.calls[0][1]).not.toHaveProperty('id');
    expect(persist.mock.calls[0][1]).not.toHaveProperty('user_id');
    expect(persist.mock.calls[0][1]).not.toHaveProperty('funnel_id');
  });
});
