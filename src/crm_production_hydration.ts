import type { Activity, Contact, Invoice, Opportunity, Quote, QuoteItem } from './types';

export type CrmEntityName = 'contacts' | 'opportunities' | 'activities' | 'quotes' | 'quote_items' | 'invoices';
export type CrmEntityLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface CrmProductionCollections {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  quotes: Quote[];
  quote_items: QuoteItem[];
  invoices: Invoice[];
}

export interface CrmProductionHydrationState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  userId?: string;
  entities: Record<CrmEntityName, CrmEntityLoadState>;
}

interface CrmQueryResult {
  data: unknown[] | null;
  error: unknown | null;
}

export interface CrmHydrationClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<CrmQueryResult>;
    };
  };
}

const ENTITY_NAMES: readonly CrmEntityName[] = [
  'contacts', 'opportunities', 'activities', 'quotes', 'quote_items', 'invoices'
];

function entityStates(value: CrmEntityLoadState): Record<CrmEntityName, CrmEntityLoadState> {
  return Object.fromEntries(ENTITY_NAMES.map(name => [name, value])) as Record<CrmEntityName, CrmEntityLoadState>;
}

function clearCollections(collections: CrmProductionCollections): void {
  for (const name of ENTITY_NAMES) collections[name].splice(0);
}

function isOwnedRow(value: unknown, userId: string): value is { user_id: string } {
  return typeof value === 'object' && value !== null && (value as { user_id?: unknown }).user_id === userId;
}

export class CrmProductionHydrator {
  state: CrmProductionHydrationState = { status: 'idle', entities: entityStates('idle') };
  private generation = 0;
  private inFlight: Promise<CrmProductionHydrationState> | null = null;

  constructor(
    private readonly getClient: () => Promise<CrmHydrationClient | null>,
    private readonly collections: CrmProductionCollections
  ) {}

  clear(): void {
    this.generation += 1;
    this.inFlight = null;
    clearCollections(this.collections);
    this.state = { status: 'idle', entities: entityStates('idle') };
  }

  async hydrateAuthenticatedUser(userIdInput: string, force = false): Promise<CrmProductionHydrationState> {
    const userId = userIdInput.trim();
    if (!userId) {
      this.clear();
      this.state = { status: 'error', entities: entityStates('error') };
      return this.state;
    }
    if (!force && this.state.userId === userId && this.state.status !== 'idle') {
      return this.inFlight ?? this.state;
    }
    this.clear();
    const generation = this.generation;
    this.state = { status: 'loading', userId, entities: entityStates('loading') };
    const request = this.load(userId, generation);
    this.inFlight = request;
    return request;
  }

  private async load(userId: string, generation: number): Promise<CrmProductionHydrationState> {
    const client = await this.getClient();
    if (!client || generation !== this.generation) {
      if (generation === this.generation) this.state = { status: 'error', userId, entities: entityStates('error') };
      return this.state;
    }
    const results = await Promise.all(ENTITY_NAMES.map(async name => {
      try {
        const result = await client.from(name).select('*').eq('user_id', userId);
        if (result.error) return { name, status: 'error' as const, rows: [] };
        const rows = (result.data ?? []).filter(row => isOwnedRow(row, userId));
        return { name, status: 'ready' as const, rows };
      } catch {
        return { name, status: 'error' as const, rows: [] };
      }
    }));
    if (generation !== this.generation) return this.state;
    const entities = entityStates('idle');
    for (const result of results) {
      entities[result.name] = result.status;
      this.collections[result.name].splice(0);
      if (result.status === 'ready') this.collections[result.name].push(...result.rows as never[]);
    }
    this.inFlight = null;
    this.state = {
      status: results.every(result => result.status === 'ready') ? 'ready' : 'error',
      userId,
      entities
    };
    return this.state;
  }
}
