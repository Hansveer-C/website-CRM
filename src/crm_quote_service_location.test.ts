import { describe, expect, it, vi } from 'vitest';
import { readAcceptedServiceLocation, setProductionQuoteServiceProperty } from './crm_production_mutations';

const quoteId = 'aa000000-0000-4000-8000-000000000001';
const propertyId = 'aa000000-0000-4000-8000-000000000002';
const requestKey = 'aa000000-0000-4000-8000-000000000003';
const input = { quoteId, propertyId, requestKey, expectedRevision: 2 };
const location = {
  schema_version: 1, property_id: propertyId, label: 'North building',
  service_address_line1: '10 Service Lane', service_address_line2: null,
  locality: 'Springfield', administrative_area: 'IL', postal_code: '62701', country_code: 'US'
};

describe('quote service-location mutation', () => {
  it.each([false, true])('maps only authoritative IDs/revision and preserves replay=%s', async replayed => {
    const rpc = vi.fn().mockResolvedValue({ data: { quote_id: quoteId, property_id: propertyId, revision: 3, replayed }, error: null });
    await expect(setProductionQuoteServiceProperty({ rpc }, { ...input, quoteId: quoteId.toUpperCase() }))
      .resolves.toEqual({ quoteId, propertyId, revision: 3, replayed });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('set_crm_quote_service_property', {
      p_quote_id: quoteId, p_property_id: propertyId, p_expected_revision: 2, p_request_key: requestKey
    });
  });

  it.each([
    { quoteId: '' }, { propertyId: 'not-a-uuid' }, { requestKey: '' },
    { expectedRevision: 0 }, { expectedRevision: 1.5 }, { expectedRevision: 2147483647 }
  ])('rejects malformed input before persistence: %o', async patch => {
    const rpc = vi.fn();
    await expect(setProductionQuoteServiceProperty({ rpc }, { ...input, ...patch })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['40001', '23505', 'P0001'])('reports server conflict %s without database details', async code => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'private database detail' } });
    await expect(setProductionQuoteServiceProperty({ rpc }, input)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(setProductionQuoteServiceProperty({ rpc }, input)).rejects.not.toThrow('private database detail');
  });

  it.each([['22023', 'INVALID_INPUT'], ['42501', 'UNAVAILABLE'], ['XX000', 'UNAVAILABLE']])('sanitizes %s failures', async (code, expected) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'private address / SQL detail' } });
    await expect(setProductionQuoteServiceProperty({ rpc }, input)).rejects.toMatchObject({ code: expected });
  });

  it.each([
    { quote_id: requestKey }, { property_id: requestKey }, { revision: 4 },
    { replayed: 'true' }, { user_id: 'private-owner' }, { request_key: requestKey }, { request_fingerprint: {} }
  ])('rejects mismatched or private server responses: %o', async patch => {
    const rpc = vi.fn().mockResolvedValue({ data: { quote_id: quoteId, property_id: propertyId, revision: 3, replayed: false, ...patch }, error: null });
    await expect(setProductionQuoteServiceProperty({ rpc }, input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('accepted service-location evidence', () => {
  it('rejects an array envelope rather than labelling it historical evidence', () => {
    expect(() => readAcceptedServiceLocation([])).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it('distinguishes missing historical evidence from an explicitly unassigned new acceptance', () => {
    expect(readAcceptedServiceLocation({ quote: {}, items: [] })).toEqual({ status: 'legacy_unrecorded' });
    expect(readAcceptedServiceLocation({ service_location: null, service_location_status: 'unassigned' })).toEqual({ status: 'unassigned' });
  });

  it('returns only recorded frozen evidence, independently of current customer data', () => {
    expect(readAcceptedServiceLocation({ service_location: location, service_location_status: 'recorded' }))
      .toEqual({ status: 'recorded', location });
  });

  it.each([
    { schema_version: 2 }, { property_id: 'bad' }, { service_address_line1: '' },
    { locality: '' }, { country_code: 'us' }, { user_id: 'private-owner' },
    { request_key: requestKey }, { request_fingerprint: {} }, { postal_code: 'x'.repeat(33) }
  ])('rejects malformed/private evidence: %o', patch => {
    expect(() => readAcceptedServiceLocation({ service_location: { ...location, ...patch }, service_location_status: 'recorded' }))
      .toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it.each([
    null, { service_location: null }, { service_location_status: 'recorded' },
    { service_location: location, service_location_status: 'unassigned' }
  ])('does not invent location evidence for inconsistent envelopes: %o', snapshot => {
    expect(() => readAcceptedServiceLocation(snapshot)).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });
});
