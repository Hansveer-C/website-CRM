import { describe, expect, it, vi } from 'vitest';
import { createProductionLead, CrmMutationError, saveProductionQuote, type CrmMutationClient } from './crm_production_mutations';

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
});
