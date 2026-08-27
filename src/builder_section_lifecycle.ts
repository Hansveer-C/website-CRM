import type {
  BuilderDocument,
  BuilderDocumentSection
} from './builder_document';
import { validateBuilderDocument } from './builder_document';
import {
  createBuilderSection,
  isRegisteredBuilderSectionType
} from './builder_section_registry';

export type BuilderSectionLifecycleNoopReason =
  | 'invalid-document'
  | 'invalid-section-id'
  | 'section-id-conflict'
  | 'section-type-not-registered'
  | 'invalid-insertion-index'
  | 'section-not-found'
  | 'move-boundary'
  | 'visibility-unchanged';

export interface BuilderSectionLifecycleResult {
  document: BuilderDocument;
  changed: boolean;
  affectedSectionId: string | null;
  selectedSectionId: string | null;
  reason: BuilderSectionLifecycleNoopReason | null;
}

export interface AddBuilderSectionOptions {
  type: string;
  sectionId: string;
  insertionIndex: number;
  selectedSectionId: string | null;
}

export interface DuplicateBuilderSectionOptions {
  sectionId: string;
  newSectionId: string;
  selectedSectionId: string | null;
}

export interface DeleteBuilderSectionOptions {
  sectionId: string;
  selectedSectionId: string | null;
}

export interface MoveBuilderSectionOptions {
  sectionId: string;
  direction: -1 | 1;
  selectedSectionId: string | null;
}

export interface SetBuilderSectionVisibilityOptions {
  sectionId: string;
  visible: boolean;
  selectedSectionId: string | null;
}

function cloneDocument(document: BuilderDocument): BuilderDocument {
  return structuredClone(document);
}

function normalizeSectionOrders(
  document: BuilderDocument,
  sections: readonly BuilderDocumentSection[]
): BuilderDocument {
  return {
    ...document,
    sections: sections.map((section, order) => ({
      ...section,
      order
    }))
  };
}

function noChange(
  document: BuilderDocument,
  selectedSectionId: string | null,
  reason: BuilderSectionLifecycleNoopReason
): BuilderSectionLifecycleResult {
  return {
    document: cloneDocument(document),
    changed: false,
    affectedSectionId: null,
    selectedSectionId,
    reason
  };
}

function changed(
  document: BuilderDocument,
  affectedSectionId: string,
  selectedSectionId: string | null
): BuilderSectionLifecycleResult {
  return {
    document,
    changed: true,
    affectedSectionId,
    selectedSectionId,
    reason: null
  };
}

function hasValidDocument(document: BuilderDocument): boolean {
  return validateBuilderDocument(document).length === 0;
}

function normalizedId(id: string): string {
  return id.trim();
}

function hasSectionId(document: BuilderDocument, sectionId: string): boolean {
  const candidate = normalizedId(sectionId);
  return document.sections.some(section => normalizedId(section.id) === candidate);
}

export function addSection(
  document: BuilderDocument,
  options: AddBuilderSectionOptions
): BuilderSectionLifecycleResult {
  if (!hasValidDocument(document)) {
    return noChange(document, options.selectedSectionId, 'invalid-document');
  }
  if (!normalizedId(options.sectionId)) {
    return noChange(document, options.selectedSectionId, 'invalid-section-id');
  }
  if (hasSectionId(document, options.sectionId)) {
    return noChange(document, options.selectedSectionId, 'section-id-conflict');
  }
  if (!isRegisteredBuilderSectionType(options.type)) {
    return noChange(document, options.selectedSectionId, 'section-type-not-registered');
  }
  if (!Number.isInteger(options.insertionIndex)) {
    return noChange(document, options.selectedSectionId, 'invalid-insertion-index');
  }

  const next = cloneDocument(document);
  const insertionIndex = Math.max(
    0,
    Math.min(options.insertionIndex, next.sections.length)
  );
  const section = createBuilderSection(options.type, {
    id: options.sectionId,
    pageId: next.page.id,
    order: insertionIndex,
    ...(next.page.funnel_id !== undefined
      ? { funnelId: next.page.funnel_id }
      : {})
  });
  next.sections.splice(insertionIndex, 0, section);

  return changed(
    normalizeSectionOrders(next, next.sections),
    section.id,
    section.id
  );
}

export function duplicateSection(
  document: BuilderDocument,
  options: DuplicateBuilderSectionOptions
): BuilderSectionLifecycleResult {
  if (!hasValidDocument(document)) {
    return noChange(document, options.selectedSectionId, 'invalid-document');
  }
  if (!normalizedId(options.newSectionId)) {
    return noChange(document, options.selectedSectionId, 'invalid-section-id');
  }
  if (hasSectionId(document, options.newSectionId)) {
    return noChange(document, options.selectedSectionId, 'section-id-conflict');
  }

  const sourceIndex = document.sections.findIndex(
    section => section.id === options.sectionId
  );
  if (sourceIndex === -1) {
    return noChange(document, options.selectedSectionId, 'section-not-found');
  }

  const next = cloneDocument(document);
  const duplicate = structuredClone(next.sections[sourceIndex]);
  duplicate.id = options.newSectionId;
  duplicate.order = sourceIndex + 1;
  next.sections.splice(sourceIndex + 1, 0, duplicate);

  return changed(
    normalizeSectionOrders(next, next.sections),
    duplicate.id,
    duplicate.id
  );
}

export function deleteSection(
  document: BuilderDocument,
  options: DeleteBuilderSectionOptions
): BuilderSectionLifecycleResult {
  if (!hasValidDocument(document)) {
    return noChange(document, options.selectedSectionId, 'invalid-document');
  }

  const sectionIndex = document.sections.findIndex(
    section => section.id === options.sectionId
  );
  if (sectionIndex === -1) {
    return noChange(document, options.selectedSectionId, 'section-not-found');
  }

  const next = cloneDocument(document);
  next.sections.splice(sectionIndex, 1);
  const selectedSectionId = next.sections[sectionIndex]?.id
    ?? next.sections[sectionIndex - 1]?.id
    ?? null;

  return changed(
    normalizeSectionOrders(next, next.sections),
    options.sectionId,
    selectedSectionId
  );
}

export function moveSection(
  document: BuilderDocument,
  options: MoveBuilderSectionOptions
): BuilderSectionLifecycleResult {
  if (!hasValidDocument(document)) {
    return noChange(document, options.selectedSectionId, 'invalid-document');
  }

  const sectionIndex = document.sections.findIndex(
    section => section.id === options.sectionId
  );
  if (sectionIndex === -1) {
    return noChange(document, options.selectedSectionId, 'section-not-found');
  }

  const targetIndex = sectionIndex + options.direction;
  if (targetIndex < 0 || targetIndex >= document.sections.length) {
    return noChange(document, options.selectedSectionId, 'move-boundary');
  }

  const next = cloneDocument(document);
  const [section] = next.sections.splice(sectionIndex, 1);
  next.sections.splice(targetIndex, 0, section);

  return changed(
    normalizeSectionOrders(next, next.sections),
    options.sectionId,
    options.sectionId
  );
}

export function setSectionVisibility(
  document: BuilderDocument,
  options: SetBuilderSectionVisibilityOptions
): BuilderSectionLifecycleResult {
  if (!hasValidDocument(document)) {
    return noChange(document, options.selectedSectionId, 'invalid-document');
  }

  const sectionIndex = document.sections.findIndex(
    section => section.id === options.sectionId
  );
  if (sectionIndex === -1) {
    return noChange(document, options.selectedSectionId, 'section-not-found');
  }
  const currentVisibility = document.sections[sectionIndex].styles?.visible !== false;
  if (currentVisibility === options.visible) {
    return noChange(document, options.selectedSectionId, 'visibility-unchanged');
  }

  const next = cloneDocument(document);
  const section = next.sections[sectionIndex];
  next.sections[sectionIndex] = {
    ...section,
    styles: {
      ...section.styles,
      visible: options.visible
    }
  };

  return changed(next, options.sectionId, options.sectionId);
}
