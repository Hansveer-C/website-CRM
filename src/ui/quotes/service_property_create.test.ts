import { describe, expect, it, vi } from 'vitest';
import { CrmMutationError, createProductionServiceProperty } from '../../crm_production_mutations';
import { ServicePropertyCreateController, renderServicePropertyCreate } from './service_property_create';
import { QuoteServiceLocationController, renderQuoteServiceLocation } from './quote_service_location';

const id = 'ca100000-0000-4000-8000-000000000001';
const input = { requestKey: id, contactId: 'customer-a', serviceAddressLine1: ' 10  Service Lane ', locality: ' Town ', countryCode: ' ca ', label: '<script>Driveway</script>' };
const property = { id, contact_id: 'customer-a', label: '<script>Driveway</script>', service_address_line1: '10 Service Lane', service_address_line2: null, locality: 'Town', administrative_area: null, postal_code: null, country_code: 'CA', created_at: '2026-10-21T00:00:00Z' };
const result = () => ({ property: { ...property }, replayed: false });
const deferred = () => { let resolve!: (value: ReturnType<typeof result>) => void; const promise = new Promise<ReturnType<typeof result>>(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const create = vi.fn().mockResolvedValue(result()), current = vi.fn(() => true), created = vi.fn(), requestKey = vi.fn(() => id);
  const controller = new ServicePropertyCreateController('customer-a', { create, current, created, requestKey });
  const fill = () => { controller.begin(); controller.edit('serviceAddressLine1', '10 Service Lane'); controller.edit('locality', 'Town'); controller.edit('countryCode', 'CA'); };
  return { controller, create, current, created, requestKey, fill };
}
describe('property create RPC boundary', () => {
  it('uses only existing RPC arguments, normalizes input and does not send owner authority', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await createProductionServiceProperty({ rpc }, { ...input, user_id: 'foreign' } as any);
    expect(rpc).toHaveBeenCalledWith('create_crm_property', { p_request_key: id, p_contact_id: 'customer-a', p_service_address_line1: '10 Service Lane', p_locality: 'Town', p_country_code: 'CA', p_service_address_line2: null, p_administrative_area: null, p_postal_code: null, p_label: '<script>Driveway</script>' });
  });
  it.each(['user_id', 'request_key', 'request_fingerprint'])('rejects leaked private response %s', async key => {
    await expect(createProductionServiceProperty({ rpc: vi.fn().mockResolvedValue({ data: { property: { ...property, [key]: 'private' }, replayed: false }, error: null }) }, input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects foreign customer and invalid response shape', async () => {
    for (const patch of [{ contact_id: 'foreign' }, { id: 'bad' }, { country_code: 'ca' }, { service_address_line1: '' }]) {
      await expect(createProductionServiceProperty({ rpc: vi.fn().mockResolvedValue({ data: { property: { ...property, ...patch }, replayed: false }, error: null }) }, input)).rejects.toBeInstanceOf(CrmMutationError);
    }
  });
  it('validates before RPC and sanitizes permission errors', async () => {
    const rpc = vi.fn();
    await expect(createProductionServiceProperty({ rpc }, { ...input, countryCode: '1' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private SQL' } });
    await expect(createProductionServiceProperty({ rpc }, input)).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'This customer is unavailable or your access changed. Refresh before creating a service location.' });
  });
});
describe('inline service-location creation', () => {
  it('selects a created location without silently assigning and hides creation for accepted quotes', async () => {
    const quote = { id: 'q', contact_id: 'customer-a', user_id: 'actor', status: 'draft', revision: 1 } as any;
    const save = vi.fn(), create = vi.fn().mockResolvedValue(result()), load = vi.fn().mockResolvedValue({ quote, locations: [] });
    const controller = new QuoteServiceLocationController('q', 'customer-a', 'actor', { load, save, create, current: () => true, updateQuote: vi.fn(), requestKey: () => id });
    await controller.load(); expect(renderQuoteServiceLocation(controller)).toContain('Add service location');
    const child = controller.creator!; child.begin(); expect(controller.acceptanceBlocked).toBe(true); await controller.load(); expect(load).toHaveBeenCalledTimes(1);
    child.edit('serviceAddressLine1','10 Service Lane'); child.edit('locality','Town'); child.edit('countryCode','CA'); await child.save();
    expect(controller.selected).toBe(id); expect(controller.acceptanceBlocked).toBe(true); expect(save).not.toHaveBeenCalled(); expect(quote.property_id).toBeUndefined();
    load.mockResolvedValue({ quote: { ...quote, status: 'approved' }, locations: [], snapshot: {} }); await controller.load();
    expect(renderQuoteServiceLocation(controller)).not.toContain('Add service location'); child.begin(); expect(child.open).toBe(false);
  });
  it('cancel discards form without writes and validation stays visible', async () => {
    const f = fixture(); f.controller.begin(); await f.controller.save(); expect(renderServicePropertyCreate(f.controller)).toContain('Enter a street address'); expect(f.create).not.toHaveBeenCalled();
    f.controller.edit('label', '<script>alert(1)</script>'); expect(renderServicePropertyCreate(f.controller)).not.toContain('<script>'); f.controller.cancel(); expect(f.controller.open).toBe(false); expect(f.create).not.toHaveBeenCalled();
  });
  it('coalesces clicks, freezes fields/cancel and keeps one key on uncertain retry', async () => {
    const f = fixture(); f.fill(); f.create.mockRejectedValueOnce(new Error('lost response')); await f.controller.save();
    f.controller.edit('locality', 'Other'); f.controller.cancel(); expect(f.controller.open).toBe(true);
    const pending = deferred(); f.create.mockReturnValueOnce(pending.promise); const retry = f.controller.save(); await f.controller.save();
    expect(f.create).toHaveBeenCalledTimes(2); expect(f.create.mock.calls[0][0]).toEqual(f.create.mock.calls[1][0]); expect(f.requestKey).toHaveBeenCalledTimes(1);
    pending.resolve(result()); await retry; expect(f.created).toHaveBeenCalledTimes(1); expect(f.controller.open).toBe(false);
  });
  it('drops late results after navigation/account change', async () => {
    const f = fixture(); f.fill(); const pending = deferred(); f.create.mockReturnValueOnce(pending.promise); const task = f.controller.save(); f.current.mockReturnValue(false); pending.resolve(result()); await task;
    expect(f.created).not.toHaveBeenCalled();
  });
  it('known validation/permission failure is editable and never prints raw errors', async () => {
    const f = fixture(); f.fill(); f.create.mockRejectedValueOnce(new CrmMutationError('INVALID_INPUT', 'This customer is unavailable or your access changed. Refresh before creating a service location.')); await f.controller.save();
    expect(f.controller.phase).toBe('editing'); expect(f.controller.message).toContain('access changed'); f.controller.cancel(); expect(f.controller.open).toBe(false);
  });
  it('refuses create without a current authorized view', async () => {
    const f = fixture(); f.current.mockReturnValue(false); f.fill(); await f.controller.save(); expect(f.create).not.toHaveBeenCalled(); expect(f.controller.open).toBe(false);
  });
});
