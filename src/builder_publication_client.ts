import type { BuilderPublishedRevision } from './builder_publication';
import type {
  BuilderPublicationHistoryPage,
  BuilderPublicationTarget,
  BuilderPublishRevisionResult
} from './builder_publication_repository';

export type BuilderPublicationClientResult<T> =
  | { success: true; status: number; data: T }
  | { success: false; status: number; error: string; code?: string };

export type BuilderPublicationFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export interface BuilderPagePublication {
  publishedRevision: BuilderPublishedRevision | null;
  target: BuilderPublicationTarget | null;
}

export interface PublishBuilderPageRevisionInput {
  revisionId: string;
  publishedAt: string;
  expectedPublishedRevisionId: string | null;
}

export interface ListBuilderPageRevisionsInput {
  websiteId: string;
  pageId: string;
  limit?: number;
  cursor?: string;
}

export interface RollbackBuilderPageRevisionInput {
  websiteId: string;
  pageId: string;
  revisionId: string;
  expectedPublishedRevisionId: string | null;
  publishedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeFailure(
  status: number,
  error: string,
  code?: string
): BuilderPublicationClientResult<never> {
  return {
    success: false,
    status,
    error,
    ...(code === undefined ? {} : { code })
  };
}

async function executePublicationRequest<T>(
  fetcher: BuilderPublicationFetch,
  input: string,
  init?: RequestInit
): Promise<BuilderPublicationClientResult<T>> {
  try {
    const response = await fetcher(input, init);
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      return safeFailure(response.status, 'Invalid publication response', 'INVALID_RESPONSE');
    }

    if (!isRecord(envelope) || typeof envelope.success !== 'boolean') {
      return safeFailure(response.status, 'Invalid publication response', 'INVALID_RESPONSE');
    }
    if (!envelope.success) {
      return safeFailure(
        response.status,
        typeof envelope.error === 'string' && envelope.error
          ? envelope.error
          : 'Builder publication request failed',
        typeof envelope.code === 'string' && envelope.code ? envelope.code : undefined
      );
    }
    if (!Object.prototype.hasOwnProperty.call(envelope, 'data')) {
      return safeFailure(response.status, 'Invalid publication response', 'INVALID_RESPONSE');
    }

    return { success: true, status: response.status, data: envelope.data as T };
  } catch {
    return safeFailure(0, 'Builder publication request failed', 'NETWORK_ERROR');
  }
}

function pageBasePath(websiteId: string, pageId: string): string {
  return `/api/websites/${encodeURIComponent(websiteId)}/pages/${encodeURIComponent(pageId)}`;
}

function validateHistoryPage(
  result: BuilderPublicationClientResult<unknown>
): BuilderPublicationClientResult<BuilderPublicationHistoryPage> {
  if (!result.success) return result;
  if (
    !isRecord(result.data)
    || !Array.isArray(result.data.items)
    || (result.data.nextCursor !== undefined && typeof result.data.nextCursor !== 'string')
  ) {
    return safeFailure(result.status, 'Invalid publication response', 'INVALID_RESPONSE');
  }
  return {
    success: true,
    status: result.status,
    data: result.data as unknown as BuilderPublicationHistoryPage
  };
}

function validatePublishResult(
  result: BuilderPublicationClientResult<unknown>
): BuilderPublicationClientResult<BuilderPublishRevisionResult> {
  if (!result.success) return result;
  if (
    !isRecord(result.data)
    || !isRecord(result.data.revision)
    || !isRecord(result.data.target)
    || !Object.prototype.hasOwnProperty.call(result.data, 'previousRevisionId')
    || (
      result.data.previousRevisionId !== null
      && typeof result.data.previousRevisionId !== 'string'
    )
  ) {
    return safeFailure(result.status, 'Invalid publication response', 'INVALID_RESPONSE');
  }
  return {
    success: true,
    status: result.status,
    data: result.data as unknown as BuilderPublishRevisionResult
  };
}

export async function getBuilderPagePublication(
  fetcher: BuilderPublicationFetch,
  websiteId: string,
  pageId: string
): Promise<BuilderPublicationClientResult<BuilderPagePublication>> {
  return executePublicationRequest(fetcher, `${pageBasePath(websiteId, pageId)}/publication`, {
    method: 'GET'
  });
}

export async function createBuilderPageRevision(
  fetcher: BuilderPublicationFetch,
  websiteId: string,
  pageId: string,
  revision: BuilderPublishedRevision
): Promise<BuilderPublicationClientResult<BuilderPublishedRevision>> {
  return executePublicationRequest(fetcher, `${pageBasePath(websiteId, pageId)}/revisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision })
  });
}

export async function publishBuilderPageRevision(
  fetcher: BuilderPublicationFetch,
  websiteId: string,
  pageId: string,
  input: PublishBuilderPageRevisionInput
): Promise<BuilderPublicationClientResult<BuilderPublishRevisionResult>> {
  return executePublicationRequest(fetcher, `${pageBasePath(websiteId, pageId)}/publication`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revisionId: input.revisionId,
      publishedAt: input.publishedAt,
      expectedPublishedRevisionId: input.expectedPublishedRevisionId
    })
  });
}

export async function listBuilderPageRevisions(
  fetcher: BuilderPublicationFetch,
  input: ListBuilderPageRevisionsInput
): Promise<BuilderPublicationClientResult<BuilderPublicationHistoryPage>> {
  const searchParams = new URLSearchParams();
  if (input.limit !== undefined) searchParams.set('limit', String(input.limit));
  if (input.cursor !== undefined) searchParams.set('cursor', input.cursor);
  const query = searchParams.toString();
  const path = `${pageBasePath(input.websiteId, input.pageId)}/revisions${query ? `?${query}` : ''}`;
  const result = await executePublicationRequest<unknown>(fetcher, path, { method: 'GET' });
  return validateHistoryPage(result);
}

export async function rollbackBuilderPageRevision(
  fetcher: BuilderPublicationFetch,
  input: RollbackBuilderPageRevisionInput
): Promise<BuilderPublicationClientResult<BuilderPublishRevisionResult>> {
  const result = await executePublicationRequest<unknown>(
    fetcher,
    `${pageBasePath(input.websiteId, input.pageId)}/publication/rollback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revisionId: input.revisionId,
        expectedPublishedRevisionId: input.expectedPublishedRevisionId,
        publishedAt: input.publishedAt
      })
    }
  );
  return validatePublishResult(result);
}
