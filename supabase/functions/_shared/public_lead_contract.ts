export type PublicLeadFieldValue = string | boolean;

export interface PublicLeadSubmissionRequest {
  host: string;
  path: string;
  formSectionId: string;
  idempotencyKey: string;
  fields: Record<string, PublicLeadFieldValue>;
  startedAt?: string;
  elapsedMs?: number;
  honeypot?: string;
}

export interface PublicLeadAcceptedResponse {
  status: 'accepted';
  message: string;
  replayed?: boolean;
}

export interface PublicLeadErrorResponse {
  status: 'error';
  message: string;
}

export type PublicLeadResponse = PublicLeadAcceptedResponse | PublicLeadErrorResponse;

export interface PublicLeadNormalizedFields {
  name: string;
  email: string;
  phone: string;
  phoneMatch: string;
  address: string;
  service: string;
  message: string;
  values: Record<string, PublicLeadFieldValue>;
}

export interface PublicLeadCreateInput {
  websiteId: string;
  ownerId: string;
  pageId: string;
  formSectionId: string;
  routeFunnelId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  ipHash: string;
  contactHash?: string;
  fields: PublicLeadNormalizedFields;
}

export type PublicLeadCreateResult =
  | { outcome: 'accepted'; replayed: boolean }
  | { outcome: 'conflict' }
  | { outcome: 'rate_limited'; retryAfterSeconds: number }
  | { outcome: 'routing_unavailable' };
