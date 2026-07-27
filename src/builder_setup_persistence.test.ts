import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocument } from './builder_document';
import { applyBuilderSetupPlanPersistence, type BuilderSetupPersistenceDependencies } from './builder_setup_persistence';
import { generateBuilderSetupPlan } from './builder_template_generator';
import { validBuilderSetupBrief } from './builder_setup_test_helpers';

function fixture() {
  const current = createBuilderDocument({ id: 'page-1', user_id: 'user-1', name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01T00:00:00Z' }, []);
  let id = 0;
  const plan = generateBuilderSetupPlan({ brief: validBuilderSetupBrief(), currentDocument: current, targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', applySeoMetadata: true, createId: () => `id-${++id}` });
  const dependencies: BuilderSetupPersistenceDependencies = {
    persistPageSettings: vi.fn(async () => true),
    applyDocument: vi.fn(() => true),
    persistDocument: vi.fn(async () => true),
    restoreDocument: vi.fn(() => true),
    persistBuildBrief: vi.fn(async () => true)
  };
  const context = { pageId: 'page-1', websiteId: 'site-1', actingUserId: 'user-1', currentDocument: current, previousPageSettings: { seo_title: '', seo_description: '' } };
  return { current, plan, dependencies, context };
}

describe('Builder setup persistence', () => {
  it('persists allowlisted page settings, one document, then the sanitized brief', async () => {
    const { plan, dependencies, context } = fixture();
    const result = await applyBuilderSetupPlanPersistence(plan, context, dependencies);
    expect(result.success).toBe(true);
    expect(result.savedStages).toEqual(['page-settings', 'page-sections', 'build-brief']);
    expect(dependencies.applyDocument).toHaveBeenCalledTimes(1);
    expect(dependencies.persistDocument).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the plan or context', async () => {
    const { plan, dependencies, context } = fixture();
    const before = structuredClone({ plan, context });
    await applyBuilderSetupPlanPersistence(plan, context, dependencies);
    expect({ plan, context }).toEqual(before);
  });

  it('stops before document mutation when page settings fail', async () => {
    const { plan, dependencies, context } = fixture();
    vi.mocked(dependencies.persistPageSettings).mockResolvedValue(false);
    const result = await applyBuilderSetupPlanPersistence(plan, context, dependencies);
    expect(result.failedStage).toBe('page-settings');
    expect(dependencies.applyDocument).not.toHaveBeenCalled();
  });

  it('restores prior page metadata when document save fails', async () => {
    const { plan, dependencies, context } = fixture();
    vi.mocked(dependencies.persistDocument).mockResolvedValueOnce(false);
    const result = await applyBuilderSetupPlanPersistence(plan, context, dependencies);
    expect(result.failedStage).toBe('page-sections');
    expect(dependencies.restoreDocument).toHaveBeenCalledWith(context.currentDocument);
    expect(dependencies.persistDocument).toHaveBeenCalledTimes(2);
    expect(result.compensatedStages).toContain('page-sections');
    expect(result.compensatedStages).toContain('page-settings');
  });

  it('reports partial failure if compensation cannot restore a committed document', async () => {
    const { plan, dependencies, context } = fixture();
    vi.mocked(dependencies.persistBuildBrief).mockResolvedValue(false);
    vi.mocked(dependencies.restoreDocument).mockReturnValue(false);
    const result = await applyBuilderSetupPlanPersistence(plan, context, dependencies);
    expect(result.partial).toBe(true);
    expect(result.savedStages).toEqual(['page-settings', 'page-sections']);
  });
});
