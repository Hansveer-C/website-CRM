import type { PageSectionSaveErrorCode } from './page_section_save_contract';

export type BuilderSaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';

export class BuilderSaveStateController {
  private currentStatus: BuilderSaveStatus = 'saved';
  private latestGeneration = 0;

  get status(): BuilderSaveStatus { return this.currentStatus; }

  markDirty(): void {
    if (this.currentStatus !== 'saving') this.currentStatus = 'dirty';
  }

  begin(generation: number): void {
    this.latestGeneration = Math.max(this.latestGeneration, generation);
    this.currentStatus = 'saving';
  }

  complete(generation: number, result: { success: boolean; code?: PageSectionSaveErrorCode }, currentDocumentIsDirty: boolean): void {
    if (generation < this.latestGeneration) return;
    if (!result.success) {
      this.currentStatus = result.code === 'CONFLICT' ? 'conflict' : 'failed';
      return;
    }
    this.currentStatus = currentDocumentIsDirty ? 'dirty' : 'saved';
  }

  resetSaved(): void {
    this.currentStatus = 'saved';
    this.latestGeneration = 0;
  }

  requireReloadForConflict(): void {
    this.currentStatus = 'conflict';
  }
}

export function builderSaveStatusLabel(status: BuilderSaveStatus): string {
  if (status === 'dirty') return 'Editing / Dirty';
  if (status === 'saving') return 'Saving';
  if (status === 'failed') return 'Save failed';
  if (status === 'conflict') return 'Conflict';
  return 'Saved';
}
