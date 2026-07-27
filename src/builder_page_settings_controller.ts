import type { Page } from './types';
import {
  applyBuilderPageSettings,
  getBuilderPageSettingsDiff,
  normalizeBuilderPageSettings,
  pageToBuilderPageSettings,
  validateBuilderPageSettings,
  type BuilderPageSettings,
  type BuilderPageSettingsField,
  type BuilderPageSettingsPatch,
  type BuilderPageSettingsValidationContext,
  type BuilderPageSettingsValidationIssue
} from './builder_page_settings';

export type BuilderPageSettingsSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface BuilderPageSettingsPersistResult {
  success: boolean;
  page?: Page;
  code?: 'CONFLICT' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNAVAILABLE' | 'INVALID_RESPONSE';
}

export interface BuilderPageSettingsControllerOptions {
  page: Page;
  validationContext?: BuilderPageSettingsValidationContext;
  persist: (pageId: string, patch: BuilderPageSettingsPatch) => Promise<BuilderPageSettingsPersistResult>;
  onOptimisticPage?: (page: Page) => void;
  onSettledPage?: (page: Page) => void;
}

export class BuilderPageSettingsController {
  readonly pageId: string;
  private persistedPage: Page;
  private draftValue: BuilderPageSettings;
  private validationContext: BuilderPageSettingsValidationContext;
  private requestGeneration = 0;
  private inFlight = false;
  private persist: BuilderPageSettingsControllerOptions['persist'];
  private onOptimisticPage?: BuilderPageSettingsControllerOptions['onOptimisticPage'];
  private onSettledPage?: BuilderPageSettingsControllerOptions['onSettledPage'];
  status: BuilderPageSettingsSaveStatus = 'idle';
  issues: BuilderPageSettingsValidationIssue[] = [];

  constructor(options: BuilderPageSettingsControllerOptions) {
    this.pageId = options.page.id;
    this.persistedPage = structuredClone(options.page);
    this.draftValue = pageToBuilderPageSettings(options.page);
    this.validationContext = { ...options.validationContext };
    this.persist = options.persist;
    this.onOptimisticPage = options.onOptimisticPage;
    this.onSettledPage = options.onSettledPage;
  }

  get draft(): BuilderPageSettings {
    return { ...this.draftValue };
  }

  get isDirty(): boolean {
    return Object.keys(getBuilderPageSettingsDiff(
      pageToBuilderPageSettings(this.persistedPage),
      this.draftValue
    )).length > 0;
  }

  get canSave(): boolean {
    return this.isDirty && !this.inFlight && this.issues.length === 0;
  }

  updateField(field: BuilderPageSettingsField, value: string): void {
    this.draftValue = { ...this.draftValue, [field]: value };
    this.issues = validateBuilderPageSettings(this.draftValue, this.validationContext);
    this.status = this.isDirty ? 'unsaved' : 'idle';
  }

  replaceValidationContext(context: BuilderPageSettingsValidationContext): void {
    this.validationContext = { ...context };
    this.issues = validateBuilderPageSettings(this.draftValue, this.validationContext);
  }

  cancelPending(): void {
    this.requestGeneration += 1;
  }

  async save(): Promise<boolean> {
    if (this.inFlight) return false;
    this.issues = validateBuilderPageSettings(this.draftValue, this.validationContext);
    if (this.issues.length > 0) {
      this.status = 'unsaved';
      return false;
    }

    const normalizedDraft = normalizeBuilderPageSettings(this.draftValue);
    const patch = getBuilderPageSettingsDiff(
      pageToBuilderPageSettings(this.persistedPage),
      normalizedDraft
    );
    if (Object.keys(patch).length === 0) {
      this.draftValue = normalizedDraft;
      this.status = 'saved';
      return true;
    }

    const generation = ++this.requestGeneration;
    const previousPage = this.persistedPage;
    const optimisticPage = applyBuilderPageSettings(previousPage, normalizedDraft);
    this.inFlight = true;
    this.status = 'saving';
    this.onOptimisticPage?.(optimisticPage);

    let result: BuilderPageSettingsPersistResult;
    try {
      result = await this.persist(this.pageId, patch);
    } catch {
      result = { success: false, code: 'UNAVAILABLE' };
    }

    this.inFlight = false;
    if (generation !== this.requestGeneration) return false;

    if (!result.success || !result.page || result.page.id !== this.pageId) {
      if (result.code === 'CONFLICT') {
        this.issues = [{ field: 'slug', code: 'duplicate-slug', message: 'Another page already uses this URL.' }];
      }
      this.status = 'error';
      this.onSettledPage?.(previousPage);
      return false;
    }

    const safePersistedPage = applyBuilderPageSettings(
      previousPage,
      pageToBuilderPageSettings(result.page)
    );
    this.persistedPage = structuredClone(safePersistedPage);
    const currentDraft = this.draftValue;
    const savedSettings = pageToBuilderPageSettings(safePersistedPage);
    this.draftValue = { ...savedSettings };
    (Object.keys(currentDraft) as BuilderPageSettingsField[]).forEach(field => {
      if (currentDraft[field] !== normalizedDraft[field]) {
        this.draftValue[field] = currentDraft[field];
      }
    });
    this.issues = validateBuilderPageSettings(this.draftValue, this.validationContext);
    this.status = this.isDirty ? 'unsaved' : 'saved';
    this.onSettledPage?.(safePersistedPage);
    return true;
  }

  retry(): Promise<boolean> {
    return this.save();
  }
}
