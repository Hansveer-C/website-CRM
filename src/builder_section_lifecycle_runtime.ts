import type { BuilderMutationMetadata } from './builder_history_controller';
import type { BuilderDocument } from './builder_document';
import type { BuilderSectionLifecycleResult } from './builder_section_lifecycle';

export type ApplyBuilderSectionLifecycleMutation = (
  mutator: (document: BuilderDocument) => BuilderDocument,
  metadata: BuilderMutationMetadata
) => boolean;

export function applyBuilderSectionLifecycleResult(
  result: BuilderSectionLifecycleResult,
  fieldId: string,
  applyMutation: ApplyBuilderSectionLifecycleMutation
): boolean {
  if (!result.changed || result.affectedSectionId === null) return false;

  return applyMutation(() => result.document, {
    category: 'structural',
    sectionId: result.affectedSectionId,
    fieldId,
    coalesce: false,
    selectSectionId: result.selectedSectionId
  });
}
