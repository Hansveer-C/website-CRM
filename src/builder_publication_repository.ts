import type { BuilderDocument } from './builder_document';
import type { BuilderPublishedRevision } from './builder_publication';
import {
  createBuilderDocumentFingerprint,
  validateBuilderPublishedRevision
} from './builder_publication';
import type { RepoResponse, User } from './types';

export interface BuilderPublicationHistoryPage {
  items: BuilderPublishedRevision[];
  nextCursor?: string;
}

export interface BuilderPublicationTarget {
  websiteId: string;
  pageId: string;
  publishedRevisionId: string;
  publishedAt: string;
  publishedBy?: string;
}

export interface BuilderPublishRevisionInput {
  websiteId: string;
  pageId: string;
  revisionId: string;
  expectedPublishedRevisionId?: string | null;
  publishedAt: string;
}

export interface BuilderPublishRevisionResult {
  revision: BuilderPublishedRevision;
  target: BuilderPublicationTarget;
  previousRevisionId: string | null;
}

export interface BuilderPublicationListOptions {
  limit?: number;
  cursor?: string;
}

export type BuilderPublicationAccessResolver = (
  user: User | string,
  websiteId: string,
  pageId: string
) => boolean | Promise<boolean>;

export interface BuilderPublicationRepository {
  createRevision(
    revision: BuilderPublishedRevision,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>>;

  getRevisionById(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>>;

  listRevisionsForPage(
    websiteId: string,
    pageId: string,
    user: User | string,
    options?: BuilderPublicationListOptions
  ): Promise<RepoResponse<BuilderPublicationHistoryPage>>;

  getPublishedRevisionForPage(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision | null>>;

  getPublicationTarget(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublicationTarget | null>>;

  publishRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>>;

  rollbackToRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>>;

  deleteRevisionIfUnpublished(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<{ id: string }>>;
}

export interface BuilderPublishedRevisionRow {
  schema_version: 1;
  id: string;
  website_id: string;
  page_id: string;
  created_at: string;
  created_by?: string;
  document: BuilderDocument;
  document_fingerprint: string;
}

export interface InMemoryBuilderPublicationRepositoryOptions {
  canAccessPage: BuilderPublicationAccessResolver;
  revisions?: readonly BuilderPublishedRevision[];
  targets?: readonly BuilderPublicationTarget[];
}

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): T {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return value;
  }

  const objectValue = value as object;
  if (visited.has(objectValue)) return value;

  visited.add(objectValue);
  Reflect.ownKeys(objectValue).forEach(key => {
    deepFreeze((objectValue as Record<PropertyKey, unknown>)[key], visited);
  });

  return Object.freeze(value);
}

function actingUserId(user: User | string): string | undefined {
  const userId = typeof user === 'string' ? user : user.id;
  return typeof userId === 'string' && userId.trim() ? userId : undefined;
}

function invalidInput<T>(message: string): RepoResponse<T> {
  return { success: false, error: message, code: 'INVALID_INPUT' };
}

function unauthorized<T>(): RepoResponse<T> {
  return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
}

function notFound<T>(): RepoResponse<T> {
  return { success: false, error: 'NOT_FOUND', code: 'NOT_FOUND' };
}

function conflict<T>(message: string): RepoResponse<T> {
  return { success: false, error: message, code: 'CONFLICT' };
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

function revisionValidationError(revision: BuilderPublishedRevision): string | null {
  let issues;
  try {
    issues = validateBuilderPublishedRevision(revision);
  } catch (error) {
    return error instanceof Error ? error.message : 'Revision validation failed.';
  }

  if (issues.length > 0) {
    return issues
      .map(issue => `${issue.path}: ${issue.message}`)
      .join('; ');
  }

  try {
    const fingerprint = createBuilderDocumentFingerprint(revision.document);
    if (fingerprint !== revision.documentFingerprint) {
      return 'documentFingerprint does not match the revision document.';
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Revision fingerprinting failed.';
  }

  return null;
}

function cloneAndFreezeRevision(
  revision: BuilderPublishedRevision
): BuilderPublishedRevision {
  const cloned = structuredClone(revision);
  const validationError = revisionValidationError(cloned);
  if (validationError) {
    throw new Error(`Invalid BuilderPublishedRevision: ${validationError}`);
  }
  return deepFreeze(cloned);
}

function cloneAndFreezeTarget(target: BuilderPublicationTarget): BuilderPublicationTarget {
  return deepFreeze(structuredClone(target));
}

function targetKey(websiteId: string, pageId: string): string {
  return `${websiteId}\u0000${pageId}`;
}

function compareRevisionHistory(
  left: BuilderPublishedRevision,
  right: BuilderPublishedRevision
): number {
  const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (timeDifference !== 0) return timeDifference;
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

function encodeCursor(revisionId: string): string {
  const bytes = new TextEncoder().encode(revisionId);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeCursor(cursor: string): string | null {
  try {
    if (!cursor.trim() || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
    const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const revisionId = new TextDecoder().decode(bytes);
    return revisionId || null;
  } catch {
    return null;
  }
}

export function builderPublishedRevisionToRow(
  revision: BuilderPublishedRevision
): BuilderPublishedRevisionRow {
  const validationError = revisionValidationError(revision);
  if (validationError) {
    throw new Error(`Cannot map invalid BuilderPublishedRevision: ${validationError}`);
  }

  const recomputedFingerprint = createBuilderDocumentFingerprint(revision.document);
  return {
    schema_version: revision.schemaVersion,
    id: revision.id,
    website_id: revision.websiteId,
    page_id: revision.pageId,
    created_at: revision.createdAt,
    document: structuredClone(revision.document),
    document_fingerprint: recomputedFingerprint,
    ...(revision.createdBy === undefined ? {} : { created_by: revision.createdBy })
  };
}

export function builderPublishedRevisionFromRow(
  row: BuilderPublishedRevisionRow
): BuilderPublishedRevision {
  let revision: BuilderPublishedRevision;
  try {
    revision = {
      schemaVersion: row.schema_version,
      id: row.id,
      websiteId: row.website_id,
      pageId: row.page_id,
      createdAt: row.created_at,
      document: structuredClone(row.document),
      documentFingerprint: row.document_fingerprint,
      ...(row.created_by === undefined ? {} : { createdBy: row.created_by })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Persisted row could not be cloned.';
    throw new Error(`Invalid BuilderPublishedRevisionRow: ${message}`);
  }

  const validationError = revisionValidationError(revision);
  if (validationError) {
    throw new Error(`Invalid BuilderPublishedRevisionRow: ${validationError}`);
  }

  const recomputedFingerprint = createBuilderDocumentFingerprint(revision.document);
  if (recomputedFingerprint !== row.document_fingerprint) {
    throw new Error('Invalid BuilderPublishedRevisionRow: document fingerprint mismatch.');
  }

  revision.documentFingerprint = recomputedFingerprint;
  return deepFreeze(revision);
}

export class InMemoryBuilderPublicationRepository
implements BuilderPublicationRepository {
  private readonly canAccessPage: BuilderPublicationAccessResolver;
  private readonly revisions = new Map<string, BuilderPublishedRevision>();
  private readonly targets = new Map<string, BuilderPublicationTarget>();

  constructor(options: InMemoryBuilderPublicationRepositoryOptions) {
    if (!options || typeof options.canAccessPage !== 'function') {
      throw new Error('InMemoryBuilderPublicationRepository requires canAccessPage.');
    }

    this.canAccessPage = options.canAccessPage;

    for (const revision of options.revisions ?? []) {
      if (this.revisions.has(revision.id)) {
        throw new Error(`Duplicate seeded builder publication revision ID: ${revision.id}`);
      }
      const stored = cloneAndFreezeRevision(revision);
      this.revisions.set(stored.id, stored);
    }

    for (const target of options.targets ?? []) {
      this.validateSeedTarget(target);
      const key = targetKey(target.websiteId, target.pageId);
      if (this.targets.has(key)) {
        throw new Error(
          `Duplicate seeded builder publication target: ${target.websiteId}/${target.pageId}`
        );
      }
      this.targets.set(key, cloneAndFreezeTarget(target));
    }
  }

  private async hasAccess(
    user: User | string,
    websiteId: string,
    pageId: string
  ): Promise<boolean> {
    try {
      return await this.canAccessPage(user, websiteId, pageId);
    } catch {
      return false;
    }
  }

  private validateSeedTarget(target: BuilderPublicationTarget): void {
    if (
      typeof target.websiteId !== 'string'
      || !target.websiteId.trim()
      || typeof target.pageId !== 'string'
      || !target.pageId.trim()
      || typeof target.publishedRevisionId !== 'string'
      || !target.publishedRevisionId.trim()
      || !isValidIsoDateTime(target.publishedAt)
    ) {
      throw new Error('Invalid seeded builder publication target.');
    }

    const revision = this.revisions.get(target.publishedRevisionId);
    if (
      !revision
      || revision.websiteId !== target.websiteId
      || revision.pageId !== target.pageId
    ) {
      throw new Error(
        `Seeded publication target references an invalid revision: ${target.publishedRevisionId}`
      );
    }
  }

  async createRevision(
    revision: BuilderPublishedRevision,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    if (!await this.hasAccess(user, revision.websiteId, revision.pageId)) {
      return unauthorized();
    }

    if (!revision.websiteId?.trim() || !revision.pageId?.trim()) {
      return invalidInput('Revision websiteId and pageId are required.');
    }

    const userId = actingUserId(user);
    if (revision.createdBy !== undefined && revision.createdBy !== userId) {
      return unauthorized();
    }

    const validationError = revisionValidationError(revision);
    if (validationError) return invalidInput(validationError);

    if (this.revisions.has(revision.id)) {
      return conflict('REVISION_ID_ALREADY_EXISTS');
    }

    try {
      const stored = cloneAndFreezeRevision(revision);
      this.revisions.set(stored.id, stored);
      return { success: true, data: cloneAndFreezeRevision(stored) };
    } catch (error) {
      return invalidInput(error instanceof Error ? error.message : 'Revision could not be stored.');
    }
  }

  async getRevisionById(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    const revision = this.revisions.get(revisionId);
    if (!revision) return notFound();

    if (!await this.hasAccess(user, revision.websiteId, revision.pageId)) {
      return unauthorized();
    }

    return { success: true, data: cloneAndFreezeRevision(revision) };
  }

  async listRevisionsForPage(
    websiteId: string,
    pageId: string,
    user: User | string,
    options: BuilderPublicationListOptions = {}
  ): Promise<RepoResponse<BuilderPublicationHistoryPage>> {
    if (!await this.hasAccess(user, websiteId, pageId)) return unauthorized();

    const requestedLimit = options.limit ?? 25;
    if (
      typeof requestedLimit !== 'number'
      || !Number.isFinite(requestedLimit)
      || requestedLimit < 1
    ) {
      return invalidInput('History limit must be a finite number greater than or equal to 1.');
    }
    const limit = Math.min(100, Math.floor(requestedLimit));

    const revisions = Array.from(this.revisions.values())
      .filter(revision => (
        revision.websiteId === websiteId && revision.pageId === pageId
      ))
      .sort(compareRevisionHistory);

    let startIndex = 0;
    if (options.cursor !== undefined) {
      const cursorRevisionId = decodeCursor(options.cursor);
      const cursorIndex = cursorRevisionId === null
        ? -1
        : revisions.findIndex(revision => revision.id === cursorRevisionId);
      if (cursorIndex < 0) return invalidInput('Unknown builder publication history cursor.');
      startIndex = cursorIndex + 1;
    }

    const selected = revisions.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + selected.length < revisions.length;
    const page: BuilderPublicationHistoryPage = {
      items: selected.map(cloneAndFreezeRevision),
      ...(hasMore && selected.length > 0
        ? { nextCursor: encodeCursor(selected[selected.length - 1].id) }
        : {})
    };

    return { success: true, data: deepFreeze(page) };
  }

  async getPublicationTarget(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublicationTarget | null>> {
    if (!await this.hasAccess(user, websiteId, pageId)) return unauthorized();

    const target = this.targets.get(targetKey(websiteId, pageId));
    return {
      success: true,
      data: target ? cloneAndFreezeTarget(target) : null
    };
  }

  async getPublishedRevisionForPage(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision | null>> {
    if (!await this.hasAccess(user, websiteId, pageId)) return unauthorized();

    const target = this.targets.get(targetKey(websiteId, pageId));
    if (!target) return { success: true, data: null };

    const revision = this.revisions.get(target.publishedRevisionId);
    if (
      !revision
      || revision.websiteId !== websiteId
      || revision.pageId !== pageId
      || revisionValidationError(revision)
    ) {
      return {
        success: false,
        error: 'BROKEN_PUBLICATION_TARGET',
        code: 'INTEGRITY_ERROR'
      };
    }

    return { success: true, data: cloneAndFreezeRevision(revision) };
  }

  async publishRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    return this.updatePublicationTarget(input, user);
  }

  async rollbackToRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    return this.updatePublicationTarget(input, user);
  }

  private async updatePublicationTarget(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    if (!await this.hasAccess(user, input.websiteId, input.pageId)) {
      return unauthorized();
    }

    if (!isValidIsoDateTime(input.publishedAt)) {
      return invalidInput('publishedAt must be a valid ISO-8601 date-time string with a timezone.');
    }

    const revision = this.revisions.get(input.revisionId);
    if (!revision) return notFound();
    if (revision.websiteId !== input.websiteId || revision.pageId !== input.pageId) {
      return invalidInput('Selected revision does not belong to the requested website and page.');
    }

    const validationError = revisionValidationError(revision);
    if (validationError) return invalidInput(validationError);

    const key = targetKey(input.websiteId, input.pageId);
    const currentTarget = this.targets.get(key);
    if (input.expectedPublishedRevisionId !== undefined) {
      const currentRevisionId = currentTarget?.publishedRevisionId ?? null;
      if (currentRevisionId !== input.expectedPublishedRevisionId) {
        return conflict('PUBLICATION_TARGET_CONFLICT');
      }
    }

    const previousRevisionId = currentTarget?.publishedRevisionId ?? null;
    const userId = actingUserId(user);
    const target: BuilderPublicationTarget = {
      websiteId: input.websiteId,
      pageId: input.pageId,
      publishedRevisionId: revision.id,
      publishedAt: input.publishedAt,
      ...(userId === undefined ? {} : { publishedBy: userId })
    };
    const storedTarget = cloneAndFreezeTarget(target);
    this.targets.set(key, storedTarget);

    return {
      success: true,
      data: deepFreeze({
        revision: cloneAndFreezeRevision(revision),
        target: cloneAndFreezeTarget(storedTarget),
        previousRevisionId
      })
    };
  }

  async deleteRevisionIfUnpublished(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<{ id: string }>> {
    const revision = this.revisions.get(revisionId);
    if (!revision) return notFound();

    if (!await this.hasAccess(user, revision.websiteId, revision.pageId)) {
      return unauthorized();
    }

    const isPublished = Array.from(this.targets.values())
      .some(target => target.publishedRevisionId === revisionId);
    if (isPublished) return conflict('PUBLISHED_REVISION_CANNOT_BE_DELETED');

    this.revisions.delete(revisionId);
    return { success: true, data: deepFreeze({ id: revisionId }) };
  }
}
