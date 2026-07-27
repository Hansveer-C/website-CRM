import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocument } from './builder_document';
import { BuilderSetupController } from './builder_setup_controller';
import { validBuilderSetupBrief } from './builder_setup_test_helpers';

function fixture() {
  const document = createBuilderDocument({ id: 'page-1', user_id: 'user-1', name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01T00:00:00Z' }, []);
  const context = { websiteId: 'site-1', pageId: 'page-1', actingUserId: 'user-1', document, availableAssetIds: [] as string[], previousPageSettings: { seo_title: '', seo_description: '' } };
  let id = 0;
  const controller = new BuilderSetupController({
    getContext: () => context,
    createId: () => `id-${++id}`,
    persistence: {
      persistPageSettings: vi.fn(async () => true),
      applyDocument: vi.fn(() => true),
      persistDocument: vi.fn(async () => true),
      restoreDocument: vi.fn(() => true),
      persistBuildBrief: vi.fn(async () => true)
    }
  });
  return { controller, context };
}

describe('Builder setup controller', () => {
  it('generates review without mutating the current document or persisting', () => {
    const { controller, context } = fixture();
    const before = structuredClone(context.document);
    const plan = controller.generate(validBuilderSetupBrief(), 'replace', true);
    expect(plan).not.toBeNull();
    expect(controller.status).toBe('reviewing');
    expect(context.document).toEqual(before);
  });

  it('retains validation issues and does not generate an invalid brief', () => {
    const { controller } = fixture();
    expect(controller.generate({ ...validBuilderSetupBrief(), businessName: '' }, 'replace', false)).toBeNull();
    expect(controller.issues.length).toBeGreaterThan(0);
    expect(controller.status).toBe('editing');
  });

  it('applies one plan and deduplicates concurrent apply calls', async () => {
    const { controller } = fixture();
    controller.generate(validBuilderSetupBrief(), 'replace', false);
    const first = controller.apply();
    const second = controller.apply();
    expect(first).toBe(second);
    expect((await first).success).toBe(true);
    expect(controller.status).toBe('applied');
  });

  it('rejects stale plans after the source document changes', async () => {
    const { controller, context } = fixture();
    controller.generate(validBuilderSetupBrief(), 'replace', false);
    context.document = { ...context.document, page: { ...context.document.page, name: 'Changed elsewhere' } };
    const result = await controller.apply();
    expect(result.success).toBe(false);
    expect(controller.message).toContain('page changed');
  });

  it('invalidates unfinished state deliberately', () => {
    const { controller } = fixture();
    controller.generate(validBuilderSetupBrief(), 'replace', false);
    controller.invalidate();
    expect(controller.plan).toBeNull();
    expect(controller.status).toBe('editing');
  });
});
