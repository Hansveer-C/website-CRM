import type { Contact, Opportunity, Quote, QuoteItem } from './types';
import { validateSelectedQuoteTier } from './quote_tier_validation';

export type QuoteTier = 'basic' | 'standard' | 'premium';

export interface QuoteSaveInput {
  requestKey: string;
  contactId: string;
  opportunityId?: string;
  selectedTier: QuoteTier;
  notes?: string;
  items: Array<{
    serviceName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    tier: QuoteTier;
  }>;
}

export interface QuoteSaveResult {
  quote: Quote;
  items: QuoteItem[];
  opportunity: Opportunity | null;
  replayed: boolean;
}

export interface QuoteAcceptanceInput {
  quoteId: string;
  quoteRevision: number;
  requestKey: string;
  signerName: string;
  signatureDataUrl: string | null;
  accessibleDeclaration: boolean;
}

export interface QuoteAcceptanceResult {
  quote: Quote;
  acceptance: Record<string, unknown>;
  replayed: boolean;
}

export interface InternalLeadInput {
  requestKey: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  serviceType?: string;
  message?: string;
  source?: string;
  funnelId?: string;
}

export interface InternalLeadResult {
  contact: Contact;
  opportunity: Opportunity;
  isRepeat: boolean;
  replayed: boolean;
}

interface RpcResult { data: unknown; error: unknown | null }
export interface CrmMutationClient {
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<RpcResult>;
}

export class CrmMutationError extends Error {
  constructor(public readonly code: 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'INVALID_INPUT' | 'CONFLICT', message?: string) {
    super(message ?? (code === 'UNAVAILABLE'
      ? 'This action is temporarily unavailable.'
      : code === 'INVALID_INPUT'
        ? 'The request is invalid.'
        : code === 'CONFLICT'
          ? 'This quote has changed or was already accepted. Refresh it before trying again.'
        : 'The server returned an invalid response.'));
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function requireObject(value: unknown): Record<string, unknown> {
  const result = object(value);
  if (!result) throw new CrmMutationError('INVALID_RESPONSE');
  return result;
}

function isConflictError(error: unknown): boolean {
  const value = object(error);
  return value?.code === '40001' || value?.code === 'P0001' || value?.code === '23505';
}

function isInvalidInputError(error: unknown): boolean {
  return object(error)?.code === '22023';
}

export async function saveProductionQuote(client: CrmMutationClient, input: QuoteSaveInput): Promise<QuoteSaveResult> {
  const validation = validateSelectedQuoteTier(input.items, input.selectedTier);
  if (!validation.success) throw new CrmMutationError('INVALID_INPUT', validation.message);
  const result = await client.rpc('save_crm_quote', {
    p_request_key: input.requestKey,
    p_contact_id: input.contactId,
    p_opportunity_id: input.opportunityId || null,
    p_selected_tier: input.selectedTier,
    p_notes: input.notes ?? '',
    p_items: input.items.map(item => ({
      service_name: item.serviceName,
      description: item.description ?? '',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      tier: item.tier
    }))
  });
  if (result.error) throw new CrmMutationError('UNAVAILABLE');
  const payload = requireObject(result.data);
  const quote = requireObject(payload.quote);
  const items = Array.isArray(payload.items) ? payload.items.map(requireObject) : null;
  if (!items || typeof quote.id !== 'string' || typeof quote.user_id !== 'string') throw new CrmMutationError('INVALID_RESPONSE');
  return {
    quote: quote as unknown as Quote,
    items: items as unknown as QuoteItem[],
    opportunity: payload.opportunity ? requireObject(payload.opportunity) as unknown as Opportunity : null,
    replayed: payload.replayed === true
  };
}

export async function acceptProductionQuote(client: CrmMutationClient, input: QuoteAcceptanceInput): Promise<QuoteAcceptanceResult> {
  if (!input.quoteId || !Number.isInteger(input.quoteRevision) || input.quoteRevision < 1
    || !input.requestKey || !input.signerName.trim()
    || (!input.signatureDataUrl && !input.accessibleDeclaration)) {
    throw new CrmMutationError('INVALID_INPUT', 'Complete the signature and acceptance fields before submitting.');
  }
  const result = await client.rpc('accept_crm_quote', {
    p_quote_id: input.quoteId,
    p_quote_revision: input.quoteRevision,
    p_request_key: input.requestKey,
    p_signer_name: input.signerName,
    p_signature_data_url: input.signatureDataUrl,
    p_accessible_declaration: input.accessibleDeclaration
  });
  if (result.error) {
    if (isConflictError(result.error)) throw new CrmMutationError('CONFLICT');
    if (isInvalidInputError(result.error)) throw new CrmMutationError('INVALID_INPUT', 'The acceptance details are invalid. Review them and try again.');
    throw new CrmMutationError('UNAVAILABLE');
  }
  const payload = requireObject(result.data);
  const quote = requireObject(payload.quote);
  const acceptance = requireObject(payload.acceptance);
  if (quote.id !== input.quoteId || typeof quote.user_id !== 'string'
    || quote.status !== 'approved' || typeof quote.revision !== 'number'
    || typeof acceptance.id !== 'string' || acceptance.quote_id !== input.quoteId
    || Object.hasOwn(acceptance, 'signature_bytes')) {
    throw new CrmMutationError('INVALID_RESPONSE');
  }
  return { quote: quote as unknown as Quote, acceptance, replayed: payload.replayed === true };
}

export async function createProductionLead(client: CrmMutationClient, input: InternalLeadInput): Promise<InternalLeadResult> {
  const result = await client.rpc('create_internal_crm_lead', {
    p_request_key: input.requestKey,
    p_name: input.name,
    p_phone: input.phone || null,
    p_email: input.email || null,
    p_address: input.address || null,
    p_service_type: input.serviceType || null,
    p_message: input.message || null,
    p_source: input.source || 'internal-lead-capture',
    p_funnel_id: input.funnelId || null
  });
  if (result.error) throw new CrmMutationError('UNAVAILABLE');
  const payload = requireObject(result.data);
  const contact = requireObject(payload.contact);
  const opportunity = requireObject(payload.opportunity);
  if (typeof contact.id !== 'string' || typeof contact.user_id !== 'string'
    || typeof opportunity.id !== 'string' || typeof opportunity.user_id !== 'string') {
    throw new CrmMutationError('INVALID_RESPONSE');
  }
  return {
    contact: contact as unknown as Contact,
    opportunity: opportunity as unknown as Opportunity,
    isRepeat: payload.is_repeat === true,
    replayed: payload.replayed === true
  };
}
