import { dispatchBuilderPublicationRequest } from './builder_publication_dispatcher';
import type { BuilderPublicationRepository } from './builder_publication_repository';
import type { User } from './types';

function getInputUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isNativeRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function getMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof init?.method === 'string') return init.method;
  if (isNativeRequest(input)) return input.method;
  return 'GET';
}

function publicationPathCandidate(url: string): boolean {
  try {
    const pathname = new URL(url, 'http://builder-publication.local').pathname;
    return pathname.startsWith('/api/websites/')
      || pathname.startsWith('/api/builder-revisions/');
  } catch {
    return url.includes('/api/websites/')
      || url.includes('/api/builder-revisions/');
  }
}

export function isBuilderPublicationBrowserRequest(input: RequestInfo | URL): boolean {
  try {
    return publicationPathCandidate(getInputUrl(input));
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function invalidJsonResponse(): Response {
  return jsonResponse({
    success: false,
    code: 'INVALID_INPUT',
    error: 'Invalid JSON request body'
  }, 400);
}

function invalidBodyTypeResponse(): Response {
  return jsonResponse({
    success: false,
    code: 'INVALID_INPUT',
    error: 'Unsupported publication request body'
  }, 400);
}

function internalErrorResponse(): Response {
  return jsonResponse({
    success: false,
    code: 'INTERNAL_ERROR',
    error: 'Builder publication request failed'
  }, 500);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownInitBody(init?: RequestInit): { present: boolean; value: unknown } {
  if (!init || !Object.prototype.hasOwnProperty.call(init, 'body')) {
    return { present: false, value: undefined };
  }
  const descriptor = Object.getOwnPropertyDescriptor(init, 'body');
  return {
    present: true,
    value: descriptor && 'value' in descriptor ? descriptor.value : undefined
  };
}

async function getPublicationBody(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<unknown> {
  const initBody = ownInitBody(init);
  if (initBody.present) return initBody.value;
  if (!isNativeRequest(input) || input.body === null) return undefined;
  return input.clone().text();
}

async function confirmMatchedWithoutBody(
  repository: BuilderPublicationRepository,
  user: User | string,
  method: string,
  url: string
): Promise<Response | null | undefined> {
  const result = await dispatchBuilderPublicationRequest(repository, user, {
    method,
    url,
    body: undefined
  });
  if (!result) return null;
  if (result.response.status === 405) {
    return jsonResponse(result.response.body, result.response.status);
  }
  return undefined;
}

export async function handleBuilderPublicationBrowserRequest(
  repository: BuilderPublicationRepository,
  user: User | string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  let identifiable = false;
  try {
    const url = getInputUrl(input);
    identifiable = publicationPathCandidate(url);
    if (!identifiable) return null;

    const method = getMethod(input, init);
    const normalizedMethod = method.toUpperCase();
    let body: unknown = undefined;

    if (normalizedMethod === 'POST' || normalizedMethod === 'PUT') {
      const suppliedBody = await getPublicationBody(input, init);
      if (suppliedBody === undefined) {
        body = undefined;
      } else if (typeof suppliedBody === 'string') {
        if (!suppliedBody.trim()) {
          const methodResponse = await confirmMatchedWithoutBody(
            repository,
            user,
            method,
            url
          );
          if (methodResponse === null) return null;
          return methodResponse ?? invalidJsonResponse();
        }
        try {
          body = JSON.parse(suppliedBody) as unknown;
        } catch {
          const methodResponse = await confirmMatchedWithoutBody(
            repository,
            user,
            method,
            url
          );
          if (methodResponse === null) return null;
          return methodResponse ?? invalidJsonResponse();
        }
      } else if (isPlainObject(suppliedBody)) {
        body = suppliedBody;
      } else {
        const methodResponse = await confirmMatchedWithoutBody(
          repository,
          user,
          method,
          url
        );
        if (methodResponse === null) return null;
        return methodResponse ?? invalidBodyTypeResponse();
      }
    }

    const result = await dispatchBuilderPublicationRequest(repository, user, {
      method,
      url,
      body
    });
    if (!result) return null;
    return jsonResponse(result.response.body, result.response.status);
  } catch {
    return identifiable ? internalErrorResponse() : null;
  }
}
