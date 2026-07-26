import {
  createBuilderRevisionController,
  deleteBuilderRevisionController,
  getBuilderPublicationController,
  listBuilderRevisionsController,
  publishBuilderRevisionController,
  rollbackBuilderRevisionController
} from './builder_publication_api';
import type { BuilderPublicationApiResponse } from './builder_publication_api';
import type { BuilderPublishedRevision } from './builder_publication';
import type { BuilderPublicationRepository } from './builder_publication_repository';
import type { User } from './types';

export interface BuilderPublicationDispatchRequest {
  method: string;
  url: string;
  body?: unknown;
}

export interface BuilderPublicationDispatchResult {
  matched: true;
  response: BuilderPublicationApiResponse<unknown>;
}

type PublicationRoute =
  | { kind: 'revisions'; websiteId: string; pageId: string }
  | { kind: 'publication'; websiteId: string; pageId: string }
  | { kind: 'rollback'; websiteId: string; pageId: string }
  | { kind: 'delete'; revisionId: string };

const ROLLBACK_PATH = /^\/api\/websites\/([^/]+)\/pages\/([^/]+)\/publication\/rollback\/?$/;
const REVISIONS_PATH = /^\/api\/websites\/([^/]+)\/pages\/([^/]+)\/revisions\/?$/;
const PUBLICATION_PATH = /^\/api\/websites\/([^/]+)\/pages\/([^/]+)\/publication\/?$/;
const DELETE_PATH = /^\/api\/builder-revisions\/([^/]+)\/?$/;

function dispatchError(
  status: number,
  code: string,
  error: string
): BuilderPublicationDispatchResult {
  return {
    matched: true,
    response: {
      status,
      body: { success: false, code, error }
    }
  };
}

function invalidInput(error: string): BuilderPublicationDispatchResult {
  return dispatchError(400, 'INVALID_INPUT', error);
}

function methodNotAllowed(): BuilderPublicationDispatchResult {
  return dispatchError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
}

function internalError(): BuilderPublicationDispatchResult {
  return dispatchError(
    500,
    'INTERNAL_ERROR',
    'Builder publication request failed'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function ownValue(value: object, property: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function identifyMalformedPublicationUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const pathCandidate = value.split('#', 1)[0].split('?', 1)[0];
  return pathCandidate.includes('/api/websites/')
    && pathCandidate.includes('/pages/')
    && (pathCandidate.includes('/revisions') || pathCandidate.includes('/publication'))
    || pathCandidate.includes('/api/builder-revisions/');
}

function decodeRouteValue(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function hasMalformedPercentEncoding(value: string): boolean {
  try {
    decodeURIComponent(value);
    return false;
  } catch {
    return true;
  }
}

function matchRoute(pathname: string): PublicationRoute | 'malformed' | null {
  const rollback = ROLLBACK_PATH.exec(pathname);
  if (rollback) {
    const websiteId = decodeRouteValue(rollback[1]);
    const pageId = decodeRouteValue(rollback[2]);
    return websiteId === undefined || pageId === undefined
      ? 'malformed'
      : { kind: 'rollback', websiteId, pageId };
  }

  const revisions = REVISIONS_PATH.exec(pathname);
  if (revisions) {
    const websiteId = decodeRouteValue(revisions[1]);
    const pageId = decodeRouteValue(revisions[2]);
    return websiteId === undefined || pageId === undefined
      ? 'malformed'
      : { kind: 'revisions', websiteId, pageId };
  }

  const publication = PUBLICATION_PATH.exec(pathname);
  if (publication) {
    const websiteId = decodeRouteValue(publication[1]);
    const pageId = decodeRouteValue(publication[2]);
    return websiteId === undefined || pageId === undefined
      ? 'malformed'
      : { kind: 'publication', websiteId, pageId };
  }

  const deletion = DELETE_PATH.exec(pathname);
  if (deletion) {
    const revisionId = decodeRouteValue(deletion[1]);
    return revisionId === undefined
      ? 'malformed'
      : { kind: 'delete', revisionId };
  }

  return null;
}

function parseListQuery(
  searchParams: URLSearchParams
): { limit?: number; cursor?: string } | BuilderPublicationDispatchResult {
  const limits = searchParams.getAll('limit');
  if (limits.length > 1) return invalidInput('limit must not be repeated');

  const cursors = searchParams.getAll('cursor');
  if (cursors.length > 1) return invalidInput('cursor must not be repeated');

  const options: { limit?: number; cursor?: string } = {};
  if (limits.length === 1) {
    if (limits[0] === '') return invalidInput('limit must not be empty');
    const limit = Number(limits[0]);
    if (!Number.isFinite(limit)) return invalidInput('limit must be a finite number');
    options.limit = limit;
  }

  if (cursors.length === 1) {
    if (cursors[0] === '') return invalidInput('cursor must not be empty');
    options.cursor = cursors[0];
  }

  return options;
}

function matched(
  response: BuilderPublicationApiResponse<unknown>
): BuilderPublicationDispatchResult {
  return { matched: true, response };
}

export async function dispatchBuilderPublicationRequest(
  repository: BuilderPublicationRepository,
  user: User | string,
  request: BuilderPublicationDispatchRequest
): Promise<BuilderPublicationDispatchResult | null> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(request.url, 'http://builder-publication.local');
  } catch {
    return identifyMalformedPublicationUrl(request?.url)
      ? invalidInput('Invalid publication URL')
      : null;
  }

  const route = matchRoute(parsedUrl.pathname);
  if (route === null) return null;
  if (route === 'malformed') return invalidInput('Malformed route parameter encoding');
  if (hasMalformedPercentEncoding(parsedUrl.search)) {
    return invalidInput('Malformed query parameter encoding');
  }

  try {
    const method = typeof request.method === 'string'
      ? request.method.toUpperCase()
      : '';

    if (route.kind === 'revisions') {
      if (method === 'GET') {
        const query = parseListQuery(parsedUrl.searchParams);
        if ('matched' in query) return query;

        return matched(await listBuilderRevisionsController(repository, user, {
          websiteId: route.websiteId,
          pageId: route.pageId,
          ...(query.limit === undefined ? {} : { limit: query.limit }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor })
        }));
      }

      if (method === 'POST') {
        if (!isRecord(request.body)) return invalidInput('Request body must be an object');
        if (!hasOwn(request.body, 'revision')) {
          return invalidInput('Request body must contain revision');
        }

        return matched(await createBuilderRevisionController(repository, user, {
          websiteId: route.websiteId,
          pageId: route.pageId,
          revision: ownValue(request.body, 'revision') as BuilderPublishedRevision
        }));
      }

      return methodNotAllowed();
    }

    if (route.kind === 'publication') {
      if (method === 'GET') {
        return matched(await getBuilderPublicationController(repository, user, {
          websiteId: route.websiteId,
          pageId: route.pageId
        }));
      }

      if (method === 'PUT') {
        if (!isRecord(request.body)) return invalidInput('Request body must be an object');
        const expectationPresent = hasOwn(request.body, 'expectedPublishedRevisionId');

        return matched(await publishBuilderRevisionController(repository, user, {
          websiteId: route.websiteId,
          pageId: route.pageId,
          revisionId: ownValue(request.body, 'revisionId') as string,
          publishedAt: ownValue(request.body, 'publishedAt') as string,
          ...(expectationPresent
            ? { expectedPublishedRevisionId: ownValue(request.body, 'expectedPublishedRevisionId') as string | null | undefined }
            : {})
        }));
      }

      return methodNotAllowed();
    }

    if (route.kind === 'rollback') {
      if (method !== 'POST') return methodNotAllowed();
      if (!isRecord(request.body)) return invalidInput('Request body must be an object');
      const expectationPresent = hasOwn(request.body, 'expectedPublishedRevisionId');

      return matched(await rollbackBuilderRevisionController(repository, user, {
        websiteId: route.websiteId,
        pageId: route.pageId,
        revisionId: ownValue(request.body, 'revisionId') as string,
        publishedAt: ownValue(request.body, 'publishedAt') as string,
        ...(expectationPresent
          ? { expectedPublishedRevisionId: ownValue(request.body, 'expectedPublishedRevisionId') as string | null | undefined }
          : {})
      }));
    }

    if (method !== 'DELETE') return methodNotAllowed();
    return matched(await deleteBuilderRevisionController(repository, user, {
      revisionId: route.revisionId
    }));
  } catch {
    return internalError();
  }
}
