import {
  isPageSectionSaveResponse,
  type PageSectionSaveRequest,
  type PageSectionSaveResponse
} from './page_section_save_contract';

export interface PageSectionSaveClientOptions {
  fetch?: typeof fetch;
  getAccessToken(): Promise<string | null>;
  timeoutMs?: number;
}

async function accessToken(options: PageSectionSaveClientOptions): Promise<string | PageSectionSaveResponse> {
  const token = await options.getAccessToken();
  return token ?? clientFailure('UNAUTHENTICATED', 'Sign in to save this page.');
}

async function readResponse(response: Response): Promise<PageSectionSaveResponse> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) return clientFailure('MALFORMED_RESPONSE', 'The save service returned an unexpected response.');
  let body: unknown;
  try { body = await response.json(); } catch { return clientFailure('MALFORMED_RESPONSE', 'The save service returned invalid JSON.'); }
  return isPageSectionSaveResponse(body) ? body : clientFailure('MALFORMED_RESPONSE', 'The save service returned an invalid result.');
}

function clientFailure(code: 'NETWORK_FAILURE' | 'MALFORMED_RESPONSE' | 'UNAUTHENTICATED', message: string): PageSectionSaveResponse {
  return { success: false, error: { code, message, request_id: 'client', status: 0 } };
}

export function createPageSectionSaveClient(options: PageSectionSaveClientOptions) {
  return async (pageId: string, request: PageSectionSaveRequest): Promise<PageSectionSaveResponse> => {
    const token = await accessToken(options);
    if (typeof token !== 'string') return token;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await (options.fetch ?? fetch)(`/api/pages/${encodeURIComponent(pageId)}/sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      return await readResponse(response);
    } catch {
      return clientFailure('NETWORK_FAILURE', 'The save service could not be reached.');
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createPageSectionRevisionClient(options: PageSectionSaveClientOptions) {
  return async (pageId: string): Promise<PageSectionSaveResponse> => {
    const token = await accessToken(options);
    if (typeof token !== 'string') return token;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await (options.fetch ?? fetch)(`/api/pages/${encodeURIComponent(pageId)}/section-save-revision`, {
        method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
      });
      return await readResponse(response);
    } catch {
      return clientFailure('NETWORK_FAILURE', 'The save service could not be reached.');
    } finally {
      clearTimeout(timeout);
    }
  };
}
