import { describe, expect, it, vi } from 'vitest';
import { CrmProductionHydrator, type CrmProductionCollections } from './crm_production_hydration';

function collections(seed = false): CrmProductionCollections {
  return {
    contacts: seed ? [{ id: 'fixture', user_id: 'system' } as never] : [], opportunities: [], activities: [],
    quotes: [], quote_items: [], invoices: []
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

const ownerRows = {
  contacts: [{ id: 'c1', user_id: 'user-1' }],
  opportunities: [{ id: 'o1', user_id: 'user-1' }],
  activities: [{ id: 'a1', user_id: 'user-1' }],
  quotes: [{ id: 'q1', user_id: 'user-1' }],
  quote_items: [{ id: 'qi1', user_id: 'user-1' }],
  invoices: [{ id: 'i1', user_id: 'user-1' }]
};

describe('CrmProductionHydrator', () => {
  it('hydrates every supported CRM entity and never queries unavailable invoices', async () => {
    const target = collections(true);
    const source = client(ownerRows);
    const hydrator = new CrmProductionHydrator(async () => source, target);
    expect((await hydrator.hydrateAuthenticatedUser('user-1')).status).toBe('ready');
    expect(Object.fromEntries(Object.entries(target).map(([name, rows]) => [name, rows.map((row: { id: string }) => row.id)]))).toEqual({
      contacts: ['c1'], opportunities: ['o1'], activities: ['a1'], quotes: ['q1'], quote_items: ['qi1'], invoices: []
    });
    expect(source.queries).toHaveLength(5);
    expect(source.from).not.toHaveBeenCalledWith('invoices');
    expect(source.queries.every(([, column, value]) => column === 'user_id' && value === 'user-1')).toBe(true);
  });

  it('rejects cross-owner rows even if a client returns them', async () => {
    const target = collections();
    const source = client({ contacts: [...ownerRows.contacts, { id: 'c2', user_id: 'user-2' }] });
    await new CrmProductionHydrator(async () => source, target).hydrateAuthenticatedUser('user-1');
    expect(target.contacts.map(row => row.id)).toEqual(['c1']);
  });

  it('distinguishes a successful zero state from a load failure', async () => {
    const emptyTarget = collections();
    const empty = new CrmProductionHydrator(async () => client({}), emptyTarget);
    expect(await empty.hydrateAuthenticatedUser('user-1')).toMatchObject({ status: 'ready' });
    expect(Object.values(emptyTarget).every(rows => rows.length === 0)).toBe(true);

    const failedTarget = collections();
    const failed = new CrmProductionHydrator(async () => client({}, ['quotes']), failedTarget);
    expect(await failed.hydrateAuthenticatedUser('user-1')).toMatchObject({
      status: 'error', entities: { quotes: 'error', contacts: 'ready' }
    });
  });

  it('reports ready when all five supported entities load and leaves invoices empty', async () => {
    const target = collections();
    target.invoices.push({ id: 'stale', user_id: 'user-0' } as never);
    const source = client(ownerRows, ['invoices']);
    const state = await new CrmProductionHydrator(async () => source, target).hydrateAuthenticatedUser('user-1');
    expect(state.status).toBe('ready');
    expect(Object.values(state.entities)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
    expect(target.invoices).toEqual([]);
    expect(source.from).not.toHaveBeenCalledWith('invoices');
  });

  it('clears on logout, isolates account switches, and never duplicates repeated hydration', async () => {
    const target = collections();
    const source = client({
      ...ownerRows,
      contacts: [{ id: 'c1', user_id: 'user-1' }, { id: 'c2', user_id: 'user-2' }]
    });
    const hydrator = new CrmProductionHydrator(async () => source, target);
    await hydrator.hydrateAuthenticatedUser('user-1');
    await hydrator.hydrateAuthenticatedUser('user-1', true);
    expect(target.contacts.map(row => row.id)).toEqual(['c1']);
    hydrator.clear();
    expect(Object.values(target).every(rows => rows.length === 0)).toBe(true);
    await hydrator.hydrateAuthenticatedUser('user-2');
    expect(target.contacts.map(row => row.id)).toEqual(['c2']);
  });

  it('restores the same data in a fresh runtime and keeps fixtures out of production hydration', async () => {
    const first = collections(true);
    await new CrmProductionHydrator(async () => client(ownerRows), first).hydrateAuthenticatedUser('user-1');
    const refreshed = collections(true);
    await new CrmProductionHydrator(async () => client(ownerRows), refreshed).hydrateAuthenticatedUser('user-1');
    expect(refreshed).toEqual(first);
    expect(refreshed.contacts.some(row => row.id === 'fixture')).toBe(false);
  });

  it('does not alter local fixture state unless production hydration is invoked', () => {
    const local = collections(true);
    new CrmProductionHydrator(async () => client({}), local);
    expect(local.contacts.map(row => row.id)).toEqual(['fixture']);
  });
});
