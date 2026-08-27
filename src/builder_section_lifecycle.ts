import type {
  BuilderDocument,
  BuilderDocumentSection
} from './builder_document';
import { validateBuilderDocument } from './builder_document';
import {
  createBuilderSection,
  isRegisteredBuilderSectionType
} from './builder_section_registry';
import {
  PAGE_SECTION_SAVE_TYPES,
  validatePageSectionSaveRequest
} from './page_section_save_contract';

export type BuilderSectionLifecycleNoopReason =
  | 'invalid-document'
  | 'invalid-section-id'
  | 'section-id-conflict'
  | 'section-type-not-registered'
  | 'invalid-insertion-index'
  | 'section-not-found'
  | 'move-boundary'
  | 'visibility-unchanged'
  | 'reset-unsupported-section-type'
  | 'reset-unchanged'
  | 'invalid-clipboard'
  | 'clipboard-page-mismatch'
  | 'section-type-not-saveable';

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

export interface ResetBuilderSectionOptions {
  sectionId: string;
  selectedSectionId: string | null;
}

export interface BuilderSectionClipboard {
  sourcePageId: string;
  sourceSectionType: string;
  section: BuilderDocumentSection;
}

export type CopyBuilderSectionNoopReason =
  | 'invalid-document'
  | 'section-not-found'
  | 'section-type-not-saveable'
  | 'invalid-section-snapshot';

export interface CopyBuilderSectionResult {
  clipboard: BuilderSectionClipboard | null;
  copiedSectionId: string | null;
  selectedSectionId: string | null;
  reason: CopyBuilderSectionNoopReason | null;
}

export interface CopyBuilderSectionOptions {
  sectionId: string;
  selectedSectionId: string | null;
}

export interface PasteBuilderSectionOptions {
  clipboard: unknown;
  newSectionId: string;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areValuesEqual(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key =>
        Object.prototype.hasOwnProperty.call(right, key)
        && areValuesEqual(left[key], right[key])
      );
  }
  return false;
}

function isSaveableSectionType(type: string): boolean {
  return (PAGE_SECTION_SAVE_TYPES as readonly string[]).includes(type);
}

function isSaveableSectionSnapshot(
  section: unknown,
  sourcePageId: string
): section is BuilderDocumentSection {
  if (
    !isPlainObject(section)
    || !Number.isSafeInteger(section.order)
    || (section.order as number) < 0
  ) {
    return false;
  }
  return validatePageSectionSaveRequest({
    generation: 1,
    expected_revision: null,
    sections: [{ ...section, order: 0 }]
  }, sourcePageId).success;
}

function isWellFormedClipboardSection(
  section: Record<string, unknown>,
  sourcePageId: string
): boolean {
  if (!Number.isSafeInteger(section.order) || (section.order as number) < 0) {
    return false;
  }
  return validatePageSectionSaveRequest({
    generation: 1,
    expected_revision: null,
    sections: [{ ...section, type: 'hero', order: 0 }]
  }, sourcePageId).success;
}

function validateClipboard(value: unknown): BuilderSectionClipboard | null {
  if (!isPlainObject(value)) return null;
  const sourcePageId = typeof value.sourcePageId === 'string'
    ? value.sourcePageId.trim()
    : '';
  const sourceSectionType = typeof value.sourceSectionType === 'string'
    ? value.sourceSectionType.trim()
    : '';
  if (!sourcePageId || !sourceSectionType || !isPlainObject(value.section)) {
    return null;
  }
  if (
    value.section.page_id !== sourcePageId
    || value.section.type !== sourceSectionType
    || !isWellFormedClipboardSection(value.section, sourcePageId)
  ) {
    return null;
  }
  return value as unknown as BuilderSectionClipboard;
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

export function resetSection(
  document: BuilderDocument,
  options: ResetBuilderSectionOptions
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

  const current = document.sections[sectionIndex];
  if (!isRegisteredBuilderSectionType(current.type)) {
    return noChange(
      document,
      options.selectedSectionId,
      'reset-unsupported-section-type'
    );
  }

  const reset = createBuilderSection(current.type, {
    id: current.id,
    pageId: current.page_id,
    order: current.order,
    ...(current.funnel_id !== undefined
      ? { funnelId: current.funnel_id }
      : {})
  });
  if (areValuesEqual(current, reset)) {
    return noChange(document, options.selectedSectionId, 'reset-unchanged');
  }

  const next = cloneDocument(document);
  next.sections[sectionIndex] = reset;
  return changed(next, current.id, current.id);
}

export function copySection(
  document: BuilderDocument,
  options: CopyBuilderSectionOptions
): CopyBuilderSectionResult {
  const noCopy = (reason: CopyBuilderSectionNoopReason): CopyBuilderSectionResult => ({
    clipboard: null,
    copiedSectionId: null,
    selectedSectionId: options.selectedSectionId,
    reason
  });
  if (!hasValidDocument(document)) return noCopy('invalid-document');

  const section = document.sections.find(item => item.id === options.sectionId);
  if (!section) return noCopy('section-not-found');
  if (!isSaveableSectionType(section.type)) {
    return noCopy('section-type-not-saveable');
  }
  if (!isSaveableSectionSnapshot(section, document.page.id)) {
    return noCopy('invalid-section-snapshot');
  }

  try {
    return {
      clipboard: {
        sourcePageId: document.page.id,
        sourceSectionType: section.type,
        section: structuredClone(section)
      },
      copiedSectionId: section.id,
      selectedSectionId: options.selectedSectionId,
      reason: null
    };
  } catch {
    return noCopy('invalid-section-snapshot');
  }
}

export function pasteSection(
  document: BuilderDocument,
  options: PasteBuilderSectionOptions
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

  const clipboard = validateClipboard(options.clipboard);
  if (!clipboard) {
    return noChange(document, options.selectedSectionId, 'invalid-clipboard');
  }
  if (clipboard.sourcePageId !== document.page.id) {
    return noChange(document, options.selectedSectionId, 'clipboard-page-mismatch');
  }
  if (!isSaveableSectionType(clipboard.sourceSectionType)) {
    return noChange(document, options.selectedSectionId, 'section-type-not-saveable');
  }

  const next = cloneDocument(document);
  const selectedIndex = options.selectedSectionId === null
    ? -1
    : next.sections.findIndex(section => section.id === options.selectedSectionId);
  const insertionIndex = selectedIndex === -1
    ? next.sections.length
    : selectedIndex + 1;
  const pasted = structuredClone(clipboard.section);
  pasted.id = options.newSectionId;
  pasted.page_id = next.page.id;
  pasted.order = insertionIndex;
  if (next.page.funnel_id !== undefined) {
    pasted.funnel_id = next.page.funnel_id;
  } else {
    delete pasted.funnel_id;
  }
  next.sections.splice(insertionIndex, 0, pasted);
  const normalized = normalizeSectionOrders(next, next.sections);

  if (!hasValidDocument(normalized)) {
    return noChange(document, options.selectedSectionId, 'invalid-clipboard');
  }
  return changed(normalized, pasted.id, pasted.id);
}
