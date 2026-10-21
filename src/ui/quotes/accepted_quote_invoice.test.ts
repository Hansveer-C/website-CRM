import { describe, expect, it, vi } from 'vitest';
import { CrmMutationError, createInvoiceFromAcceptedQuote } from '../../crm_production_mutations';
import { AcceptedQuoteInvoiceController, loadAcceptedInvoiceEvidence, parseAcceptedInvoiceEvidence, mountAcceptedQuoteInvoice } from './accepted_quote_invoice';
const q = 'bb100000-0000-4000-8000-000000000001', invoiceId = 'bb200000-0000-4000-8000-000000000001';
const line = { service_name: '<script>Accepted work</script>', description: '', quantity: 1, unit_price: 25, line_total: 25, order_index: 2, tier: 'premium' };
const raw = () => ({ quote_id: q, accepted_revision: 3, current_revision: 4, eligible: true, selected_tier: 'premium', currency: 'USD', total_amount: 25, snapshot_total_amount: 25, items: [{ ...line }], invoice_id: null });
const result = () => ({ invoice: { id: invoiceId, user_id: 'actor', quote_id: q, source_quote_revision: 3, currency: 'USD', total_amount: 25, status: 'issued', invoice_number: 1 }, items: [{ ...line, user_id: 'actor', invoice_id: invoiceId, source_quote_item_order_index: 2 }], replayed: false });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const load = vi.fn().mockResolvedValue(parseAcceptedInvoiceEvidence(raw(), q)), create = vi.fn().mockResolvedValue(result()), view = vi.fn().mockResolvedValue(undefined), current = vi.fn(() => true), requestKey = vi.fn(() => 'stable-key');
  return { load, create, view, current, requestKey, controller: new AcceptedQuoteInvoiceController(q, 'actor', { load, create, view, current, requestKey }) };
}
describe('accepted invoice evidence and production boundary', () => {
  it('uses authoritative accepted revision and selected lines rather than current revision', () => {
    const evidence = parseAcceptedInvoiceEvidence(raw(), q); expect(evidence.acceptedRevision).toBe(3); expect(evidence.currentRevision).toBe(4); expect(evidence.items).toHaveLength(1);
  });
  it.each([
    { accepted_revision: 4 }, { eligible: false }, { selected_tier: 'custom' }, { currency: 'CAD' }, { total_amount: 26 }, { snapshot_total_amount: 30 }, { items: [] }, { invoice_id: 'foreign' }, { user_id: 'leaked' }, { total_amount: Infinity }, { items: [{ ...line, tier: 'basic' }] }, { items: [{ ...line, line_total: 30 }] }, { items: [{ ...line, quantity: -1 }] }
  ])('rejects invalid or ambiguous evidence %j', patch => {
    expect(() => parseAcceptedInvoiceEvidence({ ...raw(), ...patch }, q)).toThrow(CrmMutationError);
  });
  it('loads only narrow evidence and translates permission denial without raw details', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: raw(), error: null }); await loadAcceptedInvoiceEvidence({ rpc }, q);
    expect(rpc).toHaveBeenCalledWith('read_crm_accepted_invoice_evidence', { p_quote_id: q });
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret SQL' } });
    await expect(loadAcceptedInvoiceEvidence({ rpc }, q)).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'This accepted quote is unavailable for this account.' });
    await expect(createInvoiceFromAcceptedQuote({ rpc }, { quoteId: q, acceptedQuoteRevision: 3, requestKey: 'key' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

});
describe('RPC-backed conversion controller', () => {
  it('does not start reads, writes or navigation from a stale account or detached preview', async () => {
    const f=fixture();f.current.mockReturnValue(false);await f.controller.load();expect(f.load).not.toHaveBeenCalled();
    f.current.mockReturnValue(true);await f.controller.load();f.current.mockReturnValue(false);await f.controller.create();expect(f.create).not.toHaveBeenCalled();
    f.current.mockReturnValue(true);await f.controller.create();f.current.mockReturnValue(false);await f.controller.view();expect(f.view).not.toHaveBeenCalled();
  });
  it('escapes accepted scope and errors in the ordinary invoice panel', async () => {
    const f=fixture();await f.controller.load();f.controller.message='<img src=x onerror=alert(1)>';
    const root={innerHTML:'',querySelector:()=>null};mountAcceptedQuoteInvoice(root as unknown as HTMLElement,f.controller);
    expect(root.innerHTML).toContain('&lt;script&gt;Accepted work&lt;/script&gt;');expect(root.innerHTML).toContain('&lt;img');expect(root.innerHTML).not.toContain('<img');expect(root.innerHTML).toContain('Create invoice');
  });

  it('suppresses double clicks and creates using accepted revision and stable request only', async () => {
    const f = fixture(); await f.controller.load(); const pending = deferred<ReturnType<typeof result>>(); f.create.mockReturnValueOnce(pending.promise);
    const first = f.controller.create(); await f.controller.create(); await f.controller.load();
    expect(f.create).toHaveBeenCalledTimes(1); expect(f.create.mock.calls[0][0]).toEqual({ quoteId: q, acceptedQuoteRevision: 3, requestKey: 'stable-key' });
    pending.resolve(result()); await first; expect(f.controller.phase).toBe('success'); await f.controller.create(); expect(f.create).toHaveBeenCalledTimes(1);
    await f.controller.view(); expect(f.view).toHaveBeenCalledWith(invoiceId);
  });
  it('retains the same request after an uncertain write and succeeds on replay', async () => {
    const f = fixture(); await f.controller.load(); f.create.mockRejectedValueOnce(new Error('lost response')); await f.controller.create(); expect(f.controller.retryPending).toBe(true);
    await f.controller.create(); expect(f.create.mock.calls[1][0]).toEqual(f.create.mock.calls[0][0]); expect(f.requestKey).toHaveBeenCalledTimes(1); expect(f.controller.phase).toBe('success');
  });
  it.each(['FORBIDDEN','CONFLICT','INVALID_INPUT'] as const)('blocks automatic retry after %s', async code => {
    const f = fixture(); await f.controller.load(); f.create.mockRejectedValueOnce(new CrmMutationError(code)); await f.controller.create(); await f.controller.create(); expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.controller.phase).toBe(code === 'FORBIDDEN' ? 'permission' : code === 'CONFLICT' ? 'conflict' : 'error'); await f.controller.load(); expect(f.controller.phase).toBe('ready');
  });
  it('never issues from a changed quote or reissues an existing invoice', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce(parseAcceptedInvoiceEvidence({ ...raw(), current_revision: 5, eligible: false }, q)); await f.controller.load(); await f.controller.create(); expect(f.create).not.toHaveBeenCalled();
    f.load.mockResolvedValueOnce(parseAcceptedInvoiceEvidence({ ...raw(), invoice_id: invoiceId }, q)); await f.controller.load(); await f.controller.create(); expect(f.create).not.toHaveBeenCalled(); await f.controller.view(); expect(f.view).toHaveBeenCalledWith(invoiceId);
  });
  it('discards results after leaving the estimate or account', async () => {
    const f = fixture(); const pending = deferred<any>(); f.load.mockReturnValueOnce(pending.promise); const task = f.controller.load(); f.current.mockReturnValue(false); pending.resolve(parseAcceptedInvoiceEvidence(raw(), q)); await task; expect(f.controller.evidence).toBeUndefined();
    f.current.mockReturnValue(true); await f.controller.load(); const saving = deferred<any>(); f.create.mockReturnValueOnce(saving.promise); const saveTask = f.controller.create(); f.current.mockReturnValue(false); saving.resolve(result()); await saveTask; expect(f.controller.invoiceId).toBeUndefined(); expect(f.view).not.toHaveBeenCalled();
  });
  it.each(['user_id','quote_id','source_quote_revision','total_amount'] as const)('does not trust mismatched invoice %s', async field => {
    const f = fixture(); await f.controller.load(); const response = result(); (response.invoice as any)[field] = 'foreign'; f.create.mockResolvedValueOnce(response); await f.controller.create(); expect(f.controller.phase).toBe('ready'); expect(f.controller.invoiceId).toBeUndefined(); expect(f.controller.retryPending).toBe(true);
  });
  it('rejects changed issued lines and preserves success if navigation fails', async () => {
    const f = fixture(); await f.controller.load(); const response = result(); response.items[0].line_total = 999; f.create.mockResolvedValueOnce(response); await f.controller.create(); expect(f.controller.invoiceId).toBeUndefined();
    await f.controller.create(); f.view.mockRejectedValueOnce(new Error('offline')); await f.controller.view(); expect(f.controller.phase).toBe('success'); expect(f.controller.message).toContain('saved but could not be opened');
  });
  it('reports loading errors and permission failures without creating', async () => {
    const f = fixture(); f.load.mockRejectedValueOnce(new Error('raw details')); await f.controller.load(); expect(f.controller.phase).toBe('error'); expect(f.controller.message).not.toContain('raw details');
    f.load.mockRejectedValueOnce(new CrmMutationError('FORBIDDEN')); await f.controller.load(); expect(f.controller.phase).toBe('permission'); await f.controller.create(); expect(f.create).not.toHaveBeenCalled();
  });
});
