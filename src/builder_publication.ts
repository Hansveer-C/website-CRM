import type { BuilderDocument } from './builder_document';
import { validateBuilderDocument } from './builder_document';

export type BuilderPublicationState =
  | 'never-published'
  | 'published'
  | 'changes-pending';

export interface BuilderPublishedRevision {
  schemaVersion: 1;
  id: string;
  websiteId: string;
  pageId: string;
  createdAt: string;
  createdBy?: string;
  document: BuilderDocument;
  documentFingerprint: string;
}

export interface CreateBuilderPublishedRevisionOptions {
  id: string;
  websiteId: string;
  createdAt: string;
  createdBy?: string;
}

export type BuilderPublishedRevisionValidationIssueCode =
  | 'unsupported-schema-version'
  | 'missing-revision-id'
  | 'missing-website-id'
  | 'missing-page-id'
  | 'invalid-created-at'
  | 'document-page-id-mismatch'
  | 'invalid-document'
  | 'invalid-fingerprint';

export interface BuilderPublishedRevisionValidationIssue {
  code: BuilderPublishedRevisionValidationIssueCode;
  message: string;
  path: string;
}

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): T {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return value;
  }

  const objectValue = value as object;
  if (visited.has(objectValue)) {
    return value;
  }

  visited.add(objectValue);
  Reflect.ownKeys(objectValue).forEach(key => {
    deepFreeze((objectValue as Record<PropertyKey, unknown>)[key], visited);
  });

  return Object.freeze(value);
}

function compareSections(
  left: { section: BuilderDocument['sections'][number]; inputIndex: number },
  right: { section: BuilderDocument['sections'][number]; inputIndex: number }
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

function normalizeDocumentSections(document: BuilderDocument): BuilderDocument {
  return {
    ...document,
    sections: document.sections
      .map((section, inputIndex) => ({ section, inputIndex }))
      .sort(compareSections)
      .map(({ section }) => section)
  };
}

function stableSerialize(
  value: unknown,
  ancestors = new WeakSet<object>(),
  path = 'document'
): string {
  if (value === null) return 'null;';
  if (value === undefined) return 'undefined;';

  switch (typeof value) {
    case 'boolean':
      return value ? 'boolean:true;' : 'boolean:false;';
    case 'string':
      return `string:${JSON.stringify(value)};`;
    case 'number':
      if (Number.isNaN(value)) return 'number:NaN;';
      if (value === Number.POSITIVE_INFINITY) return 'number:Infinity;';
      if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity;';
      if (Object.is(value, -0)) return 'number:-0;';
      return `number:${String(value)};`;
    case 'object': {
      const objectValue = value as object;
      if (ancestors.has(objectValue)) {
        throw new Error(
          `Cannot fingerprint BuilderDocument with a circular structure at ${path}.`
        );
      }

      ancestors.add(objectValue);
      try {
        if (Array.isArray(value)) {
          return `array:[${value
            .map((item, index) => stableSerialize(item, ancestors, `${path}[${index}]`))
            .join('')}]`;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new Error(
            `Cannot fingerprint unsupported object value at ${path}.`
          );
        }

        const record = value as Record<string, unknown>;
        const entries = Object.keys(record)
          .sort()
          .map(key => (
            `${JSON.stringify(key)}:${stableSerialize(record[key], ancestors, `${path}.${key}`)}`
          ));
        return `object:{${entries.join('')}}`;
      } finally {
        ancestors.delete(objectValue);
      }
    }
    default:
      throw new Error(`Cannot fingerprint unsupported ${typeof value} value at ${path}.`);
  }
}

function hashCanonicalDocument(serialized: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${serialized.length.toString(36)}`;
}

function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && Number.isFinite(Date.parse(value));
}

export function createBuilderDocumentFingerprint(document: BuilderDocument): string {
  const normalizedDocument = normalizeDocumentSections(document);
  return hashCanonicalDocument(stableSerialize(normalizedDocument));
}

export function createBuilderPublishedRevision(
  document: BuilderDocument,
  options: CreateBuilderPublishedRevisionOptions
): BuilderPublishedRevision {
  if (typeof options.id !== 'string' || !options.id.trim()) {
    throw new Error('Builder published revision ID is required.');
  }

  if (typeof options.websiteId !== 'string' || !options.websiteId.trim()) {
    throw new Error('Builder published revision website ID is required.');
  }

  if (!isValidIsoDateTime(options.createdAt)) {
    throw new Error('Builder published revision createdAt must be a valid ISO-8601 date-time string.');
  }

  const pageId = typeof document.page?.id === 'string' ? document.page.id : '';
  if (!pageId.trim()) {
    throw new Error('Builder published revision document page ID is required.');
  }

  const documentFingerprint = createBuilderDocumentFingerprint(document);
  const clonedDocument = structuredClone(document);
  const revision: BuilderPublishedRevision = {
    schemaVersion: 1,
    id: options.id,
    websiteId: options.websiteId,
    pageId,
    createdAt: options.createdAt,
    document: clonedDocument,
    documentFingerprint,
    ...(options.createdBy === undefined ? {} : { createdBy: options.createdBy })
  };

  return deepFreeze(revision);
}

export function validateBuilderPublishedRevision(
  revision: BuilderPublishedRevision
): BuilderPublishedRevisionValidationIssue[] {
  const issues: BuilderPublishedRevisionValidationIssue[] = [];
  const candidate = revision as unknown as {
    schemaVersion?: unknown;
    id?: unknown;
    websiteId?: unknown;
    pageId?: unknown;
    createdAt?: unknown;
    document?: unknown;
    documentFingerprint?: unknown;
  };

  if (candidate.schemaVersion !== 1) {
    issues.push({
      code: 'unsupported-schema-version',
      message: `Unsupported builder published revision schema version: ${String(candidate.schemaVersion)}.`,
      path: 'schemaVersion'
    });
  }

  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    issues.push({
      code: 'missing-revision-id',
      message: 'Builder published revision ID is required.',
      path: 'id'
    });
  }

  if (typeof candidate.websiteId !== 'string' || !candidate.websiteId.trim()) {
    issues.push({
      code: 'missing-website-id',
      message: 'Builder published revision website ID is required.',
      path: 'websiteId'
    });
  }

  const pageId = typeof candidate.pageId === 'string' ? candidate.pageId.trim() : '';
  if (!pageId) {
    issues.push({
      code: 'missing-page-id',
      message: 'Builder published revision page ID is required.',
      path: 'pageId'
    });
  }

  if (!isValidIsoDateTime(candidate.createdAt)) {
    issues.push({
      code: 'invalid-created-at',
      message: 'Builder published revision createdAt must be a valid ISO-8601 date-time string.',
      path: 'createdAt'
    });
  }

  const documentCandidate = candidate.document as Partial<BuilderDocument> | null | undefined;
  const documentPageId = typeof documentCandidate?.page?.id === 'string'
    ? documentCandidate.page.id
    : '';
  if (pageId && documentPageId !== pageId) {
    issues.push({
      code: 'document-page-id-mismatch',
      message: `Revision page ID "${pageId}" differs from document page ID "${documentPageId}".`,
      path: 'document.page.id'
    });
  }

  if (documentCandidate && typeof documentCandidate === 'object') {
    validateBuilderDocument(documentCandidate as BuilderDocument).forEach(documentIssue => {
      issues.push({
        code: 'invalid-document',
        message: `BuilderDocument ${documentIssue.code}: ${documentIssue.message}`,
        path: `document.${documentIssue.path}`
      });
    });
  } else {
    issues.push({
      code: 'invalid-document',
      message: 'Builder published revision document is required.',
      path: 'document'
    });
  }

  const storedFingerprint = typeof candidate.documentFingerprint === 'string'
    ? candidate.documentFingerprint
    : '';
  if (!storedFingerprint.trim()) {
    issues.push({
      code: 'invalid-fingerprint',
      message: 'Builder published revision document fingerprint is required.',
      path: 'documentFingerprint'
    });
  } else if (documentCandidate && typeof documentCandidate === 'object') {
    try {
      const recomputedFingerprint = createBuilderDocumentFingerprint(
        documentCandidate as BuilderDocument
      );
      if (storedFingerprint !== recomputedFingerprint) {
        issues.push({
          code: 'invalid-fingerprint',
          message: 'Builder published revision fingerprint does not match its document.',
          path: 'documentFingerprint'
        });
      }
    } catch (error) {
      issues.push({
        code: 'invalid-fingerprint',
        message: error instanceof Error
          ? error.message
          : 'Builder published revision document could not be fingerprinted.',
        path: 'documentFingerprint'
      });
    }
  }

  return issues;
}

export function getBuilderPublicationState(
  draftDocument: BuilderDocument,
  publishedRevision?: BuilderPublishedRevision | null
): BuilderPublicationState {
  if (!publishedRevision) return 'never-published';

  const draftFingerprint = createBuilderDocumentFingerprint(draftDocument);
  const publishedFingerprint = createBuilderDocumentFingerprint(
    publishedRevision.document
  );

  return draftFingerprint === publishedFingerprint
    ? 'published'
    : 'changes-pending';
}

export function hasBuilderUnpublishedChanges(
  draftDocument: BuilderDocument,
  publishedRevision?: BuilderPublishedRevision | null
): boolean {
  return getBuilderPublicationState(draftDocument, publishedRevision) !== 'published';
}
