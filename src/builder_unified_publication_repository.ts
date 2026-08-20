import type {
  WebsitePublishPlan,
  WebsitePublishExpectedState,
  WebsitePublishResult,
  WebsitePublicationRecord
} from './builder_unified_publication';

export type UnifiedPublicationErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_BLOCKED'
  | 'INVALID_INPUT'
  | 'TRANSPORT_ERROR';

export type UnifiedPublicationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: UnifiedPublicationErrorCode };

export interface BuilderUnifiedPublicationRepository {
  getPublishPlan(websiteId: string): Promise<UnifiedPublicationResult<WebsitePublishPlan>>;
  publishWebsite(
    websiteId: string,
    expectedState: WebsitePublishExpectedState
  ): Promise<UnifiedPublicationResult<WebsitePublishResult>>;
  getPublicationHistory?(websiteId: string): Promise<UnifiedPublicationResult<WebsitePublicationRecord[]>>;
}
