import type {
  Activity,
  Contact,
  DurableInvoice,
  DurableInvoiceItem,
  Opportunity,
  Quote,
  QuoteItem
} from './types';

export type CrmEntityName =
  | 'contacts'
  | 'opportunities'
  | 'activities'
  | 'quotes'
  | 'quote_items'
  | 'invoices'
  | 'invoice_items';
export type CrmEntityLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface CrmProductionCollections {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  quotes: Quote[];
  quote_items: QuoteItem[];
  invoices: DurableInvoice[];
  invoice_items: DurableInvoiceItem[];
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

const SUPPORTED_ENTITY_NAMES: readonly CrmEntityName[] = [
  'contacts', 'opportunities', 'activities', 'quotes', 'quote_items', 'invoices', 'invoice_items'
];

const INVOICE_COLUMNS = [
  'id', 'user_id', 'contact_id', 'quote_id', 'quote_acceptance_id', 'source_quote_revision',
  'invoice_number', 'status', 'currency', 'total_amount', 'customer_name', 'customer_email',
  'customer_phone', 'billing_address', 'issued_at', 'due_at', 'origin', 'created_at'
].join(',');

const INVOICE_ITEM_COLUMNS = [
  'id', 'user_id', 'invoice_id', 'source_quote_item_order_index', 'service_name', 'description',
  'quantity', 'unit_price', 'line_total', 'created_at'
].join(',');

function entityStates(value: CrmEntityLoadState): Record<CrmEntityName, CrmEntityLoadState> {
  return Object.fromEntries(SUPPORTED_ENTITY_NAMES.map(name => [name, value])) as Record<CrmEntityName, CrmEntityLoadState>;
}

function clearCollections(collections: CrmProductionCollections): void {
  for (const name of SUPPORTED_ENTITY_NAMES) collections[name].splice(0);
}

function isOwnedRow(value: unknown, userId: string): value is { user_id: string } {
  return typeof value === 'object' && value !== null && (value as { user_id?: unknown }).user_id === userId;
}

function record(value: unknown, entity: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed ${entity} row`);
  }
  return value as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, field: string, entity: string): string {
  const value = row[field];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Malformed ${entity}.${field}`);
  return value;
}

function optionalString(row: Record<string, unknown>, field: string, entity: string): string | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`Malformed ${entity}.${field}`);
  return value;
}

function finiteNumber(row: Record<string, unknown>, field: string, entity: string, minimum = 0): number {
  const value = row[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`Malformed ${entity}.${field}`);
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string, entity: string, minimum = 0): number {
  const value = finiteNumber(row, field, entity, minimum);
  if (!Number.isInteger(value)) throw new Error(`Malformed ${entity}.${field}`);
  return value;
}

function timestamp(row: Record<string, unknown>, field: string, entity: string): string {
  const value = requiredString(row, field, entity);
  if (Number.isNaN(Date.parse(value))) throw new Error(`Malformed ${entity}.${field}`);
  return value;
}

function mapInvoice(value: unknown, userId: string): DurableInvoice {
  const row = record(value, 'invoice');
  if (requiredString(row, 'user_id', 'invoice') !== userId) throw new Error('Malformed invoice.user_id');
  const status = requiredString(row, 'status', 'invoice');
  const currency = requiredString(row, 'currency', 'invoice');
  const origin = requiredString(row, 'origin', 'invoice');
  if (status !== 'issued' || currency !== 'USD' || origin !== 'accepted_quote') {
    throw new Error('Malformed durable invoice lifecycle fields');
  }
  return {
    id: requiredString(row, 'id', 'invoice'),
    user_id: userId,
    contact_id: requiredString(row, 'contact_id', 'invoice'),
    quote_id: requiredString(row, 'quote_id', 'invoice'),
    quote_acceptance_id: requiredString(row, 'quote_acceptance_id', 'invoice'),
    source_quote_revision: integer(row, 'source_quote_revision', 'invoice', 1),
    invoice_number: integer(row, 'invoice_number', 'invoice', 1),
    status,
    currency,
    total_amount: finiteNumber(row, 'total_amount', 'invoice'),
    customer_name: requiredString(row, 'customer_name', 'invoice'),
    customer_email: optionalString(row, 'customer_email', 'invoice'),
    customer_phone: optionalString(row, 'customer_phone', 'invoice'),
    billing_address: typeof row.billing_address === 'string'
      ? row.billing_address
      : (() => { throw new Error('Malformed invoice.billing_address'); })(),
    issued_at: timestamp(row, 'issued_at', 'invoice'),
    due_at: timestamp(row, 'due_at', 'invoice'),
    origin,
    created_at: timestamp(row, 'created_at', 'invoice')
  };
}

function mapInvoiceItem(value: unknown, userId: string, invoiceIds: ReadonlySet<string>): DurableInvoiceItem {
  const row = record(value, 'invoice item');
  if (requiredString(row, 'user_id', 'invoice item') !== userId) throw new Error('Malformed invoice item.user_id');
  const invoiceId = requiredString(row, 'invoice_id', 'invoice item');
  if (!invoiceIds.has(invoiceId)) throw new Error('Invoice item does not belong to a hydrated invoice');
  const quantity = finiteNumber(row, 'quantity', 'invoice item', Number.EPSILON);
  const unitPrice = finiteNumber(row, 'unit_price', 'invoice item');
  const lineTotal = finiteNumber(row, 'line_total', 'invoice item');
  if (Math.abs((quantity * unitPrice) - lineTotal) > 0.000001) {
    throw new Error('Malformed invoice item.line_total');
  }
  return {
    id: requiredString(row, 'id', 'invoice item'),
    user_id: userId,
    invoice_id: invoiceId,
    source_quote_item_order_index: integer(row, 'source_quote_item_order_index', 'invoice item'),
    service_name: requiredString(row, 'service_name', 'invoice item'),
    description: typeof row.description === 'string'
      ? row.description
      : (() => { throw new Error('Malformed invoice item.description'); })(),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    created_at: timestamp(row, 'created_at', 'invoice item')
  };
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
    const results = await Promise.all(SUPPORTED_ENTITY_NAMES.map(async name => {
      try {
        const columns = name === 'invoices'
          ? INVOICE_COLUMNS
          : name === 'invoice_items'
            ? INVOICE_ITEM_COLUMNS
            : '*';
        const result = await client.from(name).select(columns).eq('user_id', userId);
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
      if (result.status === 'ready' && result.name !== 'invoices' && result.name !== 'invoice_items') {
        this.collections[result.name].push(...result.rows as never[]);
      }
    }
    const invoices = results.find(result => result.name === 'invoices');
    if (invoices?.status === 'ready') {
      try {
        const mapped = invoices.rows.map(row => mapInvoice(row, userId)).sort((a, b) =>
          b.issued_at.localeCompare(a.issued_at) || b.invoice_number - a.invoice_number || a.id.localeCompare(b.id)
        );
        this.collections.invoices.push(...mapped);
      } catch {
        entities.invoices = 'error';
        this.collections.invoices.splice(0);
      }
    }
    const invoiceItems = results.find(result => result.name === 'invoice_items');
    if (invoiceItems?.status === 'ready' && entities.invoices === 'ready') {
      try {
        const invoiceIds = new Set(this.collections.invoices.map(invoice => invoice.id));
        const mapped = invoiceItems.rows.map(row => mapInvoiceItem(row, userId, invoiceIds)).sort((a, b) =>
          a.invoice_id.localeCompare(b.invoice_id)
          || a.source_quote_item_order_index - b.source_quote_item_order_index
          || a.id.localeCompare(b.id)
        );
        this.collections.invoice_items.push(...mapped);
      } catch {
        entities.invoice_items = 'error';
        this.collections.invoice_items.splice(0);
      }
    } else if (invoiceItems?.status === 'ready' && entities.invoices === 'error') {
      entities.invoice_items = 'error';
    }
    this.inFlight = null;
    this.state = {
      status: Object.values(entities).every(status => status === 'ready') ? 'ready' : 'error',
      userId,
      entities
    };
    return this.state;
  }
}
