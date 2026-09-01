import { describe, expect, it, vi } from 'vitest';
import { CrmProductionHydrator, type CrmProductionCollections } from './crm_production_hydration';

function collections(seed = false): CrmProductionCollections {
  return {
    contacts: seed ? [{ id: 'fixture', user_id: 'system' } as never] : [],
    opportunities: [], activities: [], quotes: [], quote_items: [], invoices: [], invoice_items: []
  };
}

function client(rows: Partial<Record<keyof CrmProductionCollections, unknown[]>>, failures: string[] = []) {
  const queries: Array<[string, string, string]> = [];
  return {
    queries,
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(async (column: string, value: string) => {
          queries.push([table, column, value]);
          return failures.includes(table)
            ? { data: null, error: { code: 'PGRST_ERROR' } }
            : { data: rows[table as keyof CrmProductionCollections] ?? [], error: null };
        })
      }))
    }))
  };
}

const durableInvoice = {
  id: 'invoice-1', user_id: 'user-1', contact_id: 'contact-1', quote_id: 'quote-1',
  quote_acceptance_id: 'acceptance-1', source_quote_revision: 3, invoice_number: 42,
  status: 'issued', currency: 'USD', total_amount: 250, customer_name: 'Historical Customer',
  customer_email: null, customer_phone: null, billing_address: '10 Historic Way',
  issued_at: '2026-08-21T10:00:00.000Z', due_at: '2026-09-20T10:00:00.000Z',
  origin: 'accepted_quote', created_at: '2026-08-21T10:00:00.000Z'
};
const durableInvoiceItem = {
  id: 'invoice-item-1', user_id: 'user-1', invoice_id: 'invoice-1',
  source_quote_item_order_index: 0, service_name: 'Exterior wash', description: 'Single visit',
  quantity: 2, unit_price: 125, line_total: 250, created_at: '2026-08-21T10:00:00.000Z'
};
const ownerRows = {
  contacts: [{ id: 'contact-1', user_id: 'user-1', name: 'Current Customer' }],
  opportunities: [{ id: 'o1', user_id: 'user-1' }], activities: [{ id: 'a1', user_id: 'user-1' }],
  quotes: [{ id: 'quote-1', user_id: 'user-1' }], quote_items: [{ id: 'qi1', user_id: 'user-1' }],
  invoices: [durableInvoice], invoice_items: [durableInvoiceItem]
};

describe('CrmProductionHydrator', () => {
  it('hydrates durable invoices and items through explicit field-whitelist queries', async () => {
    const target = collections(true);
    const source = client(ownerRows);
    const state = await new CrmProductionHydrator(async () => source, target).hydrateAuthenticatedUser('user-1');
    expect(state.status).toBe('ready');
    expect(target.contacts.map(row => row.id)).toEqual(['contact-1']);
    expect(target.invoices).toEqual([expect.objectContaining({
      id: 'invoice-1', customer_name: 'Historical Customer', billing_address: '10 Historic Way'
    })]);
    expect(target.invoice_items.map(row => row.id)).toEqual(['invoice-item-1']);
    expect(source.queries).toHaveLength(7);
    expect(source.queries.every(([, column, value]) => column === 'user_id' && value === 'user-1')).toBe(true);
    expect(source.queries.find(([table]) => table === 'invoices')?.[1]).not.toBe('*');
    expect(source.queries.find(([table]) => table === 'invoice_items')?.[1]).not.toBe('*');
  });

  it('rejects cross-owner rows even if a client returns them', async () => {
    const target = collections();
    const source = client({
      contacts: [...ownerRows.contacts, { id: 'c2', user_id: 'user-2' }],
      invoices: [...ownerRows.invoices, { ...durableInvoice, id: 'invoice-2', user_id: 'user-2' }],
      invoice_items: [...ownerRows.invoice_items, { ...durableInvoiceItem, id: 'invoice-item-2', user_id: 'user-2', invoice_id: 'invoice-2' }]
    });
    await new CrmProductionHydrator(async () => source, target).hydrateAuthenticatedUser('user-1');
    expect(target.contacts.map(row => row.id)).toEqual(['contact-1']);
    expect(target.invoices.map(row => row.id)).toEqual(['invoice-1']);
    expect(target.invoice_items.map(row => row.id)).toEqual(['invoice-item-1']);
  });

  it('distinguishes a successful zero state from a load failure', async () => {
    const emptyTarget = collections();
    expect((await new CrmProductionHydrator(async () => client({}), emptyTarget).hydrateAuthenticatedUser('user-1')).status).toBe('ready');
    expect(Object.values(emptyTarget).every(rows => rows.length === 0)).toBe(true);

    const failedTarget = collections();
    const state = await new CrmProductionHydrator(async () => client({}, ['invoices']), failedTarget)
      .hydrateAuthenticatedUser('user-1');
    expect(state).toMatchObject({ status: 'error', entities: { invoices: 'error', contacts: 'ready' } });
    expect(failedTarget.invoices).toEqual([]);
  });

  it('fails closed for malformed durable data or an item not owned by a hydrated invoice', async () => {
    const malformed = await new CrmProductionHydrator(async () => client({
      ...ownerRows, invoices: [{ ...durableInvoice, total_amount: '250' }]
    }), collections()).hydrateAuthenticatedUser('user-1');
    expect(malformed.entities.invoices).toBe('error');
    expect(malformed.entities.invoice_items).toBe('error');

    const orphan = await new CrmProductionHydrator(async () => client({
      ...ownerRows, invoice_items: [{ ...durableInvoiceItem, invoice_id: 'not-hydrated' }]
    }), collections()).hydrateAuthenticatedUser('user-1');
    expect(orphan.entities).toMatchObject({ invoices: 'ready', invoice_items: 'error' });
  });

  it('uses deterministic invoice and invoice-item ordering', async () => {
    const target = collections();
    await new CrmProductionHydrator(async () => client({
      ...ownerRows,
      invoices: [durableInvoice, { ...durableInvoice, id: 'invoice-2', invoice_number: 43, issued_at: '2026-08-22T10:00:00.000Z' }],
      invoice_items: [{ ...durableInvoiceItem, id: 'item-later', source_quote_item_order_index: 1 }, durableInvoiceItem]
    }), target).hydrateAuthenticatedUser('user-1');
    expect(target.invoices.map(row => row.id)).toEqual(['invoice-2', 'invoice-1']);
    expect(target.invoice_items.map(row => row.id)).toEqual(['invoice-item-1', 'item-later']);
  });

  it('clears on logout, isolates account switches, and never duplicates repeated hydration', async () => {
    const target = collections();
    const source = client({
      ...ownerRows,
      contacts: [{ id: 'c1', user_id: 'user-1' }, { id: 'c2', user_id: 'user-2' }],
      invoices: [durableInvoice, { ...durableInvoice, id: 'invoice-2', user_id: 'user-2' }],
      invoice_items: [durableInvoiceItem, { ...durableInvoiceItem, id: 'invoice-item-2', user_id: 'user-2', invoice_id: 'invoice-2' }]
    });
    const hydrator = new CrmProductionHydrator(async () => source, target);
    await hydrator.hydrateAuthenticatedUser('user-1');
    await hydrator.hydrateAuthenticatedUser('user-1', true);
    expect(target.invoices.map(row => row.id)).toEqual(['invoice-1']);
    hydrator.clear();
    expect(Object.values(target).every(rows => rows.length === 0)).toBe(true);
    await hydrator.hydrateAuthenticatedUser('user-2');
    expect(target.contacts.map(row => row.id)).toEqual(['c2']);
    expect(target.invoices.map(row => row.id)).toEqual(['invoice-2']);
  });

  it('keeps fixtures out of production hydration and leaves local fixtures intact until invoked', async () => {
    const hydrated = collections(true);
    await new CrmProductionHydrator(async () => client(ownerRows), hydrated).hydrateAuthenticatedUser('user-1');
    expect(hydrated.contacts.some(row => row.id === 'fixture')).toBe(false);
    const local = collections(true);
    new CrmProductionHydrator(async () => client({}), local);
    expect(local.contacts.map(row => row.id)).toEqual(['fixture']);
  });
});
