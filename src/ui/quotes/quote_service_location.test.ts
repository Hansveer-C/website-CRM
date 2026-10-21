import { describe, expect, it, vi } from 'vitest';
import { CrmMutationError } from '../../crm_production_mutations';
import { QuoteServiceLocationController, renderQuoteServiceLocation, applyServiceLocationPreviewRefresh, type LocationData } from './quote_service_location';
import { renderQuotePreviewContent } from './quotes';
const quote = { id: 'q1', user_id: 'u1', contact_id: 'c1', status: 'sent' as const, revision: 1, total_amount: 25, created_at: '2026-10-21' };
const location = { id: 'p1', contact_id: 'c1', label: '<script>alert(1)</script>', service_address_line1: '10 Service Lane', service_address_line2: null, locality: 'Town', administrative_area: null, postal_code: null, country_code: 'CA' };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function fixture(data: LocationData = { quote: { ...quote }, locations: [{ ...location }] }) {
  const load = vi.fn().mockResolvedValue(data);
  const save = vi.fn().mockResolvedValue({ quoteId: 'q1', propertyId: 'p1', revision: 2, replayed: false });
  const current = vi.fn(() => true), updateQuote = vi.fn(), requestKey = vi.fn(() => 'stable-key');
  const controller = new QuoteServiceLocationController('q1', 'c1', 'u1', { load, save, current, updateQuote, requestKey });
  return { controller, load, save, current, updateQuote, requestKey };
}
describe('estimate service-location UI', () => {
  it('main preview integration renders refreshed quote and items before exposing acceptance revision', () => {
    const quotes = [{ ...quote }];
    const item = { id: 'i1', user_id: 'u1', quote_id: 'q1', service_name: 'Original work', description: '', quantity: 1, unit_price: 25, total: 25, tier: 'basic' as const, order_index: 0 };
    const items = [item];
    let html = renderQuotePreviewContent({ userId: 'u1', quoteId: 'q1', quotes, contacts: [], items, editable: false });
    expect(html).toContain('Original work');
    applyServiceLocationPreviewRefresh(quotes[0], { ...quote, revision: 2, total_amount: 100 }, [{ ...item, service_name: 'Newly priced work', unit_price: 100, total: 100 }], quotes, items, () => {
      html = renderQuotePreviewContent({ userId: 'u1', quoteId: 'q1', quotes, contacts: [], items, editable: false });
      expect(quotes[0].revision).toBe(2); expect(html).toContain('Newly priced work'); expect(html).toContain('$100'); expect(html).not.toContain('Original work');
    });
    // This is the same collection the main acceptance handler reads after synchronous render.
    expect(quotes[0].revision).toBe(2); expect(html).toContain('$100');
  });
  it('blocks acceptance during unsaved selection, uncertain save and loading', async () => {
    const f = fixture(); expect(f.controller.acceptanceBlocked).toBe(true); await f.controller.load(); expect(f.controller.acceptanceBlocked).toBe(false);
    f.controller.select('p1'); expect(f.controller.acceptanceBlocked).toBe(true); f.controller.cancel(); expect(f.controller.acceptanceBlocked).toBe(false);
    f.controller.select('p1'); f.save.mockRejectedValueOnce(new Error('timeout')); await f.controller.save(); expect(f.controller.acceptanceBlocked).toBe(true);
  });
  it('main preview integration denies foreign item substitution before changing revision', () => {
    const quotes = [{ ...quote }]; const render = vi.fn();
    expect(() => applyServiceLocationPreviewRefresh(quote, { ...quote, revision: 2 }, [{ quote_id: 'q1', user_id: 'foreign' } as any], quotes, [], render)).toThrow();
    expect(quotes[0].revision).toBe(1); expect(render).not.toHaveBeenCalled();
  });
  it('shows loading, empty and load-error retry states', async () => {
    const f = fixture({ quote, locations: [] });
    expect(renderQuoteServiceLocation(f.controller)).toContain('Loading service location');
    await f.controller.load(); expect(renderQuoteServiceLocation(f.controller)).toContain('No service locations');
    f.load.mockRejectedValueOnce(new Error('secret failure')); await f.controller.load();
    expect(renderQuoteServiceLocation(f.controller)).toContain('could not be loaded');
    expect(renderQuoteServiceLocation(f.controller)).not.toContain('secret failure');
    await f.controller.load(); expect(f.controller.phase).toBe('ready');
  });
  it.each(['user_id', 'contact_id', 'id'] as const)('fails closed when refreshed quote changes %s', async field => {
    const f = fixture({ quote: { ...quote, [field]: 'foreign' }, locations: [location] }); await f.controller.load();
    expect(f.controller.phase).toBe('error'); expect(f.updateQuote).not.toHaveBeenCalled();
  });
  it('filters other customers and escapes option text', async () => {
    const f = fixture({ quote, locations: [location, { ...location, id: 'foreign', contact_id: 'c2', label: 'FOREIGN' }] }); await f.controller.load();
    const html = renderQuoteServiceLocation(f.controller); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('FOREIGN');
    f.controller.select('foreign'); await f.controller.save(); expect(f.save).not.toHaveBeenCalled();
  });
  it('cancels unsaved selection without writes', async () => {
    const f = fixture(); await f.controller.load(); f.controller.select('p1'); f.controller.cancel();
    expect(f.controller.selected).toBe(''); expect(f.save).not.toHaveBeenCalled();
  });
  it('deduplicates repeated clicks and reloads authoritative state after success', async () => {
    const f = fixture(); await f.controller.load(); f.controller.select('p1');
    const pending = deferred<unknown>(); f.save.mockReturnValueOnce(pending.promise);
    const first = f.controller.save(); await f.controller.save(); f.controller.select('other'); f.controller.cancel(); await f.controller.load();
    expect(f.save).toHaveBeenCalledTimes(1); expect(f.controller.selected).toBe('p1'); expect(f.load).toHaveBeenCalledTimes(1);
    f.load.mockResolvedValueOnce({ quote: { ...quote, property_id: 'p1', revision: 2 }, locations: [location] }); pending.resolve({}); await first;
    expect(f.controller.data?.quote.revision).toBe(2); expect(f.controller.retryPending).toBe(false);
  });
  it('retains request and selection across uncertain failure and retries', async () => {
    const f = fixture(); await f.controller.load(); f.controller.select('p1'); f.save.mockRejectedValueOnce(new Error('timeout'));
    await f.controller.save(); f.controller.select('other'); f.controller.cancel();
    expect(f.controller.selected).toBe('p1'); expect(renderQuoteServiceLocation(f.controller)).toContain('Retry save');
    await f.controller.save(); expect(f.save.mock.calls[1][0]).toEqual(f.save.mock.calls[0][0]); expect(f.requestKey).toHaveBeenCalledTimes(1);
  });
  it('requires refresh after stale conflict and adopts new revision', async () => {
    const f = fixture(); await f.controller.load(); f.controller.select('p1'); f.save.mockRejectedValueOnce(new CrmMutationError('CONFLICT'));
    await f.controller.save(); await f.controller.save(); expect(f.save).toHaveBeenCalledTimes(1); expect(f.controller.phase).toBe('conflict');
    f.load.mockResolvedValueOnce({ quote: { ...quote, revision: 4 }, locations: [location] }); await f.controller.load(); f.controller.select('p1'); await f.controller.save();
    expect(f.save.mock.calls[1][0].expectedRevision).toBe(4);
  });
  it('never rolls state back from a historical replay response', async () => {
    const f = fixture(); await f.controller.load(); f.controller.select('p1');
    f.save.mockResolvedValueOnce({ revision: 2, replayed: true }); f.load.mockResolvedValueOnce({ quote: { ...quote, revision: 8, property_id: 'p2' }, locations: [location] });
    await f.controller.save(); expect(f.controller.data?.quote.revision).toBe(8); expect(f.controller.selected).toBe('p2');
  });
  it('discards late loads after navigation or account switch', async () => {
    const f = fixture(); const pending = deferred<LocationData>(); f.load.mockReturnValueOnce(pending.promise); const task = f.controller.load();
    f.current.mockReturnValue(false); pending.resolve({ quote, locations: [location] }); await task; expect(f.updateQuote).not.toHaveBeenCalled();
  });
  it('discards late saves after navigation without updating another estimate', async () => {
    const f = fixture(); await f.controller.load(); const pending = deferred<unknown>(); f.save.mockReturnValueOnce(pending.promise); f.controller.select('p1'); const task = f.controller.save();
    f.current.mockReturnValue(false); pending.resolve({}); await task; expect(f.load).toHaveBeenCalledTimes(1); expect(f.updateQuote).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { service_location_status: 'unassigned', service_location: null }])('shows historical and explicit unassigned acceptance distinctly without a selector', async snapshot => {
    const f = fixture({ quote: { ...quote, status: 'approved' }, locations: [location], snapshot }); await f.controller.load();
    const html = renderQuoteServiceLocation(f.controller); expect(html).toContain(Object.keys(snapshot).length ? 'No service location was assigned' : 'older acceptance'); expect(html).not.toContain('<select'); await f.controller.save(); expect(f.save).not.toHaveBeenCalled();
  });
  it('shows only frozen accepted address, never current customer location', async () => {
    const snapshot = { service_location_status: 'recorded', service_location: { ...location, id: undefined, contact_id: undefined, schema_version: 1, property_id: 'aa200000-0000-4000-8000-000000000001', service_address_line1: 'Frozen Address' } };
    const f = fixture({ quote: { ...quote, status: 'approved' }, locations: [location], snapshot }); await f.controller.load(); const html = renderQuoteServiceLocation(f.controller);
    expect(html).toContain('Frozen Address'); expect(html).not.toContain('10 Service Lane'); expect(html).not.toContain('<select');
  });
  it('fails closed on malformed accepted evidence', async () => {
    const f = fixture({ quote: { ...quote, status: 'approved' }, locations: [], snapshot: null }); await f.controller.load(); expect(f.controller.phase).toBe('error');
  });
});
