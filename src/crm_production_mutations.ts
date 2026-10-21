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

export interface QuoteServicePropertyInput {
  quoteId: string;
  expectedRevision: number;
  propertyId: string;
  requestKey: string;
}

export interface QuoteServicePropertyResult {
  quoteId: string;
  propertyId: string;
  revision: number;
  replayed: boolean;
}

export interface AcceptedServiceLocation {
  schema_version: 1;
  property_id: string;
  label: string | null;
  service_address_line1: string;
  service_address_line2: string | null;
  locality: string;
  administrative_area: string | null;
  postal_code: string | null;
  country_code: string;
}

export type AcceptedServiceLocationEvidence =
  | { status: 'legacy_unrecorded' }
  | { status: 'unassigned' }
  | { status: 'recorded'; location: AcceptedServiceLocation };

export interface InvoiceCreationInput {
  quoteId: string;
  acceptedQuoteRevision: number;
  requestKey: string;
}

export interface InvoiceCreationResult {
  invoice: Record<string, unknown>;
  items: Record<string, unknown>[];
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Associates an existing quote without changing pricing or bypassing server identity. */
export async function setProductionQuoteServiceProperty(
  client: CrmMutationClient,
  input: QuoteServicePropertyInput
): Promise<QuoteServicePropertyResult> {
  if (!uuidPattern.test(input.quoteId) || !uuidPattern.test(input.propertyId)
    || !uuidPattern.test(input.requestKey) || !Number.isInteger(input.expectedRevision)
    || input.expectedRevision < 1 || input.expectedRevision >= 2147483647) {
    throw new CrmMutationError('INVALID_INPUT', 'A quote revision, service location and request key are required.');
  }
  const quoteId = input.quoteId.toLowerCase();
  const propertyId = input.propertyId.toLowerCase();
  const result = await client.rpc('set_crm_quote_service_property', {
    p_quote_id: quoteId,
    p_expected_revision: input.expectedRevision,
    p_property_id: propertyId,
    p_request_key: input.requestKey.toLowerCase()
  });
  if (result.error) {
    if (isConflictError(result.error)) throw new CrmMutationError('CONFLICT');
    if (isInvalidInputError(result.error)) throw new CrmMutationError('INVALID_INPUT');
    throw new CrmMutationError('UNAVAILABLE');
  }
  const payload = requireObject(result.data);
  if (payload.quote_id !== quoteId || payload.property_id !== propertyId
    || payload.revision !== input.expectedRevision + 1 || typeof payload.replayed !== 'boolean'
    || ['user_id', 'request_key', 'request_fingerprint'].some(key => Object.hasOwn(payload, key))) {
    throw new CrmMutationError('INVALID_RESPONSE');
  }
  return { quoteId, propertyId, revision: payload.revision as number, replayed: payload.replayed };
}

/** Missing historical evidence is explicit; this never consults current customer/property data. */
export function readAcceptedServiceLocation(snapshot: unknown): AcceptedServiceLocationEvidence {
  if (Array.isArray(snapshot)) throw new CrmMutationError('INVALID_RESPONSE');
  const envelope = requireObject(snapshot);
  if (!Object.hasOwn(envelope, 'service_location') && !Object.hasOwn(envelope, 'service_location_status')) {
    return { status: 'legacy_unrecorded' };
  }
  if (envelope.service_location_status === 'unassigned' && envelope.service_location === null) {
    return { status: 'unassigned' };
  }
  const location = requireObject(envelope.service_location);
  const required = (key: string, max: number) => typeof location[key] === 'string'
    && (location[key] as string).trim().length > 0 && (location[key] as string).length <= max;
  const optional = (key: string, max: number) => location[key] === null
    || (typeof location[key] === 'string' && (location[key] as string).length <= max);
  if (envelope.service_location_status !== 'recorded' || location.schema_version !== 1
    || typeof location.property_id !== 'string' || !uuidPattern.test(location.property_id)
    || !required('service_address_line1', 200) || !required('locality', 120)
    || typeof location.country_code !== 'string' || !/^[A-Z]{2}$/.test(location.country_code)
    || !optional('label', 120) || !optional('service_address_line2', 200)
    || !optional('administrative_area', 120) || !optional('postal_code', 32)
    || ['user_id', 'request_key', 'request_fingerprint'].some(key => Object.hasOwn(location, key))) {
    throw new CrmMutationError('INVALID_RESPONSE');
  }
  return { status: 'recorded', location: location as unknown as AcceptedServiceLocation };
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

/**
 * Creates the durable invoice only through the database transaction. No
 * browser-supplied customer, amount, currency, line, or status is accepted.
 */
export async function createInvoiceFromAcceptedQuote(
  client: CrmMutationClient,
  input: InvoiceCreationInput
): Promise<InvoiceCreationResult> {
  if (!input.quoteId || !Number.isInteger(input.acceptedQuoteRevision) || input.acceptedQuoteRevision < 1 || !input.requestKey) {
    throw new CrmMutationError('INVALID_INPUT', 'An accepted quote revision and request key are required.');
  }
  const result = await client.rpc('create_invoice_from_accepted_quote', {
    p_quote_id: input.quoteId,
    p_accepted_quote_revision: input.acceptedQuoteRevision,
    p_request_key: input.requestKey
  });
  if (result.error) {
    if (isConflictError(result.error)) throw new CrmMutationError('CONFLICT', 'This accepted quote is no longer available for invoicing. Refresh it before trying again.');
    if (isInvalidInputError(result.error)) throw new CrmMutationError('INVALID_INPUT', 'This accepted quote cannot be converted to an invoice.');
    throw new CrmMutationError('UNAVAILABLE');
  }
  const payload = requireObject(result.data);
  const invoice = requireObject(payload.invoice);
  const items = Array.isArray(payload.items) ? payload.items.map(requireObject) : null;
  if (!items || typeof invoice.id !== 'string' || typeof invoice.user_id !== 'string'
    || invoice.status !== 'issued' || typeof invoice.invoice_number !== 'number'
    || Object.hasOwn(invoice, 'request_key') || Object.hasOwn(invoice, 'request_fingerprint')) {
    throw new CrmMutationError('INVALID_RESPONSE');
  }
  return { invoice, items, replayed: payload.replayed === true };
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
