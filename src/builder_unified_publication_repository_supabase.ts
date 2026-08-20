import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  WebsitePublishPlan,
  WebsitePublishExpectedState,
  WebsitePublishResult,
  WebsitePublicationRecord
} from './builder_unified_publication';
import type {
  BuilderUnifiedPublicationRepository,
  UnifiedPublicationErrorCode,
  UnifiedPublicationResult
} from './builder_unified_publication_repository';

export class SupabaseBuilderUnifiedPublicationRepository implements BuilderUnifiedPublicationRepository {
  constructor(private clientProvider: () => Promise<SupabaseClient | null>) {}

  private mapError(err: any): { error: string; code: UnifiedPublicationErrorCode } {
    const message = err?.message || String(err || 'Unknown error');
    const code = err?.code || '';

    if (code === 'PT401' || message.includes('Authentication required') || message.includes('401')) {
      return { error: 'Authentication required to manage website publications.', code: 'UNAUTHORIZED' };
    }
    if (code === 'PT403' || message.includes('Forbidden') || message.includes('403')) {
      return { error: 'You do not have permission to publish this website.', code: 'FORBIDDEN' };
    }
    if (code === 'PT404' || message.includes('Website not found') || message.includes('404')) {
      return { error: 'Website not found.', code: 'NOT_FOUND' };
    }
    if (
      code === 'PT409' ||
      message.includes('modified elsewhere') ||
      message.includes('updated elsewhere') ||
      message.includes('concurrency')
    ) {
      return {
        error: 'Website changes were updated elsewhere. Reload the publish summary before continuing.',
        code: 'CONFLICT'
      };
    }
    if (code === 'PT400' || code === 'PT422' || message.includes('Publication blocked') || message.includes('Invalid')) {
      return { error: message, code: 'VALIDATION_BLOCKED' };
    }

    return { error: message, code: 'TRANSPORT_ERROR' };
  }

  async getPublishPlan(websiteId: string): Promise<UnifiedPublicationResult<WebsitePublishPlan>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('get_builder_website_publish_plan', {
        p_website_id: websiteId
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      if (!data) {
        return { success: false, error: 'No publication plan returned', code: 'TRANSPORT_ERROR' };
      }

      return {
        success: true,
        data: data as WebsitePublishPlan
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }

  async publishWebsite(
    websiteId: string,
    expectedState: WebsitePublishExpectedState
  ): Promise<UnifiedPublicationResult<WebsitePublishResult>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('publish_builder_website', {
        p_website_id: websiteId,
        p_expected_state: expectedState
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      if (!data) {
        return { success: false, error: 'No publication response returned', code: 'TRANSPORT_ERROR' };
      }

      return {
        success: true,
        data: data as WebsitePublishResult
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }

  async getPublicationHistory(websiteId: string): Promise<UnifiedPublicationResult<WebsitePublicationRecord[]>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client
        .from('builder_website_publications')
        .select('*')
        .eq('website_id', websiteId)
        .order('publication_revision', { ascending: false });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      return {
        success: true,
        data: (data || []) as WebsitePublicationRecord[]
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }
}
