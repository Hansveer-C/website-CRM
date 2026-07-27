import type { BuilderDocument } from './builder_document';
import type { BuilderPageSettingsPatch } from './builder_page_settings';
import type { BuilderSetupBriefV1 } from './builder_setup_brief';
import type { BuilderGeneratedSetupPlan } from './builder_template_generator';

export type BuilderSetupPersistenceStage = 'page-settings' | 'page-sections' | 'build-brief';

export interface BuilderSetupApplicationContext {
  pageId: string;
  websiteId: string;
  actingUserId: string;
  currentDocument: BuilderDocument;
  previousPageSettings: BuilderPageSettingsPatch;
  previousBuildBrief?: unknown;
}

export interface BuilderSetupPersistenceDependencies {
  persistPageSettings(pageId: string, patch: BuilderPageSettingsPatch): Promise<boolean>;
  applyDocument(document: BuilderDocument): boolean;
  persistDocument(): Promise<boolean>;
  restoreDocument(document: BuilderDocument): boolean;
  persistBuildBrief(websiteId: string, brief: BuilderSetupBriefV1 | null): Promise<boolean>;
}

export interface BuilderSetupApplicationResult {
  success: boolean;
  partial: boolean;
  savedStages: BuilderSetupPersistenceStage[];
  compensatedStages: BuilderSetupPersistenceStage[];
  failedStage?: BuilderSetupPersistenceStage;
  message: string;
}

async function compensate(
  saved: readonly BuilderSetupPersistenceStage[],
  context: BuilderSetupApplicationContext,
  dependencies: BuilderSetupPersistenceDependencies
): Promise<BuilderSetupPersistenceStage[]> {
  const compensated: BuilderSetupPersistenceStage[] = [];
  if (saved.includes('page-sections')) {
    const restored = dependencies.restoreDocument(structuredClone(context.currentDocument));
    if (restored && await dependencies.persistDocument()) compensated.push('page-sections');
  }
  if (saved.includes('page-settings')) {
    if (await dependencies.persistPageSettings(context.pageId, structuredClone(context.previousPageSettings))) compensated.push('page-settings');
  }
  if (saved.includes('build-brief')) {
    const previous = context.previousBuildBrief && typeof context.previousBuildBrief === 'object'
      ? structuredClone(context.previousBuildBrief) as BuilderSetupBriefV1
      : null;
    if (await dependencies.persistBuildBrief(context.websiteId, previous)) compensated.push('build-brief');
  }
  return compensated;
}

export async function applyBuilderSetupPlanPersistence(
  plan: BuilderGeneratedSetupPlan,
  context: BuilderSetupApplicationContext,
  dependencies: BuilderSetupPersistenceDependencies
): Promise<BuilderSetupApplicationResult> {
  const saved: BuilderSetupPersistenceStage[] = [];
  const fail = async (stage: BuilderSetupPersistenceStage): Promise<BuilderSetupApplicationResult> => {
    const compensated = await compensate(saved, context, dependencies);
    return {
      success: false,
      partial: compensated.length !== saved.length,
      savedStages: [...saved],
      compensatedStages: compensated,
      failedStage: stage,
      message: compensated.length === saved.length
        ? 'Some setup changes could not be saved. Earlier changes were restored.'
        : 'Some setup changes could not be saved. Review the saved categories before retrying.'
    };
  };

  if (plan.pageSettingsPatch && Object.keys(plan.pageSettingsPatch).length) {
    if (!await dependencies.persistPageSettings(context.pageId, structuredClone(plan.pageSettingsPatch))) return fail('page-settings');
    saved.push('page-settings');
  }

  if (!dependencies.applyDocument(structuredClone(plan.generatedDocument))) return fail('page-sections');
  if (!await dependencies.persistDocument()) {
    const restored = dependencies.restoreDocument(structuredClone(context.currentDocument));
    const documentCompensated = restored && await dependencies.persistDocument();
    const compensated = await compensate(saved, context, dependencies);
    return {
      success: false,
      partial: !documentCompensated || compensated.length !== saved.length,
      savedStages: [...saved],
      compensatedStages: documentCompensated ? ['page-sections', ...compensated] : compensated,
      failedStage: 'page-sections',
      message: documentCompensated && compensated.length === saved.length
        ? 'The generated page could not be saved. Earlier changes were restored.'
        : 'The generated page could not be saved completely. Review the page before retrying.'
    };
  }
  saved.push('page-sections');

  if (!await dependencies.persistBuildBrief(context.websiteId, structuredClone(plan.sanitizedBuildBrief))) return fail('build-brief');
  saved.push('build-brief');

  return {
    success: true,
    partial: false,
    savedStages: saved,
    compensatedStages: [],
    message: 'Setup applied'
  };
}
