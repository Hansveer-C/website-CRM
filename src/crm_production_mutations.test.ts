import { describe, expect, it, vi } from 'vitest';
import { acceptProductionQuote, createInvoiceFromAcceptedQuote, createProductionLead, CrmMutationError, saveProductionQuote, type CrmMutationClient } from './crm_production_mutations';

describe('production CRM mutations', () => {
  it('maps quote input to the atomic RPC and returns sanitized durable rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        quote: { id: 'quote-1', user_id: 'user-a', contact_id: 'contact-1' },
        items: [{ id: 'item-1', user_id: 'user-a', quote_id: 'quote-1' }],
        opportunity: { id: 'opp-1', user_id: 'user-a', contact_id: 'contact-1', value: 250 },
        replayed: false
      },
      error: null
    });
    const result = await saveProductionQuote({ rpc } as CrmMutationClient, {
      requestKey: '11111111-1111-4111-8111-111111111111', contactId: 'contact-1', opportunityId: 'opp-1', selectedTier: 'basic',
      items: [{ serviceName: 'Wash', quantity: 1, unitPrice: 250, tier: 'basic' }]
    });
    expect(rpc).toHaveBeenCalledWith('save_crm_quote', expect.objectContaining({ p_contact_id: 'contact-1', p_opportunity_id: 'opp-1' }));
    expect(result.quote.id).toBe('quote-1');
    expect(result.opportunity?.value).toBe(250);
  });

  it('does not expose provider errors', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'sensitive SQL detail' } }) } as CrmMutationClient;
    await expect(saveProductionQuote(client, {
      requestKey: 'key', contactId: 'c', selectedTier: 'basic',
      items: [{ serviceName: 'Wash', quantity: 1, unitPrice: 1, tier: 'basic' }]
    })).rejects.toEqual(expect.objectContaining({ message: 'This action is temporarily unavailable.' }));
  });

  it.each([
    [[{ serviceName: 'Standard wash', quantity: 1, unitPrice: 200, tier: 'standard' as const }]],
    [[{ serviceName: 'Premium wash', quantity: 1, unitPrice: 300, tier: 'premium' as const }]],
    [[
      { serviceName: 'Standard wash', quantity: 1, unitPrice: 200, tier: 'standard' as const },
      { serviceName: 'Premium wash', quantity: 1, unitPrice: 300, tier: 'premium' as const }
    ]]
  ])('rejects a Basic-selected quote without a Basic item before calling persistence', async items => {
    const rpc = vi.fn();
    await expect(saveProductionQuote({ rpc } as CrmMutationClient, {
      requestKey: 'key', contactId: 'c', selectedTier: 'basic', items
    })).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'Add at least one Basic-tier item before saving this quote.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps selected tier, saved total, and opportunity value consistent', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      quote: { id: 'quote-2', user_id: 'user-a', contact_id: 'contact-1', selected_tier: 'basic', total_amount: 250 },
      items: [
        { id: 'basic', user_id: 'user-a', quote_id: 'quote-2', tier: 'basic', total: 250 },
        { id: 'premium', user_id: 'user-a', quote_id: 'quote-2', tier: 'premium', total: 600 }
      ],
      opportunity: { id: 'opp-1', user_id: 'user-a', contact_id: 'contact-1', value: 250 },
      replayed: false
    }, error: null });
    const result = await saveProductionQuote({ rpc } as CrmMutationClient, {
      requestKey: 'key', contactId: 'contact-1', opportunityId: 'opp-1', selectedTier: 'basic',
      items: [
        { serviceName: 'Basic wash', quantity: 1, unitPrice: 250, tier: 'basic' },
        { serviceName: 'Premium wash', quantity: 1, unitPrice: 600, tier: 'premium' }
      ]
    });
    expect(result.quote).toMatchObject({ selected_tier: 'basic', total_amount: 250 });
    expect(result.opportunity?.value).toBe(250);
  });

  it('maps authenticated internal lead input and returns linked records', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      contact: { id: 'contact-1', user_id: 'user-a', name: 'A' },
      opportunity: { id: 'opp-1', user_id: 'user-a', contact_id: 'contact-1' },
      is_repeat: true,
      replayed: true
    }, error: null });
    const result = await createProductionLead({ rpc } as CrmMutationClient, { requestKey: 'key', name: 'A', phone: '5555555555' });
    expect(rpc).toHaveBeenCalledWith('create_internal_crm_lead', expect.objectContaining({ p_name: 'A', p_phone: '5555555555' }));
    expect(result).toMatchObject({ isRepeat: true, replayed: true });
    expect(result.opportunity.contact_id).toBe(result.contact.id);
  });

  it('rejects structurally invalid RPC responses', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { contact: {}, opportunity: {} }, error: null }) } as CrmMutationClient;
    await expect(createProductionLead(client, { requestKey: 'key', name: 'A' })).rejects.toBeInstanceOf(CrmMutationError);
  });

  it('maps durable quote acceptance to the authoritative RPC and never accepts signature bytes in a response', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      quote: { id: 'quote-1', user_id: 'user-a', status: 'approved', revision: 2 },
      acceptance: { id: 'acceptance-1', quote_id: 'quote-1', accepted_at: '2026-08-31T00:00:00Z' },
      replayed: false
    }, error: null });
    const result = await acceptProductionQuote({ rpc } as CrmMutationClient, {
      quoteId: 'quote-1', quoteRevision: 1, requestKey: '11111111-1111-4111-8111-111111111111', signerName: 'Morgan Taylor',
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=', accessibleDeclaration: false
    });
    expect(rpc).toHaveBeenCalledWith('accept_crm_quote', expect.objectContaining({
      p_quote_id: 'quote-1', p_quote_revision: 1, p_signature_data_url: 'data:image/png;base64,iVBORw0KGgo='
    }));
    expect(result.quote.revision).toBe(2);
  });

  it('returns an explicit conflict for stale or already-accepted responses', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '40001' } }) } as CrmMutationClient;
    await expect(acceptProductionQuote(client, {
      quoteId: 'quote-1', quoteRevision: 1, requestKey: '11111111-1111-4111-8111-111111111111', signerName: 'Morgan Taylor',
      signatureDataUrl: null, accessibleDeclaration: true
    })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps server validation failures without exposing database details', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '22023', message: 'internal validation detail' } }) } as CrmMutationClient;
    await expect(acceptProductionQuote(client, {
      quoteId: 'quote-1', quoteRevision: 1, requestKey: '11111111-1111-4111-8111-111111111111', signerName: 'Morgan Taylor',
      signatureDataUrl: null, accessibleDeclaration: true
    })).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'The acceptance details are invalid. Review them and try again.' });
  });

  it('maps accepted-quote invoice creation to the authority RPC without browser commercial values', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      invoice: { id: 'invoice-1', user_id: 'user-a', status: 'issued', invoice_number: 1, total_amount: 250 },
      items: [{ id: 'invoice-item-1', invoice_id: 'invoice-1', line_total: 250 }],
      replayed: false
    }, error: null });
    const result = await createInvoiceFromAcceptedQuote({ rpc } as CrmMutationClient, {
      quoteId: 'quote-1', acceptedQuoteRevision: 1, requestKey: '11111111-1111-4111-8111-111111111111'
    });
    expect(rpc).toHaveBeenCalledWith('create_invoice_from_accepted_quote', {
      p_quote_id: 'quote-1', p_accepted_quote_revision: 1, p_request_key: '11111111-1111-4111-8111-111111111111'
    });
    expect(result).toMatchObject({ replayed: false, invoice: { status: 'issued', invoice_number: 1 } });
  });

  it('rejects invalid invoice conversion input before calling persistence', async () => {
    const rpc = vi.fn();
    await expect(createInvoiceFromAcceptedQuote({ rpc } as CrmMutationClient, {
      quoteId: 'quote-1', acceptedQuoteRevision: 0, requestKey: ''
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not expose invoice conversion database errors', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '22023', message: 'internal evidence detail' } }) } as CrmMutationClient;
    await expect(createInvoiceFromAcceptedQuote(client, {
      quoteId: 'quote-1', acceptedQuoteRevision: 1, requestKey: '11111111-1111-4111-8111-111111111111'
    })).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'This accepted quote cannot be converted to an invoice.' });
  });
});
