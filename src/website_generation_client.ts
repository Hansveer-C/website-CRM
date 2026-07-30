import {
  isWebsiteGenerationResponse,
  type WebsiteGenerationData,
  type WebsiteGenerationInput,
  type WebsiteGenerationResponse
} from './website_generation_contract';

export type WebsiteGenerationClientErrorCode =
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TRANSPORT_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'UNEXPECTED_CONTENT_TYPE'
  | 'EMPTY_RESPONSE'
  | 'MALFORMED_JSON'
  | 'INVALID_RESPONSE';

export class WebsiteGenerationClientError extends Error {
  constructor(
    readonly code: WebsiteGenerationClientErrorCode,
    message: string,
    readonly status?: number,
    readonly retryable = false,
    readonly response?: WebsiteGenerationResponse
  ) {
    super(message);
    this.name = 'WebsiteGenerationClientError';
  }
}

export interface WebsiteGenerationAuth {
  getAccessToken(): Promise<string | null>;
}

export interface WebsiteGenerationClientOptions {
  auth: WebsiteGenerationAuth;
  fetch?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

export class WebsiteGenerationClient {
  private readonly request: typeof fetch;
  private readonly endpoint: string;

  constructor(private readonly options: WebsiteGenerationClientOptions) {
    this.request = options.fetch ?? fetch;
    this.endpoint = options.endpoint ?? '/api/websites/generate';
  }

  async generate(input: WebsiteGenerationInput, idempotencyKey: string): Promise<WebsiteGenerationData> {
    const accessToken = await this.options.auth.getAccessToken();
    if (!accessToken) throw new WebsiteGenerationClientError('UNAUTHENTICATED', 'Sign in again to create your website.', 401);
    let response: Response;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      response = await Promise.race([
        this.request(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(input),
          signal: controller.signal
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new WebsiteGenerationClientError('NETWORK_TIMEOUT', 'Website creation timed out. Try again.', undefined, true));
            controller.abort();
          }, this.options.timeoutMs ?? 15_000);
        })
      ]);
    } catch (error) {
      if (error instanceof WebsiteGenerationClientError) throw error;
      throw new WebsiteGenerationClientError('TRANSPORT_ERROR', 'The request could not reach the server. Try again.', undefined, true);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) {
      throw new WebsiteGenerationClientError('UNEXPECTED_CONTENT_TYPE', 'The server returned an unexpected response.', response.status, response.status >= 500);
    }
    const raw = await response.text();
    if (!raw.trim()) throw new WebsiteGenerationClientError('EMPTY_RESPONSE', 'The server returned an empty response.', response.status, response.status >= 500);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new WebsiteGenerationClientError('MALFORMED_JSON', 'The server returned unreadable data.', response.status, response.status >= 500);
    }
    if (!isWebsiteGenerationResponse(value)) {
      throw new WebsiteGenerationClientError('INVALID_RESPONSE', 'The server response did not match the website contract.', response.status, response.status >= 500);
    }
    if (!response.ok || !value.success) {
      const message = value.success ? 'Website creation failed.' : value.error.message;
      const code: WebsiteGenerationClientErrorCode = response.status === 401
        ? 'UNAUTHENTICATED'
        : response.status === 403
          ? 'UNAUTHORIZED'
          : response.status === 409
            ? 'CONFLICT'
            : response.status === 429
              ? 'RATE_LIMITED'
              : response.status === 400 || response.status === 422
                ? 'VALIDATION_ERROR'
                : 'SERVER_ERROR';
      throw new WebsiteGenerationClientError(code, message, response.status, response.status >= 500 || response.status === 429, value);
    }
    return value.data;
  }
}

export function createWebsiteGenerationIdempotencyKey(randomUUID: () => string = () => crypto.randomUUID()): string {
  return `website-create:${randomUUID()}`;
}
