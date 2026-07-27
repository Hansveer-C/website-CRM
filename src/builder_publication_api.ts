import {
  createBuilderDocumentFingerprint,
  validateBuilderPublishedRevision
} from './builder_publication';
import type { BuilderPublishedRevision } from './builder_publication';
import type {
  BuilderPublicationHistoryPage,
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishRevisionInput,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
import type { RepoResponse, User } from './types';

export interface BuilderPublicationApiResponse<T> {
  status: number;
  body: {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
  };
}

export interface CreateBuilderRevisionRequest {
  websiteId: string;
  pageId: string;
  revision: BuilderPublishedRevision;
}

export interface ListBuilderRevisionsRequest {
  websiteId: string;
  pageId: string;
  limit?: number;
  cursor?: string;
}

export interface GetBuilderPublicationRequest {
  websiteId: string;
  pageId: string;
}

export interface PublishBuilderRevisionRequest {
  websiteId: string;
  pageId: string;
  revisionId: string;
  expectedPublishedRevisionId?: string | null;
  publishedAt: string;
}

export type RollbackBuilderRevisionRequest = PublishBuilderRevisionRequest;

export interface DeleteBuilderRevisionRequest {
  revisionId: string;
}

export interface BuilderPublicationApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  operation:
    | 'create-revision'
    | 'list-revisions'
    | 'get-publication'
    | 'publish-revision'
    | 'rollback-revision'
    | 'delete-revision';
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

export const BUILDER_PUBLICATION_API_ROUTES: readonly BuilderPublicationApiRoute[] =
  deepFreeze([
    {
      method: 'POST',
      path: '/api/websites/:websiteId/pages/:pageId/revisions',
      operation: 'create-revision'
    },
    {
      method: 'GET',
      path: '/api/websites/:websiteId/pages/:pageId/revisions',
      operation: 'list-revisions'
    },
    {
      method: 'GET',
      path: '/api/websites/:websiteId/pages/:pageId/publication',
      operation: 'get-publication'
    },
    {
      method: 'PUT',
      path: '/api/websites/:websiteId/pages/:pageId/publication',
      operation: 'publish-revision'
    },
    {
      method: 'POST',
      path: '/api/websites/:websiteId/pages/:pageId/publication/rollback',
      operation: 'rollback-revision'
    },
    {
      method: 'DELETE',
      path: '/api/builder-revisions/:revisionId',
      operation: 'delete-revision'
    }
  ] satisfies BuilderPublicationApiRoute[]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidUser(user: unknown): user is User | string {
  if (typeof user === 'string') return user.trim().length > 0;
  return isRecord(user) && isNonBlankString(user.id);
}

function invalidInput<T>(error: string): BuilderPublicationApiResponse<T> {
  return {
    status: 400,
    body: { success: false, code: 'INVALID_INPUT', error }
  };
}

function unauthorized<T>(): BuilderPublicationApiResponse<T> {
  return {
    status: 401,
    body: {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Authenticated user is required'
    }
  };
}

function internalError<T>(): BuilderPublicationApiResponse<T> {
  return {
    status: 500,
    body: {
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Builder publication request failed'
    }
  };
}

function repositoryFailure<T>(
  response: RepoResponse<unknown>
): BuilderPublicationApiResponse<T> {
  const semanticCode = (response.code ?? response.error ?? '').toUpperCase();
  let status = 500;

  if (semanticCode === 'UNAUTHORIZED' || semanticCode === 'FORBIDDEN') status = 403;
  else if (semanticCode === 'NOT_FOUND') status = 404;
  else if (semanticCode === 'CONFLICT') status = 409;
  else if (semanticCode === 'INVALID_INPUT' || semanticCode === 'VALIDATION_ERROR') status = 400;
  else if (semanticCode === 'PERSISTENCE_ERROR') status = 500;

  const body: BuilderPublicationApiResponse<T>['body'] = { success: false };
  if (response.error !== undefined) body.error = response.error;
  if (response.code !== undefined) body.code = response.code;
  return { status, body };
}

function successful<T>(status: number, data: T): BuilderPublicationApiResponse<T> {
  return { status, body: { success: true, data } };
}

async function executeRepositoryCall<T>(
  call: () => Promise<RepoResponse<T>>,
  successStatus: number
): Promise<BuilderPublicationApiResponse<T>> {
  try {
    const result = await call();
    if (!result.success) return repositoryFailure<T>(result);
    return successful(successStatus, result.data as T);
  } catch {
    return internalError<T>();
  }
}

function validatePageRequest(
  request: unknown
): BuilderPublicationApiResponse<never> | undefined {
  if (!isRecord(request)) return invalidInput('Request must be a non-null object');
  if (!isNonBlankString(request.websiteId)) return invalidInput('websiteId must be a non-empty string');
  if (!isNonBlankString(request.pageId)) return invalidInput('pageId must be a non-empty string');
  return undefined;
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

function validatePublishRequest(
  request: unknown
): BuilderPublicationApiResponse<never> | BuilderPublishRevisionInput {
  const pageError = validatePageRequest(request);
  if (pageError) return pageError;

  const record = request as Record<string, unknown>;
  if (!isNonBlankString(record.revisionId)) {
    return invalidInput('revisionId must be a non-empty string');
  }
  if (!isValidIsoDateTime(record.publishedAt)) {
    return invalidInput('publishedAt must be an ISO-8601 date-time with a timezone');
  }

  const expectation = record.expectedPublishedRevisionId;
  if (expectation !== undefined && expectation !== null && !isNonBlankString(expectation)) {
    return invalidInput('expectedPublishedRevisionId must be null or a non-empty string');
  }

  return {
    websiteId: record.websiteId as string,
    pageId: record.pageId as string,
    revisionId: record.revisionId,
    publishedAt: record.publishedAt,
    ...(expectation === undefined ? {} : { expectedPublishedRevisionId: expectation })
  };
}

export async function createBuilderRevisionController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: CreateBuilderRevisionRequest
): Promise<BuilderPublicationApiResponse<BuilderPublishedRevision>> {
  if (!isValidUser(user)) return unauthorized();

  const pageError = validatePageRequest(request);
  if (pageError) return pageError;
  if (!isRecord(request.revision)) return invalidInput('revision must be an object');
  if (request.revision.websiteId !== request.websiteId) {
    return invalidInput('revision websiteId must match request websiteId');
  }
  if (request.revision.pageId !== request.pageId) {
    return invalidInput('revision pageId must match request pageId');
  }

  try {
    const issues = validateBuilderPublishedRevision(request.revision);
    if (issues.length > 0) {
      return invalidInput(`revision is invalid: ${issues[0].message}`);
    }
    const fingerprint = createBuilderDocumentFingerprint(request.revision.document);
    if (fingerprint !== request.revision.documentFingerprint) {
      return invalidInput('revision documentFingerprint does not match its document');
    }
  } catch {
    return invalidInput('revision is invalid');
  }

  return executeRepositoryCall(
    () => repository.createRevision(request.revision, user),
    201
  );
}

export async function listBuilderRevisionsController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: ListBuilderRevisionsRequest
): Promise<BuilderPublicationApiResponse<BuilderPublicationHistoryPage>> {
  if (!isValidUser(user)) return unauthorized();

  const pageError = validatePageRequest(request);
  if (pageError) return pageError;
  if (request.limit !== undefined
    && (typeof request.limit !== 'number' || !Number.isFinite(request.limit) || request.limit < 1)) {
    return invalidInput('limit must be a finite number greater than or equal to 1');
  }
  if (request.cursor !== undefined && !isNonBlankString(request.cursor)) {
    return invalidInput('cursor must be a non-empty string');
  }

  const options = request.limit === undefined && request.cursor === undefined
    ? undefined
    : {
    ...(request.limit === undefined ? {} : { limit: request.limit }),
    ...(request.cursor === undefined ? {} : { cursor: request.cursor })
    };
  return executeRepositoryCall(
    () => repository.listRevisionsForPage(request.websiteId, request.pageId, user, options),
    200
  );
}

export async function getBuilderPublicationController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: GetBuilderPublicationRequest
): Promise<BuilderPublicationApiResponse<{
  publishedRevision: BuilderPublishedRevision | null;
  target: BuilderPublicationTarget | null;
}>> {
  if (!isValidUser(user)) return unauthorized();

  const pageError = validatePageRequest(request);
  if (pageError) return pageError;

  try {
    const targetResult = await repository.getPublicationTarget(
      request.websiteId,
      request.pageId,
      user
    );
    if (!targetResult.success) return repositoryFailure(targetResult);

    const revisionResult = await repository.getPublishedRevisionForPage(
      request.websiteId,
      request.pageId,
      user
    );
    if (!revisionResult.success) return repositoryFailure(revisionResult);

    return successful(200, {
      publishedRevision: revisionResult.data ?? null,
      target: targetResult.data ?? null
    });
  } catch {
    return internalError();
  }
}

export async function publishBuilderRevisionController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: PublishBuilderRevisionRequest
): Promise<BuilderPublicationApiResponse<BuilderPublishRevisionResult>> {
  if (!isValidUser(user)) return unauthorized();

  const input = validatePublishRequest(request);
  if ('status' in input) return input;
  return executeRepositoryCall(() => repository.publishRevision(input, user), 200);
}

export async function rollbackBuilderRevisionController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: RollbackBuilderRevisionRequest
): Promise<BuilderPublicationApiResponse<BuilderPublishRevisionResult>> {
  if (!isValidUser(user)) return unauthorized();

  const input = validatePublishRequest(request);
  if ('status' in input) return input;
  return executeRepositoryCall(() => repository.rollbackToRevision(input, user), 200);
}

export async function deleteBuilderRevisionController(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: DeleteBuilderRevisionRequest
): Promise<BuilderPublicationApiResponse<{ id: string }>> {
  if (!isValidUser(user)) return unauthorized();
  if (!isRecord(request)) return invalidInput('Request must be a non-null object');
  if (!isNonBlankString(request.revisionId)) {
    return invalidInput('revisionId must be a non-empty string');
  }

  return executeRepositoryCall(
    () => repository.deleteRevisionIfUnpublished(request.revisionId, user),
    200
  );
}
