import type { PublicLeadCreateInput, PublicLeadCreateResult } from './public_lead_contract.ts';
import {
  SupabasePublicSiteDataSource,
  type PublicSiteDataSource,
  type PublicSiteSupabaseClient
} from './public_site_data_source.ts';

export interface PublicLeadDataSource extends PublicSiteDataSource {
  createLead(input: PublicLeadCreateInput): Promise<PublicLeadCreateResult>;
}

interface RpcResult {
  data: unknown;
  error: unknown;
}

export interface PublicLeadSupabaseClient extends PublicSiteSupabaseClient {
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<RpcResult>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export class SupabasePublicLeadDataSource
  extends SupabasePublicSiteDataSource
  implements PublicLeadDataSource {
  constructor(private readonly leadClient: PublicLeadSupabaseClient, baseDomain = 'pressurepro.io') {
    super(leadClient, baseDomain);
  }

  async createLead(input: PublicLeadCreateInput): Promise<PublicLeadCreateResult> {
    const { data, error } = await this.leadClient.rpc('create_public_lead_intake', {
      p_website_id: input.websiteId,
      p_owner_id: input.ownerId,
      p_page_id: input.pageId,
      p_form_section_id: input.formSectionId,
      p_route_funnel_id: input.routeFunnelId,
      p_idempotency_key: input.idempotencyKey,
      p_request_fingerprint: input.requestFingerprint,
      p_ip_hash: input.ipHash,
      p_contact_hash: input.contactHash ?? null,
      p_name: input.fields.name,
      p_email: input.fields.email || null,
      p_phone: input.fields.phone || null,
      p_phone_match: input.fields.phoneMatch || null,
      p_address: input.fields.address || null,
      p_service: input.fields.service || null,
      p_message: input.fields.message || null
    });
    if (error) throw new Error('public-lead-write');
    const result = record(data);
    const outcome = result?.outcome;
    if (outcome === 'accepted') {
      return { outcome, replayed: result?.replayed === true };
    }
    if (outcome === 'conflict' || outcome === 'routing_unavailable') return { outcome };
    if (outcome === 'rate_limited') {
      const retry = Number(result?.retry_after_seconds);
      return { outcome, retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 900 };
    }
    throw new Error('public-lead-write-result');
  }
}
