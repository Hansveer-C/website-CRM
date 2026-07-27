import type { BuilderDocument } from './builder_document';
import type { BuilderPageSettingsPatch } from './builder_page_settings';
import { validateBuilderSetupBrief, type BuilderSetupBriefV1, type BuilderSetupBriefValidationIssue } from './builder_setup_brief';
import { applyBuilderSetupPlanPersistence, type BuilderSetupApplicationResult, type BuilderSetupPersistenceDependencies } from './builder_setup_persistence';
import { generateBuilderSetupPlan, isBuilderSetupPlanCurrent, type BuilderGeneratedSetupPlan, type BuilderSetupApplyMode } from './builder_template_generator';

export type BuilderSetupStatus = 'editing' | 'validating' | 'generating' | 'reviewing' | 'applying' | 'applied' | 'partial-failure' | 'failed';

export interface BuilderSetupControllerContext {
  websiteId: string;
  pageId: string;
  actingUserId: string;
  document: BuilderDocument;
  availableAssetIds: readonly string[];
  previousPageSettings: BuilderPageSettingsPatch;
  previousBuildBrief?: unknown;
}

export interface BuilderSetupControllerOptions {
  getContext(): BuilderSetupControllerContext;
  persistence: BuilderSetupPersistenceDependencies;
  createId?: () => string;
}

export class BuilderSetupController {
  status: BuilderSetupStatus = 'editing';
  issues: BuilderSetupBriefValidationIssue[] = [];
  plan: BuilderGeneratedSetupPlan | null = null;
  result: BuilderSetupApplicationResult | null = null;
  message = '';
  private applying: Promise<BuilderSetupApplicationResult> | null = null;
  private readonly getContext: BuilderSetupControllerOptions['getContext'];
  private readonly persistence: BuilderSetupPersistenceDependencies;
  private readonly createId: () => string;

  constructor(options: BuilderSetupControllerOptions) {
    this.getContext = options.getContext;
    this.persistence = options.persistence;
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  generate(brief: BuilderSetupBriefV1, mode: BuilderSetupApplyMode, applySeoMetadata: boolean): BuilderGeneratedSetupPlan | null {
    if (this.status === 'applying') return null;
    const context = this.getContext();
    this.status = 'validating';
    this.issues = validateBuilderSetupBrief(brief, { activeWebsiteId: context.websiteId, activePageId: context.pageId });
    if (this.issues.some(issue => issue.severity === 'error')) {
      this.status = 'editing';
      this.message = 'Review the highlighted setup details.';
      return null;
    }
    this.status = 'generating';
    try {
      this.plan = generateBuilderSetupPlan({
        brief,
        currentDocument: context.document,
        targetWebsiteId: context.websiteId,
        actingUserId: context.actingUserId,
        mode,
        applySeoMetadata,
        planId: this.plan?.planId ?? this.createId(),
        createId: this.createId
      });
      this.status = 'reviewing';
      this.message = '';
      return structuredClone(this.plan);
    } catch {
      this.status = 'failed';
      this.message = 'Guided setup is temporarily unavailable. Your existing page was not published.';
      return null;
    }
  }

  invalidate(): void {
    if (this.status === 'applying') return;
    this.plan = null;
    this.result = null;
    this.status = 'editing';
  }

  apply(): Promise<BuilderSetupApplicationResult> {
    if (this.applying) return this.applying;
    const plan = this.plan;
    const context = this.getContext();
    if (!plan || !isBuilderSetupPlanCurrent(plan, context)) {
      this.status = 'editing';
      this.message = 'The page changed while setup was open. Review the updated page before applying.';
      return Promise.resolve({ success: false, partial: false, savedStages: [], compensatedStages: [], message: this.message });
    }
    this.status = 'applying';
    this.message = 'Saving page setup…';
    this.applying = applyBuilderSetupPlanPersistence(plan, {
      pageId: context.pageId,
      websiteId: context.websiteId,
      actingUserId: context.actingUserId,
      currentDocument: structuredClone(context.document),
      previousPageSettings: structuredClone(context.previousPageSettings),
      previousBuildBrief: structuredClone(context.previousBuildBrief)
    }, this.persistence).then(result => {
      this.result = result;
      this.status = result.success ? 'applied' : result.partial ? 'partial-failure' : 'failed';
      this.message = result.message;
      return result;
    }).finally(() => { this.applying = null; });
    return this.applying;
  }
}
