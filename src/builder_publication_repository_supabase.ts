import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuilderPublishedRevision } from './builder_publication';
import {
  createBuilderDocumentFingerprint,
  validateBuilderPublishedRevision
} from './builder_publication';
import {
  builderPublishedRevisionFromRow,
  builderPublishedRevisionToRow
} from './builder_publication_repository';
import type {
  BuilderPublicationHistoryPage,
  BuilderPublicationListOptions,
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishedRevisionRow,
  BuilderPublishRevisionInput,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
import type { RepoResponse, User } from './types';

const REVISIONS_TABLE = 'builder_published_revisions';
const TARGETS_TABLE = 'builder_publication_targets';
const PUBLISH_RPC = 'publish_builder_revision';
const DELETE_RPC = 'delete_unpublished_builder_revision';

interface BuilderPublicationTargetRow {
  website_id: string;
  page_id: string;
  published_revision_id: string;
  published_at: string;
  published_by?: string | null;
}

interface PublishBuilderRevisionRpcRow {
  publication_target: unknown;
  published_revision: unknown;
  previous_revision_id: string | null;
}

interface SupabaseErrorShape {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

type AuthenticationResult =
  | { authenticated: true; userId: string }
  | { authenticated: false; response: RepoResponse<never> };

export interface SupabaseBuilderPublicationRepositoryOptions {
  client: SupabaseClient;
  verifyAuthenticatedUser?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonblankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
  const candidate = typeof user === 'string'
    ? user
    : isRecord(user) ? user.id : undefined;
  return nonblankString(candidate) ? candidate : undefined;
}

function failure<T>(code: string, error: string): RepoResponse<T> {
  return { success: false, code, error };
}

function invalidInput<T>(error: string): RepoResponse<T> {
  return failure('INVALID_INPUT', error);
}

function unauthorized<T>(): RepoResponse<T> {
  return failure('UNAUTHORIZED', 'UNAUTHORIZED');
}

function persistenceError<T>(): RepoResponse<T> {
  return failure('PERSISTENCE_ERROR', 'SUPABASE_PUBLICATION_PERSISTENCE_ERROR');
}

function integrityError<T>(): RepoResponse<T> {
  return failure('INTEGRITY_ERROR', 'BROKEN_PUBLICATION_TARGET');
}

function forwardFailure<T>(response: RepoResponse<unknown>): RepoResponse<T> {
  return {
    success: false,
    ...(response.error === undefined ? {} : { error: response.error }),
    ...(response.code === undefined ? {} : { code: response.code }),
    ...(response.source === undefined ? {} : { source: response.source })
  };
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

function mapRevisionRow(row: unknown): BuilderPublishedRevision {
  if (
    !isRecord(row)
    || row.schema_version !== 1
    || !nonblankString(row.id)
    || !nonblankString(row.website_id)
    || !nonblankString(row.page_id)
    || !isValidIsoDateTime(row.created_at)
    || !isRecord(row.document)
    || !nonblankString(row.document_fingerprint)
    || (row.created_by !== undefined
      && row.created_by !== null
      && !nonblankString(row.created_by))
  ) {
    throw new Error('Malformed Builder publication revision row.');
  }

  const normalized: BuilderPublishedRevisionRow = {
    schema_version: 1,
    id: row.id,
    website_id: row.website_id,
    page_id: row.page_id,
    created_at: row.created_at,
    document: structuredClone(row.document) as unknown as BuilderPublishedRevisionRow['document'],
    document_fingerprint: row.document_fingerprint,
    ...(nonblankString(row.created_by) ? { created_by: row.created_by } : {})
  };

  return builderPublishedRevisionFromRow(normalized);
}

function mapTargetRow(row: unknown): BuilderPublicationTarget {
  if (
    !isRecord(row)
    || !nonblankString(row.website_id)
    || !nonblankString(row.page_id)
    || !nonblankString(row.published_revision_id)
    || !isValidIsoDateTime(row.published_at)
    || (row.published_by !== undefined
      && row.published_by !== null
      && !nonblankString(row.published_by))
  ) {
    throw new Error('Malformed Builder publication target row.');
  }

  const normalized: BuilderPublicationTargetRow = {
    website_id: row.website_id,
    page_id: row.page_id,
    published_revision_id: row.published_revision_id,
    published_at: row.published_at,
    ...(row.published_by === undefined ? {} : { published_by: row.published_by })
  };
  const target: BuilderPublicationTarget = {
    websiteId: normalized.website_id,
    pageId: normalized.page_id,
    publishedRevisionId: normalized.published_revision_id,
    publishedAt: normalized.published_at,
    ...(nonblankString(normalized.published_by)
      ? { publishedBy: normalized.published_by }
      : {})
  };
  return deepFreeze(structuredClone(target));
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

export class SupabaseBuilderPublicationRepository
implements BuilderPublicationRepository {
  private readonly client: SupabaseClient;
  private readonly verifyAuthenticatedUser: boolean;

  constructor(options: SupabaseBuilderPublicationRepositoryOptions) {
    if (!options || !options.client) {
      throw new Error('SupabaseBuilderPublicationRepository requires a client.');
    }
    if (
      typeof options.client.from !== 'function'
      || typeof options.client.rpc !== 'function'
      || !options.client.auth
      || typeof options.client.auth.getUser !== 'function'
    ) {
      throw new Error('SupabaseBuilderPublicationRepository requires a valid Supabase client.');
    }

    this.client = options.client;
    this.verifyAuthenticatedUser = options.verifyAuthenticatedUser ?? true;
  }

  private async authenticate(user: User | string): Promise<AuthenticationResult> {
    const userId = actingUserId(user);
    if (!userId) {
      return { authenticated: false, response: unauthorized() };
    }

    if (!this.verifyAuthenticatedUser) {
      return { authenticated: true, userId };
    }

    try {
      const result = await this.client.auth.getUser();
      if (result.error || !result.data.user || result.data.user.id !== userId) {
        return { authenticated: false, response: unauthorized() };
      }
      return { authenticated: true, userId };
    } catch {
      return { authenticated: false, response: persistenceError() };
    }
  }

  private mapSupabaseError<T>(error: unknown): RepoResponse<T> {
    if (!isRecord(error)) return persistenceError();

    const shape = error as SupabaseErrorShape;
    const code = typeof shape.code === 'string' ? shape.code : '';
    const message = typeof shape.message === 'string' ? shape.message : '';
    const status = typeof shape.status === 'number' ? shape.status : undefined;

    if (code === '42501' || code === 'PGRST301' || status === 401 || status === 403) {
      return failure('FORBIDDEN', 'FORBIDDEN');
    }
    if (code === 'P0002' || code === 'PGRST116') {
      return failure('NOT_FOUND', 'NOT_FOUND');
    }
    if (code === '23505') {
      return failure('CONFLICT', 'REVISION_ID_ALREADY_EXISTS');
    }
    if (code === '40001' || message.includes('BUILDER_PUBLICATION_TARGET_CONFLICT')) {
      return failure('CONFLICT', 'PUBLICATION_TARGET_CONFLICT');
    }
    if (code === '55006' || message.includes('BUILDER_REVISION_IS_PUBLISHED')) {
      return failure('CONFLICT', 'PUBLISHED_REVISION_CANNOT_BE_DELETED');
    }
    if (
      code === '22P02'
      || code === '22004'
      || code === '23502'
      || code === '23503'
      || code === '23514'
    ) {
      return invalidInput('INVALID_DATABASE_INPUT');
    }
    return persistenceError();
  }

  private async fetchRevisionById(
    revisionId: string,
    websiteId?: string,
    pageId?: string
  ): Promise<RepoResponse<BuilderPublishedRevision | null>> {
    try {
      let query = this.client
        .from(REVISIONS_TABLE)
        .select('*')
        .eq('id', revisionId);
      if (websiteId !== undefined) query = query.eq('website_id', websiteId);
      if (pageId !== undefined) query = query.eq('page_id', pageId);

      const { data, error } = await query.maybeSingle();
      if (error) return this.mapSupabaseError(error);
      if (data === null) return { success: true, data: null };

      try {
        const revision = mapRevisionRow(data);
        if (
          revision.id !== revisionId
          || (websiteId !== undefined && revision.websiteId !== websiteId)
          || (pageId !== undefined && revision.pageId !== pageId)
        ) {
          return persistenceError();
        }
        return { success: true, data: revision };
      } catch {
        return persistenceError();
      }
    } catch {
      return persistenceError();
    }
  }

  private async fetchPublicationTarget(
    websiteId: string,
    pageId: string
  ): Promise<RepoResponse<BuilderPublicationTarget | null>> {
    try {
      const { data, error } = await this.client
        .from(TARGETS_TABLE)
        .select('website_id,page_id,published_revision_id,published_at,published_by')
        .eq('website_id', websiteId)
        .eq('page_id', pageId)
        .maybeSingle();
      if (error) return this.mapSupabaseError(error);
      if (data === null) return { success: true, data: null };

      try {
        const target = mapTargetRow(data);
        if (target.websiteId !== websiteId || target.pageId !== pageId) {
          return integrityError();
        }
        return { success: true, data: target };
      } catch {
        return persistenceError();
      }
    } catch {
      return persistenceError();
    }
  }

  async createRevision(
    revision: BuilderPublishedRevision,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;

    if (
      !isRecord(revision)
      || !nonblankString(revision.websiteId)
      || !nonblankString(revision.pageId)
    ) {
      return invalidInput('Revision websiteId and pageId are required.');
    }
    if (revision.createdBy !== undefined && revision.createdBy !== authentication.userId) {
      return unauthorized();
    }

    let row: BuilderPublishedRevisionRow;
    try {
      const issues = validateBuilderPublishedRevision(revision);
      if (issues.length > 0) return invalidInput('Invalid builder publication revision.');
      if (createBuilderDocumentFingerprint(revision.document) !== revision.documentFingerprint) {
        return invalidInput('Invalid builder publication revision fingerprint.');
      }
      row = builderPublishedRevisionToRow(revision);
    } catch {
      return invalidInput('Invalid builder publication revision.');
    }

    try {
      const { data, error } = await this.client
        .from(REVISIONS_TABLE)
        .insert(row)
        .select('*')
        .single();
      if (error) return this.mapSupabaseError(error);

      try {
        const inserted = mapRevisionRow(data);
        if (
          inserted.id !== revision.id
          || inserted.websiteId !== revision.websiteId
          || inserted.pageId !== revision.pageId
          || inserted.documentFingerprint !== revision.documentFingerprint
        ) {
          return persistenceError();
        }
        return { success: true, data: inserted };
      } catch {
        return persistenceError();
      }
    } catch {
      return persistenceError();
    }
  }

  async getRevisionById(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (!nonblankString(revisionId)) return invalidInput('Revision ID is required.');

    const result = await this.fetchRevisionById(revisionId);
    if (!result.success) return forwardFailure(result);
    if (!result.data) return failure('NOT_FOUND', 'NOT_FOUND');
    return { success: true, data: result.data };
  }

  async listRevisionsForPage(
    websiteId: string,
    pageId: string,
    user: User | string,
    options: BuilderPublicationListOptions = {}
  ): Promise<RepoResponse<BuilderPublicationHistoryPage>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (!nonblankString(websiteId) || !nonblankString(pageId)) {
      return invalidInput('websiteId and pageId are required.');
    }

    const requestedLimit = options?.limit ?? 25;
    if (
      typeof requestedLimit !== 'number'
      || !Number.isFinite(requestedLimit)
      || requestedLimit < 1
    ) {
      return invalidInput('History limit must be a finite number greater than or equal to 1.');
    }
    const limit = Math.min(100, Math.floor(requestedLimit));

    let cursorRevision: BuilderPublishedRevision | undefined;
    if (options?.cursor !== undefined) {
      if (typeof options.cursor !== 'string') {
        return invalidInput('Unknown builder publication history cursor.');
      }
      const cursorRevisionId = decodeCursor(options.cursor);
      if (!cursorRevisionId) {
        return invalidInput('Unknown builder publication history cursor.');
      }
      const cursorResult = await this.fetchRevisionById(
        cursorRevisionId,
        websiteId,
        pageId
      );
      if (!cursorResult.success) {
        return cursorResult.code === 'NOT_FOUND'
          ? invalidInput('Unknown builder publication history cursor.')
          : forwardFailure(cursorResult);
      }
      if (!cursorResult.data) {
        return invalidInput('Unknown builder publication history cursor.');
      }
      cursorRevision = cursorResult.data;
    }

    try {
      let query = this.client
        .from(REVISIONS_TABLE)
        .select('*')
        .eq('website_id', websiteId)
        .eq('page_id', pageId);
      if (cursorRevision) {
        query = query.or(
          `created_at.lt.${cursorRevision.createdAt},and(created_at.eq.${cursorRevision.createdAt},id.lt.${cursorRevision.id})`
        );
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (error) return this.mapSupabaseError(error);
      if (!Array.isArray(data)) return persistenceError();

      let mapped: BuilderPublishedRevision[];
      try {
        mapped = data.map(mapRevisionRow);
      } catch {
        return persistenceError();
      }
      if (mapped.some(revision => (
        revision.websiteId !== websiteId || revision.pageId !== pageId
      ))) {
        return persistenceError();
      }
      for (let index = 1; index < mapped.length; index += 1) {
        if (compareRevisionHistory(mapped[index - 1], mapped[index]) > 0) {
          return persistenceError();
        }
      }

      const hasMore = mapped.length > limit;
      const items = mapped.slice(0, limit);
      const history: BuilderPublicationHistoryPage = {
        items,
        ...(hasMore && items.length > 0
          ? { nextCursor: encodeCursor(items[items.length - 1].id) }
          : {})
      };
      return { success: true, data: deepFreeze(history) };
    } catch {
      return persistenceError();
    }
  }

  async getPublicationTarget(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublicationTarget | null>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (!nonblankString(websiteId) || !nonblankString(pageId)) {
      return invalidInput('websiteId and pageId are required.');
    }
    return this.fetchPublicationTarget(websiteId, pageId);
  }

  async getPublishedRevisionForPage(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision | null>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (!nonblankString(websiteId) || !nonblankString(pageId)) {
      return invalidInput('websiteId and pageId are required.');
    }

    const targetResult = await this.fetchPublicationTarget(websiteId, pageId);
    if (!targetResult.success) return forwardFailure(targetResult);
    if (!targetResult.data) return { success: true, data: null };

    const target = targetResult.data;
    if (target.websiteId !== websiteId || target.pageId !== pageId) {
      return integrityError();
    }
    const revisionResult = await this.fetchRevisionById(
      target.publishedRevisionId,
      websiteId,
      pageId
    );
    if (!revisionResult.success) return forwardFailure(revisionResult);
    if (!revisionResult.data) return integrityError();
    if (
      revisionResult.data.id !== target.publishedRevisionId
      || revisionResult.data.websiteId !== websiteId
      || revisionResult.data.pageId !== pageId
    ) {
      return integrityError();
    }
    return { success: true, data: revisionResult.data };
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
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (
      !isRecord(input)
      || !nonblankString(input.websiteId)
      || !nonblankString(input.pageId)
      || !nonblankString(input.revisionId)
      || !isValidIsoDateTime(input.publishedAt)
    ) {
      return invalidInput('Publish input requires valid website, page, revision, and timestamp values.');
    }

    const expectationSupplied = Object.prototype.hasOwnProperty.call(
      input,
      'expectedPublishedRevisionId'
    );
    const expectedRevisionId = input.expectedPublishedRevisionId;
    if (
      expectationSupplied
      && expectedRevisionId !== null
      && !nonblankString(expectedRevisionId)
    ) {
      return invalidInput('Expected published revision ID must be null or a nonblank string.');
    }

    const rpcArguments = {
      p_website_id: input.websiteId,
      p_page_id: input.pageId,
      p_revision_id: input.revisionId,
      p_published_at: input.publishedAt,
      p_expected_revision_id: expectedRevisionId ?? null,
      p_expectation_supplied: expectationSupplied
    };

    try {
      const { data, error } = await this.client.rpc(PUBLISH_RPC, rpcArguments);
      if (error) return this.mapSupabaseError(error);
      if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
        return persistenceError();
      }

      const rpcRow = data[0] as unknown as PublishBuilderRevisionRpcRow;
      if (
        rpcRow.previous_revision_id !== null
        && !nonblankString(rpcRow.previous_revision_id)
      ) {
        return persistenceError();
      }

      let target: BuilderPublicationTarget;
      let revision: BuilderPublishedRevision;
      try {
        target = mapTargetRow(rpcRow.publication_target);
        revision = mapRevisionRow(rpcRow.published_revision);
      } catch {
        return persistenceError();
      }

      if (
        target.websiteId !== input.websiteId
        || target.pageId !== input.pageId
        || target.publishedRevisionId !== input.revisionId
        || revision.id !== input.revisionId
        || revision.websiteId !== input.websiteId
        || revision.pageId !== input.pageId
      ) {
        return integrityError();
      }

      return {
        success: true,
        data: deepFreeze({
          revision,
          target,
          previousRevisionId: rpcRow.previous_revision_id
        })
      };
    } catch {
      return persistenceError();
    }
  }

  async deleteRevisionIfUnpublished(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<{ id: string }>> {
    const authentication = await this.authenticate(user);
    if (!authentication.authenticated) return authentication.response;
    if (!nonblankString(revisionId)) return invalidInput('Revision ID is required.');

    try {
      const { data, error } = await this.client.rpc(DELETE_RPC, {
        p_revision_id: revisionId
      });
      if (error) return this.mapSupabaseError(error);
      if (!nonblankString(data)) return persistenceError();
      if (data !== revisionId) return integrityError();
      return { success: true, data: deepFreeze({ id: data }) };
    } catch {
      return persistenceError();
    }
  }
}
