import type {
  BuilderDocument,
  BuilderDocumentSection
} from './builder_document';

export type BuilderViewport = 'desktop' | 'tablet' | 'mobile';

export interface BuilderEditorState {
  document: BuilderDocument;
  selectedSectionId: string | null;
  viewport: BuilderViewport;
  isDirty: boolean;
  past: BuilderDocument[];
  future: BuilderDocument[];
}

export type BuilderEditorAction =
  | {
      type: 'select-section';
      sectionId: string | null;
    }
  | {
      type: 'set-viewport';
      viewport: BuilderViewport;
    }
  | {
      type: 'patch-section';
      sectionId: string;
      patch: {
        content?: Record<string, unknown>;
        styles?: Record<string, unknown>;
        variant?: string | null;
      };
    }
  | {
      type: 'replace-document';
      document: BuilderDocument;
      markDirty?: boolean;
      preserveHistory?: boolean;
    }
  | {
      type: 'mark-saved';
    }
  | {
      type: 'undo';
    }
  | {
      type: 'redo';
    };

const MAX_HISTORY_ENTRIES = 50;

function cloneDocument(document: BuilderDocument): BuilderDocument {
  return structuredClone(document);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mergePlainObjects(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = isPlainObject(existing)
    ? { ...existing }
    : {};

  for (const [key, patchValue] of Object.entries(patch)) {
    const existingValue = result[key];

    if (isPlainObject(patchValue) && isPlainObject(existingValue)) {
      result[key] = mergePlainObjects(existingValue, patchValue);
    } else {
      result[key] = structuredClone(patchValue);
    }
  }

  return result;
}

function areMeaningfullyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => areMeaningfullyEqual(value, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every(
      key => Object.prototype.hasOwnProperty.call(right, key)
        && areMeaningfullyEqual(left[key], right[key])
    );
  }

  return false;
}

function hasSection(document: BuilderDocument, sectionId: string | null): boolean {
  return sectionId !== null
    && document.sections.some(section => section.id === sectionId);
}

function validSelection(
  document: BuilderDocument,
  sectionId: string | null
): string | null {
  return hasSection(document, sectionId) ? sectionId : null;
}

function appendPast(
  past: readonly BuilderDocument[],
  document: BuilderDocument
): BuilderDocument[] {
  return [...past, cloneDocument(document)].slice(-MAX_HISTORY_ENTRIES);
}

function patchSection(
  section: BuilderDocumentSection,
  patch: Extract<BuilderEditorAction, { type: 'patch-section' }>['patch']
): BuilderDocumentSection {
  let nextSection: BuilderDocumentSection = section;

  if (patch.content !== undefined) {
    const content = mergePlainObjects(section.content, patch.content);
    if (!areMeaningfullyEqual(content, section.content)) {
      nextSection = { ...nextSection, content };
    }
  }

  if (patch.styles !== undefined) {
    const styles = mergePlainObjects(section.styles, patch.styles);
    if (!areMeaningfullyEqual(styles, section.styles)) {
      nextSection = { ...nextSection, styles };
    }
  }

  if (patch.variant !== undefined) {
    if (patch.variant === null) {
      if (nextSection.variant !== undefined) {
        const sectionWithoutVariant = { ...nextSection };
        delete sectionWithoutVariant.variant;
        nextSection = sectionWithoutVariant;
      }
    } else if (nextSection.variant !== patch.variant) {
      nextSection = { ...nextSection, variant: patch.variant };
    }
  }

  return nextSection;
}

export function createBuilderEditorState(
  document: BuilderDocument,
  options: {
    selectedSectionId?: string | null;
    viewport?: BuilderViewport;
  } = {}
): BuilderEditorState {
  const ownedDocument = cloneDocument(document);

  return {
    document: ownedDocument,
    selectedSectionId: validSelection(
      ownedDocument,
      options.selectedSectionId ?? null
    ),
    viewport: options.viewport ?? 'desktop',
    isDirty: false,
    past: [],
    future: []
  };
}

export function reduceBuilderEditorState(
  state: BuilderEditorState,
  action: BuilderEditorAction
): BuilderEditorState {
  switch (action.type) {
    case 'select-section': {
      const selectedSectionId = validSelection(state.document, action.sectionId);
      if (selectedSectionId === state.selectedSectionId) {
        return state;
      }

      return { ...state, selectedSectionId };
    }

    case 'set-viewport':
      if (action.viewport === state.viewport) {
        return state;
      }
      return { ...state, viewport: action.viewport };

    case 'patch-section': {
      const sectionIndex = state.document.sections.findIndex(
        section => section.id === action.sectionId
      );
      if (sectionIndex === -1) {
        return state;
      }

      const currentSection = state.document.sections[sectionIndex];
      const nextSection = patchSection(currentSection, action.patch);
      if (nextSection === currentSection) {
        return state;
      }

      const sections = [...state.document.sections];
      sections[sectionIndex] = nextSection;

      return {
        ...state,
        document: {
          ...state.document,
          sections
        },
        isDirty: true,
        past: appendPast(state.past, state.document),
        future: []
      };
    }

    case 'replace-document': {
      const document = cloneDocument(action.document);
      return {
        ...state,
        document,
        selectedSectionId: validSelection(document, state.selectedSectionId),
        isDirty: action.markDirty === true,
        past: action.preserveHistory
          ? appendPast(state.past, state.document)
          : [],
        future: []
      };
    }

    case 'mark-saved':
      if (!state.isDirty) {
        return state;
      }
      return { ...state, isDirty: false };

    case 'undo': {
      if (state.past.length === 0) {
        return state;
      }

      const document = cloneDocument(state.past[state.past.length - 1]);
      return {
        ...state,
        document,
        selectedSectionId: validSelection(document, state.selectedSectionId),
        isDirty: true,
        past: state.past.slice(0, -1),
        future: [...state.future, cloneDocument(state.document)]
      };
    }

    case 'redo': {
      if (state.future.length === 0) {
        return state;
      }

      const document = cloneDocument(state.future[state.future.length - 1]);
      return {
        ...state,
        document,
        selectedSectionId: validSelection(document, state.selectedSectionId),
        isDirty: true,
        past: appendPast(state.past, state.document),
        future: state.future.slice(0, -1)
      };
    }
  }
}

export function canUndoBuilderEditorState(state: BuilderEditorState): boolean {
  return state.past.length > 0;
}

export function canRedoBuilderEditorState(state: BuilderEditorState): boolean {
  return state.future.length > 0;
}
