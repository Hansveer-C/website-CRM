import type {
  BuilderDocument,
  BuilderDocumentValidationIssue
} from './builder_document';
import { validateBuilderDocument } from './builder_document';
import type {
  BuilderEditorState,
  BuilderViewport
} from './builder_editor_state';
import {
  canRedoBuilderEditorState,
  canUndoBuilderEditorState,
  createBuilderEditorState,
  reduceBuilderEditorState
} from './builder_editor_state';

export const BUILDER_HISTORY_LIMIT = 50;
export const BUILDER_TYPING_COALESCE_MS = 800;

export type BuilderMutationCategory =
  | 'content'
  | 'design'
  | 'layout'
  | 'structural';

export interface BuilderMutationMetadata {
  category: BuilderMutationCategory;
  sectionId?: string;
  fieldId?: string;
  timestamp?: number;
  coalesce?: boolean;
  selectSectionId?: string | null;
}

export interface BuilderMutationResult {
  changed: boolean;
  issues: BuilderDocumentValidationIssue[];
}

export interface BuilderSaveSnapshot {
  generation: number;
  pageId: string;
  document: BuilderDocument;
}

export interface BuilderSaveAcknowledgement {
  accepted: boolean;
  stale: boolean;
  isDirty: boolean;
}

export interface BuilderHistoryKeyboardEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  preventDefault(): void;
}

export interface BuilderHistoryKeyboardContext {
  isBuilderActive: boolean;
  publicationModalOpen: boolean;
  targetIsEditable: boolean;
  targetIsBuilderDocumentControl: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export type BuilderHistoryKeyboardCommand = 'undo' | 'redo';

type CoalescingState = {
  pageId: string;
  sectionId: string;
  fieldId: string;
  category: BuilderMutationCategory;
  timestamp: number;
};

function cloneDocument(document: BuilderDocument): BuilderDocument {
  return structuredClone(document);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function areBuilderDocumentsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) =>
        areBuilderDocumentsEqual(value, right[index])
      );
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key =>
        Object.prototype.hasOwnProperty.call(right, key)
        && areBuilderDocumentsEqual(left[key], right[key])
      );
  }
  return false;
}

function normalizeDirtyState(
  state: BuilderEditorState,
  persistedDocument: BuilderDocument
): BuilderEditorState {
  const isDirty = !areBuilderDocumentsEqual(state.document, persistedDocument);
  return state.isDirty === isDirty ? state : { ...state, isDirty };
}

function fallbackSelection(
  before: BuilderDocument,
  after: BuilderDocument,
  selectedSectionId: string | null
): string | null {
  const afterIds = new Set(after.sections.map(section => section.id));
  const beforeIds = new Set(before.sections.map(section => section.id));
  const restored = after.sections.find(section => !beforeIds.has(section.id));
  if (restored) return restored.id;
  if (selectedSectionId && afterIds.has(selectedSectionId)) {
    return selectedSectionId;
  }
  if (after.sections.length === 0) return null;

  const previousIndex = selectedSectionId
    ? before.sections.findIndex(section => section.id === selectedSectionId)
    : -1;
  const fallbackIndex = previousIndex < 0
    ? 0
    : Math.min(previousIndex, after.sections.length - 1);
  return after.sections[fallbackIndex]?.id ?? null;
}

function canCoalesce(
  previous: CoalescingState | null,
  next: CoalescingState
): boolean {
  return previous !== null
    && previous.pageId === next.pageId
    && previous.sectionId === next.sectionId
    && previous.fieldId === next.fieldId
    && previous.category === next.category
    && next.timestamp >= previous.timestamp
    && next.timestamp - previous.timestamp <= BUILDER_TYPING_COALESCE_MS;
}

export class BuilderHistoryController {
  private state: BuilderEditorState;
  private persistedDocument: BuilderDocument;
  private coalescing: CoalescingState | null = null;
  private saveGeneration = 0;
  private latestAcknowledgedGeneration = 0;
  private readonly saveDocuments = new Map<number, BuilderDocument>();

  constructor(
    document: BuilderDocument,
    options: {
      selectedSectionId?: string | null;
      viewport?: BuilderViewport;
    } = {}
  ) {
    const issues = validateBuilderDocument(document);
    if (issues.length > 0) {
      throw new Error('Cannot initialize Builder history with an invalid document.');
    }
    this.state = createBuilderEditorState(document, options);
    this.persistedDocument = cloneDocument(this.state.document);
  }

  get pageId(): string {
    return this.state.document.page.id;
  }

  get document(): BuilderDocument {
    return cloneDocument(this.state.document);
  }

  get snapshot(): BuilderEditorState {
    return structuredClone(this.state);
  }

  get selectedSectionId(): string | null {
    return this.state.selectedSectionId;
  }

  get viewport(): BuilderViewport {
    return this.state.viewport;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  get canUndo(): boolean {
    return canUndoBuilderEditorState(this.state);
  }

  get canRedo(): boolean {
    return canRedoBuilderEditorState(this.state);
  }

  selectSection(sectionId: string | null): boolean {
    const next = reduceBuilderEditorState(this.state, {
      type: 'select-section',
      sectionId
    });
    if (next === this.state) return false;
    this.state = next;
    this.breakCoalescing();
    return true;
  }

  setViewport(viewport: BuilderViewport): boolean {
    const next = reduceBuilderEditorState(this.state, {
      type: 'set-viewport',
      viewport
    });
    if (next === this.state) return false;
    this.state = next;
    return true;
  }

  breakCoalescing(): void {
    this.coalescing = null;
  }

  /**
   * Keeps page metadata current without adding it to section undo/redo history.
   */
  synchronizePageMetadata(page: BuilderDocument['page']): boolean {
    if (page.id !== this.pageId) return false;
    const replacePage = (document: BuilderDocument): BuilderDocument => ({
      ...document,
      page: structuredClone(page)
    });
    this.state = {
      ...this.state,
      document: replacePage(this.state.document),
      past: this.state.past.map(replacePage),
      future: this.state.future.map(replacePage)
    };
    this.persistedDocument = replacePage(this.persistedDocument);
    this.saveDocuments.forEach((document, generation) => {
      this.saveDocuments.set(generation, replacePage(document));
    });
    return true;
  }

  applyMutation(
    mutator: (document: BuilderDocument) => BuilderDocument,
    metadata: BuilderMutationMetadata
  ): BuilderMutationResult {
    const current = this.state.document;
    let candidate: BuilderDocument;
    try {
      candidate = mutator(cloneDocument(current));
    } catch {
      return { changed: false, issues: [] };
    }

    const issues = validateBuilderDocument(candidate);
    if (issues.length > 0) {
      return { changed: false, issues };
    }
    if (areBuilderDocumentsEqual(current, candidate)) {
      return { changed: false, issues: [] };
    }

    const timestamp = metadata.timestamp ?? Date.now();
    const coalescingCandidate = metadata.coalesce !== false
      && metadata.category !== 'structural'
      && typeof metadata.sectionId === 'string'
      && typeof metadata.fieldId === 'string'
      ? {
          pageId: this.pageId,
          sectionId: metadata.sectionId,
          fieldId: metadata.fieldId,
          category: metadata.category,
          timestamp
        }
      : null;
    const mergeWithPrevious = coalescingCandidate !== null
      && canCoalesce(this.coalescing, coalescingCandidate);
    const previousPast = this.state.past;

    let next = reduceBuilderEditorState(this.state, {
      type: 'replace-document',
      document: candidate,
      preserveHistory: true,
      markDirty: true
    });
    if (mergeWithPrevious) {
      next = { ...next, past: previousPast };
    }
    if (metadata.selectSectionId !== undefined) {
      next = reduceBuilderEditorState(next, {
        type: 'select-section',
        sectionId: metadata.selectSectionId
      });
    }
    this.state = normalizeDirtyState(next, this.persistedDocument);
    this.coalescing = coalescingCandidate;
    return { changed: true, issues: [] };
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const before = this.state.document;
    const previousSelection = this.state.selectedSectionId;
    let next = reduceBuilderEditorState(this.state, { type: 'undo' });
    const selection = fallbackSelection(before, next.document, previousSelection);
    next = reduceBuilderEditorState(next, {
      type: 'select-section',
      sectionId: selection
    });
    this.state = normalizeDirtyState(next, this.persistedDocument);
    this.breakCoalescing();
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    const before = this.state.document;
    const previousSelection = this.state.selectedSectionId;
    let next = reduceBuilderEditorState(this.state, { type: 'redo' });
    const selection = fallbackSelection(before, next.document, previousSelection);
    next = reduceBuilderEditorState(next, {
      type: 'select-section',
      sectionId: selection
    });
    this.state = normalizeDirtyState(next, this.persistedDocument);
    this.breakCoalescing();
    return true;
  }

  createSaveSnapshot(): BuilderSaveSnapshot | null {
    if (!this.state.isDirty) return null;
    for (const pendingDocument of this.saveDocuments.values()) {
      if (areBuilderDocumentsEqual(pendingDocument, this.state.document)) {
        return null;
      }
    }
    const generation = ++this.saveGeneration;
    const document = cloneDocument(this.state.document);
    this.saveDocuments.set(generation, document);
    return { generation, pageId: this.pageId, document: cloneDocument(document) };
  }

  acknowledgeSave(
    generation: number,
    succeeded: boolean
  ): BuilderSaveAcknowledgement {
    const document = this.saveDocuments.get(generation);
    this.saveDocuments.delete(generation);
    if (!document || generation < this.latestAcknowledgedGeneration) {
      return { accepted: false, stale: true, isDirty: this.state.isDirty };
    }
    if (!succeeded) {
      return { accepted: false, stale: false, isDirty: this.state.isDirty };
    }

    this.latestAcknowledgedGeneration = generation;
    this.persistedDocument = cloneDocument(document);
    this.state = normalizeDirtyState(this.state, this.persistedDocument);
    return { accepted: true, stale: false, isDirty: this.state.isDirty };
  }
}

export class BuilderSerializedSaveQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  whenIdle(): Promise<void> {
    return this.tail;
  }
}

export function getBuilderHistoryKeyboardCommand(
  event: BuilderHistoryKeyboardEvent,
  context: BuilderHistoryKeyboardContext
): BuilderHistoryKeyboardCommand | null {
  if (
    !context.isBuilderActive
    || context.publicationModalOpen
    || event.isComposing
    || event.altKey
    || (!event.ctrlKey && !event.metaKey)
    || (event.ctrlKey && event.metaKey)
    || (context.targetIsEditable && !context.targetIsBuilderDocumentControl)
  ) {
    return null;
  }

  const key = event.key.toLowerCase();
  const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
  const undo = key === 'z' && !event.shiftKey;
  if (redo && context.canRedo) return 'redo';
  if (undo && context.canUndo) return 'undo';
  return null;
}

export function handleBuilderHistoryKeyboardShortcut(
  event: BuilderHistoryKeyboardEvent,
  context: BuilderHistoryKeyboardContext,
  actions: {
    undo(): boolean;
    redo(): boolean;
  }
): boolean {
  const command = getBuilderHistoryKeyboardCommand(event, context);
  if (!command) return false;
  const handled = command === 'undo' ? actions.undo() : actions.redo();
  if (!handled) return false;
  event.preventDefault();
  return true;
}
