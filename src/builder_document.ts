import type { Page, PageSection } from './types';

export interface BuilderDocument {
  schemaVersion: 1;
  page: BuilderDocumentPage;
  sections: BuilderDocumentSection[];
}

/**
 * Builder-facing page metadata using the existing Page field names.
 *
 * Extending Page keeps this adapter backward-compatible when the Page model
 * gains fields without introducing a second set of renamed properties.
 */
export interface BuilderDocumentPage extends Page {}

/**
 * A lossless builder representation of an existing PageSection.
 *
 * Visibility is currently stored inside styles (for example,
 * styles.visible), so cloning styles preserves it without adding a competing
 * top-level field.
 */
export interface BuilderDocumentSection extends PageSection {}

export type BuilderDocumentValidationIssueCode =
  | 'unsupported_schema_version'
  | 'missing_page_id'
  | 'missing_section_id'
  | 'missing_section_type'
  | 'duplicate_section_id'
  | 'section_page_mismatch'
  | 'invalid_section_order'
  | 'sections_out_of_order';

export interface BuilderDocumentValidationIssue {
  code: BuilderDocumentValidationIssueCode;
  message: string;
  path: string;
  sectionId?: string;
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function compareSectionOrder(
  left: { section: BuilderDocumentSection; inputIndex: number },
  right: { section: BuilderDocumentSection; inputIndex: number }
): number {
  const leftIsFinite = typeof left.section.order === 'number'
    && Number.isFinite(left.section.order);
  const rightIsFinite = typeof right.section.order === 'number'
    && Number.isFinite(right.section.order);

  if (leftIsFinite && rightIsFinite && left.section.order !== right.section.order) {
    return left.section.order - right.section.order;
  }

  if (leftIsFinite !== rightIsFinite) {
    return leftIsFinite ? -1 : 1;
  }

  return left.inputIndex - right.inputIndex;
}

function cloneAndSortSections(
  sections: readonly BuilderDocumentSection[]
): BuilderDocumentSection[] {
  return sections
    .map((section, inputIndex) => ({
      section: {
        ...section,
        content: deepClone(section.content),
        styles: deepClone(section.styles)
      },
      inputIndex
    }))
    .sort(compareSectionOrder)
    .map(({ section }) => section);
}

export function createBuilderDocument(
  page: Page,
  sections: PageSection[]
): BuilderDocument {
  return {
    schemaVersion: 1,
    page: deepClone(page),
    sections: cloneAndSortSections(sections)
  };
}

export function builderDocumentToPageSections(
  document: BuilderDocument
): PageSection[] {
  return cloneAndSortSections(document.sections);
}

export function validateBuilderDocument(
  document: BuilderDocument
): BuilderDocumentValidationIssue[] {
  const issues: BuilderDocumentValidationIssue[] = [];
  const candidate = document as unknown as {
    schemaVersion?: unknown;
    page?: { id?: unknown };
    sections?: unknown;
  };

  if (candidate.schemaVersion !== 1) {
    issues.push({
      code: 'unsupported_schema_version',
      message: `Unsupported builder document schema version: ${String(candidate.schemaVersion)}.`,
      path: 'schemaVersion'
    });
  }

  const pageId = typeof candidate.page?.id === 'string'
    ? candidate.page.id.trim()
    : '';

  if (!pageId) {
    issues.push({
      code: 'missing_page_id',
      message: 'The builder document page ID is required.',
      path: 'page.id'
    });
  }

  const sections = Array.isArray(candidate.sections)
    ? candidate.sections as Array<Partial<BuilderDocumentSection> | null>
    : [];
  const sectionIds = new Set<string>();
  let previousFiniteOrder: number | undefined;

  sections.forEach((section, index) => {
    const path = `sections[${index}]`;
    const sectionId = typeof section?.id === 'string' ? section.id.trim() : '';

    if (!sectionId) {
      issues.push({
        code: 'missing_section_id',
        message: 'Section ID is required.',
        path: `${path}.id`
      });
    } else if (sectionIds.has(sectionId)) {
      issues.push({
        code: 'duplicate_section_id',
        message: `Section ID "${sectionId}" is duplicated.`,
        path: `${path}.id`,
        sectionId
      });
    } else {
      sectionIds.add(sectionId);
    }

    if (typeof section?.type !== 'string' || !section.type.trim()) {
      issues.push({
        code: 'missing_section_type',
        message: 'Section type is required.',
        path: `${path}.type`,
        sectionId: sectionId || undefined
      });
    }

    if (
      pageId
      && (typeof section?.page_id !== 'string' || section.page_id !== pageId)
    ) {
      issues.push({
        code: 'section_page_mismatch',
        message: `Section belongs to page "${String(section?.page_id)}" instead of "${pageId}".`,
        path: `${path}.page_id`,
        sectionId: sectionId || undefined
      });
    }

    const order = section?.order;
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      issues.push({
        code: 'invalid_section_order',
        message: 'Section order must be a finite number.',
        path: `${path}.order`,
        sectionId: sectionId || undefined
      });
      return;
    }

    if (previousFiniteOrder !== undefined && order < previousFiniteOrder) {
      issues.push({
        code: 'sections_out_of_order',
        message: 'Sections must be arranged by ascending order with equal-order sections kept stable.',
        path: path,
        sectionId: sectionId || undefined
      });
    }

    previousFiniteOrder = order;
  });

  return issues;
}
