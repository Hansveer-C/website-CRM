import { describe, expect, it, vi } from 'vitest';
import { BuilderSetHomepageController } from './builder_set_homepage_controller';
import * as homepageRepo from './builder_homepage_repository';
import type { Website } from './types';

describe('BuilderSetHomepageController', () => {
  const website: Website = {
    id: 'ws-1',
    user_id: 'user-1',
    name: 'My Website',
    domain: 'mywebsite.com',
    subdomain: 'mywebsite',
    homepage_funnel_id: 'fnl-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  it('successfully updates homepage when inputs are valid', async () => {
    const updatedWebsite: Website = {
      ...website,
      homepage_funnel_id: 'fnl-2',
      updated_at: '2026-01-01T01:00:00Z'
    };

    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockResolvedValueOnce({
      success: true,
      code: 'SUCCESS',
      data: { website: updatedWebsite }
    });

    const onHomepageSet = vi.fn();
    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: [],
      onHomepageSet
    }));

    const result = await controller.setHomepage('fnl-2');
    expect(result).toBe(true);
    expect(controller.status).toBe('success');
    expect(controller.error).toBeUndefined();
    expect(onHomepageSet).toHaveBeenCalledWith(updatedWebsite);
    expect(spy).toHaveBeenCalledWith('ws-1', 'fnl-2', null, 'user-1', undefined);

    spy.mockRestore();
  });

  it('treats setting the current effective homepage as an immediate no-op success', async () => {
    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage');
    const onHomepageSet = vi.fn();
    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: [],
      onHomepageSet
    }));

    const result = await controller.setHomepage('fnl-1');
    expect(result).toBe(true);
    expect(controller.status).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
    expect(onHomepageSet).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('handles CONFLICT error when expected draft homepage does not match server state', async () => {
    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockResolvedValueOnce({
      success: false,
      code: 'CONFLICT',
      error: 'The draft homepage changed elsewhere. Reload and try again.'
    });

    const onConflict = vi.fn();
    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: [],
      onConflict
    }));

    const result = await controller.setHomepage('fnl-2');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('The draft homepage changed elsewhere. Reload and try again.');
    expect(onConflict).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('rejects update when user is unauthenticated or website is missing', async () => {
    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: '',
      website: null,
      funnels: []
    }));

    const result = await controller.setHomepage('fnl-2');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('Website not found');
  });

  it('rejects invalid funnel input', async () => {
    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: []
    }));

    const result = await controller.setHomepage('');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('Invalid destination');
  });

  it('handles AMBIGUOUS / network errors safely', async () => {
    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockResolvedValueOnce({
      success: false,
      code: 'AMBIGUOUS',
      error: 'The homepage update result is uncertain. Please reload to check.'
    });

    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: []
    }));

    const result = await controller.setHomepage('fnl-2');
    expect(result).toBe(false);
    expect(controller.status).toBe('error');
    expect(controller.error).toBe('The homepage update result is uncertain. Please reload to check.');

    spy.mockRestore();
  });

  it('prevents overlapping requests while an update is in flight', async () => {
    let resolveFirst: (value: any) => void;
    const firstPromise = new Promise(resolve => {
      resolveFirst = resolve;
    });

    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockImplementationOnce(() => firstPromise as any);

    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website,
      funnels: []
    }));

    const firstCall = controller.setHomepage('fnl-2');
    expect(controller.isUpdating).toBe(true);

    const secondCall = await controller.setHomepage('fnl-3');
    expect(secondCall).toBe(false);

    resolveFirst!({ success: true, code: 'SUCCESS', data: { website } });
    await firstCall;
    expect(controller.isUpdating).toBe(false);

    spy.mockRestore();
  });

  it('discards stale async completions if active website changes before resolution', async () => {
    let currentWebsite: Website | null = website;
    let resolvePending: (value: any) => void;
    const pendingPromise = new Promise(resolve => {
      resolvePending = resolve;
    });

    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockImplementationOnce(() => pendingPromise as any);
    const onHomepageSet = vi.fn();

    const controller = new BuilderSetHomepageController(() => ({
      actingUserId: 'user-1',
      website: currentWebsite,
      funnels: [],
      onHomepageSet
    }));

    const callPromise = controller.setHomepage('fnl-2');

    // Simulate user switching to another website mid-flight
    currentWebsite = { ...website, id: 'ws-2' };

    resolvePending!({
      success: true,
      code: 'SUCCESS',
      data: { website: { ...website, homepage_funnel_id: 'fnl-2' } }
    });

    const result = await callPromise;
    expect(result).toBe(false);
    expect(onHomepageSet).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
