import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderPublishedRevision
} from './builder_publication';
import type { BuilderPublishedRevision } from './builder_publication';
import { builderPublishedRevisionToRow } from './builder_publication_repository';
import type {
  BuilderPublicationTarget,
  BuilderPublishRevisionInput
} from './builder_publication_repository';
import {
  SupabaseBuilderPublicationRepository
} from './builder_publication_repository_supabase';
import type {
  SupabaseBuilderPublicationRepositoryOptions
} from './builder_publication_repository_supabase';
import type { Page, PageSection, RepoResponse, User } from './types';

interface FakeResult {
  data: unknown;
  error: unknown;
}

interface FakeRequest {
  kind: 'table' | 'rpc';
  name: string;
  operation: string;
  values?: unknown;
  filters?: Array<{ column: string; value: unknown }>;
  orders?: Array<{ column: string; ascending: boolean }>;
  limit?: number;
  orFilter?: string;
}

interface FakeError {
  code?: string;
  message?: string;
  status?: number;
  details?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class FakeSupabaseQuery implements PromiseLike<FakeResult> {
  private operation = 'select';
  private values: unknown;
  private readonly filters: Array<{ column: string; value: unknown }> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private requestedLimit: number | undefined;
  private orFilterValue: string | undefined;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(
    private readonly owner: FakeSupabaseClient,
    private readonly table: string
  ) {}

  select(_columns = '*'): this {
    return this;
  }

  insert(values: unknown): this {
    this.operation = 'insert';
    this.values = clone(values);
    return this;
  }

  upsert(values: unknown): this {
    this.operation = 'upsert';
    this.values = clone(values);
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  or(filter: string): this {
    this.orFilterValue = filter;
    return this;
  }

  order(column: string, options: { ascending: boolean }): this {
    this.orders.push({ column, ascending: options.ascending });
    return this;
  }

  limit(limit: number): this {
    this.requestedLimit = limit;
    return this;
  }

  single(): Promise<FakeResult> {
    this.cardinality = 'single';
    return this.execute();
  }

  maybeSingle(): Promise<FakeResult> {
    this.cardinality = 'maybeSingle';
    return this.execute();
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<FakeResult> {
    this.owner.requests.push({
      kind: 'table',
      name: this.table,
      operation: this.operation,
      ...(this.values === undefined ? {} : { values: clone(this.values) }),
      filters: clone(this.filters),
      orders: clone(this.orders),
      ...(this.requestedLimit === undefined ? {} : { limit: this.requestedLimit }),
      ...(this.orFilterValue === undefined ? {} : { orFilter: this.orFilterValue })
    });

    const configuredError = this.owner.takeTableError(this.table, this.operation);
    if (configuredError) return { data: null, error: configuredError };

    const tableRows = this.owner.tables.get(this.table) ?? [];
    if (this.operation === 'insert') {
      const insertedValue = this.values;
      if (!isRow(insertedValue)) return { data: null, error: { code: '23502' } };
      if (tableRows.some(row => isRow(row) && row.id === insertedValue.id)) {
        return { data: null, error: { code: '23505', message: 'duplicate details' } };
      }
      const stored = clone(insertedValue);
      tableRows.push(stored);
      this.owner.tables.set(this.table, tableRows);
      return { data: clone(stored), error: null };
    }

    if (this.operation !== 'select') {
      return { data: null, error: { code: 'FAKE_UNSUPPORTED' } };
    }

    let rows = tableRows.filter(row => this.filters.every(filter => (
      isRow(row) && row[filter.column] === filter.value
    )));
    if (this.orFilterValue) {
      const match = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)$/.exec(
        this.orFilterValue
      );
      if (!match) return { data: null, error: { code: 'FAKE_FILTER' } };
      rows = rows.filter(row => isRow(row) && (
        String(row.created_at) < match[1]
        || (row.created_at === match[2] && String(row.id) < match[3])
      ));
    }

    if (this.orders.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const order of this.orders) {
          const leftValue = isRow(left) ? left[order.column] : undefined;
          const rightValue = isRow(right) ? right[order.column] : undefined;
          if (leftValue === rightValue) continue;
          const comparison = String(leftValue) < String(rightValue) ? -1 : 1;
          return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
    }
    if (this.requestedLimit !== undefined) rows = rows.slice(0, this.requestedLimit);

    if (this.cardinality === 'maybeSingle') {
      if (rows.length === 0) return { data: null, error: null };
      if (rows.length > 1) return { data: null, error: { code: 'PGRST116' } };
      return { data: clone(rows[0]), error: null };
    }
    if (this.cardinality === 'single') {
      return rows.length === 1
        ? { data: clone(rows[0]), error: null }
        : { data: null, error: { code: 'PGRST116' } };
    }
    return { data: clone(rows), error: null };
  }
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class FakeSupabaseClient {
  readonly tables = new Map<string, unknown[]>();
  readonly requests: FakeRequest[] = [];
  readonly auth = {
    getUser: async (): Promise<{
      data: { user: { id: string } | null };
      error: FakeError | null;
    }> => {
      this.authCalls += 1;
      if (this.authThrows) throw new Error('network secret details');
      return {
        data: { user: this.authUserId === null ? null : { id: this.authUserId } },
        error: this.authError
      };
    }
  };
  authUserId: string | null = 'owner';
  authError: FakeError | null = null;
  authThrows = false;
  authCalls = 0;
  private readonly tableErrors = new Map<string, FakeError[]>();
  private readonly rpcResults = new Map<string, FakeResult[]>();

  from(table: string): FakeSupabaseQuery {
    return new FakeSupabaseQuery(this, table);
  }

  async rpc(name: string, values: unknown): Promise<FakeResult> {
    this.requests.push({
      kind: 'rpc',
      name,
      operation: 'rpc',
      values: clone(values)
    });
    const queue = this.rpcResults.get(name) ?? [];
    return clone(queue.shift() ?? {
      data: null,
      error: { code: 'FAKE_UNCONFIGURED_RPC', message: 'raw fake details' }
    });
  }

  seed(table: string, rows: readonly unknown[]): void {
    this.tables.set(table, clone([...rows]));
  }

  queueTableError(table: string, operation: string, error: FakeError): void {
    const key = `${table}:${operation}`;
    const queue = this.tableErrors.get(key) ?? [];
    queue.push(clone(error));
    this.tableErrors.set(key, queue);
  }

  takeTableError(table: string, operation: string): FakeError | undefined {
    return this.tableErrors.get(`${table}:${operation}`)?.shift();
  }

  queueRpc(name: string, result: FakeResult): void {
    const queue = this.rpcResults.get(name) ?? [];
    queue.push(clone(result));
    this.rpcResults.set(name, queue);
  }
}

function makeDocument(
  pageId = 'page-1',
  heading = 'Professional pressure washing',
  sectionType = 'hero'
): BuilderDocument {
  const page: Page = {
    id: pageId,
    user_id: 'owner',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    status: 'draft',
    seo_title: 'Pressure Washing',
    seo_description: 'Exterior cleaning services.',
    seo_keywords: ['pressure washing'],
    created_at: '2026-07-25T00:00:00.000Z',
    funnel_id: 'funnel-1'
  };
  const sections: PageSection[] = [{
    id: `section-${pageId}`,
    page_id: pageId,
    funnel_id: page.funnel_id,
    type: sectionType,
    variant: 'standard',
    order: 10,
    content: {
      heading,
      unknownNested: { items: [{ label: 'Preserved', enabled: true }] }
    },
    styles: { visible: true, unknownStyle: { desktop: { gap: 24 } } }
  }];
  return createBuilderDocument(page, sections);
}

function makeRevision(
  id: string,
  options: Partial<{
    websiteId: string;
    pageId: string;
    createdAt: string;
    createdBy: string;
    heading: string;
    sectionType: string;
  }> = {}
): BuilderPublishedRevision {
  const pageId = options.pageId ?? 'page-1';
  return createBuilderPublishedRevision(
    makeDocument(
      pageId,
      options.heading ?? id,
      options.sectionType ?? 'hero'
    ),
    {
      id,
      websiteId: options.websiteId ?? 'website-1',
      createdAt: options.createdAt ?? '2026-07-25T12:00:00.000Z',
      ...(options.createdBy === undefined ? {} : { createdBy: options.createdBy })
    }
  );
}

function targetRow(
  revisionId = 'revision-1',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    website_id: 'website-1',
    page_id: 'page-1',
    published_revision_id: revisionId,
    published_at: '2026-07-25T13:00:00.000Z',
    published_by: 'owner',
    ...overrides
  };
}

function publishInput(
  revisionId = 'revision-1',
  overrides: Partial<BuilderPublishRevisionInput> = {}
): BuilderPublishRevisionInput {
  return {
    websiteId: 'website-1',
    pageId: 'page-1',
    revisionId,
    publishedAt: '2026-07-25T13:00:00.000Z',
    ...overrides
  };
}

function publishRpcData(
  revision: BuilderPublishedRevision,
  previousRevisionId: string | null = null,
  targetOverrides: Record<string, unknown> = {}
): unknown[] {
  return [{
    publication_target: targetRow(revision.id, targetOverrides),
    published_revision: builderPublishedRevisionToRow(revision),
    previous_revision_id: previousRevisionId
  }];
}

function makeRepository(
  fake = new FakeSupabaseClient(),
  verifyAuthenticatedUser = true
): SupabaseBuilderPublicationRepository {
  return new SupabaseBuilderPublicationRepository({
    client: fake as unknown as SupabaseClient,
    verifyAuthenticatedUser
  });
}

function expectFailure(response: RepoResponse<unknown>, code: string): void {
  expect(response.success).toBe(false);
  expect(response.data).toBeUndefined();
  expect(response.code).toBe(code);
}

function tableRequests(fake: FakeSupabaseClient, table: string): FakeRequest[] {
  return fake.requests.filter(request => request.kind === 'table' && request.name === table);
}

describe('Supabase Builder publication construction and authentication', () => {
  it('requires an injected client', () => {
    expect(() => new SupabaseBuilderPublicationRepository(
      undefined as unknown as SupabaseBuilderPublicationRepositoryOptions
    )).toThrow('requires a client');
  });

  it('does not mutate constructor options', () => {
    const fake = new FakeSupabaseClient();
    const options: SupabaseBuilderPublicationRepositoryOptions = {
      client: fake as unknown as SupabaseClient,
      verifyAuthenticatedUser: false
    };
    const snapshot = { ...options };
    makeRepository(fake, false);
    expect(options).toEqual(snapshot);
  });

  it('allows a matching authenticated supplied user', async () => {
    const fake = new FakeSupabaseClient();
    const response = await makeRepository(fake).getRevisionById('missing', 'owner');
    expect(response.error).toBe('NOT_FOUND');
    expect(fake.authCalls).toBe(1);
  });

  it('uses the existing User.id acting-user convention without mutating the user', async () => {
    const fake = new FakeSupabaseClient();
    const user: User = {
      id: 'owner',
      email: 'owner@example.com',
      password_hash: 'hash',
      created_at: '2026-07-25T00:00:00.000Z'
    };
    const snapshot = structuredClone(user);
    const response = await makeRepository(fake).getRevisionById('missing', user);
    expect(response.error).toBe('NOT_FOUND');
    expect(user).toEqual(snapshot);
  });

  it('rejects a missing Supabase auth user before querying', async () => {
    const fake = new FakeSupabaseClient();
    fake.authUserId = null;
    expectFailure(await makeRepository(fake).getRevisionById('revision-1', 'owner'), 'UNAUTHORIZED');
    expect(fake.requests).toHaveLength(0);
  });

  it('rejects a mismatched Supabase auth user before querying', async () => {
    const fake = new FakeSupabaseClient();
    fake.authUserId = 'intruder';
    expectFailure(await makeRepository(fake).getRevisionById('revision-1', 'owner'), 'UNAUTHORIZED');
    expect(fake.requests).toHaveLength(0);
  });

  it('can rely on the injected session and RLS without an auth lookup', async () => {
    const fake = new FakeSupabaseClient();
    await makeRepository(fake, false).getRevisionById('missing', 'owner');
    expect(fake.authCalls).toBe(0);
    expect(fake.requests).toHaveLength(1);
  });

  it('still rejects a blank supplied user when auth verification is disabled', async () => {
    const fake = new FakeSupabaseClient();
    expectFailure(await makeRepository(fake, false).getRevisionById('revision-1', ' '), 'UNAUTHORIZED');
    expect(fake.requests).toHaveLength(0);
  });

  it('returns a safe persistence failure when auth transport throws', async () => {
    const fake = new FakeSupabaseClient();
    fake.authThrows = true;
    const response = await makeRepository(fake).getRevisionById('revision-1', 'owner');
    expectFailure(response, 'PERSISTENCE_ERROR');
    expect(response.error).not.toContain('secret');
  });
});

describe('Supabase Builder revision creation and lookup', () => {
  it('inserts one snake_case revision row and never writes a target', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1', { createdBy: 'owner' });
    const response = await makeRepository(fake).createRevision(revision, 'owner');

    expect(response.success).toBe(true);
    const request = tableRequests(fake, 'builder_published_revisions')[0];
    expect(request.operation).toBe('insert');
    expect(request.values).toEqual(builderPublishedRevisionToRow(revision));
    expect(request.values).toMatchObject({
      schema_version: 1,
      website_id: 'website-1',
      page_id: 'page-1',
      created_by: 'owner'
    });
    expect(tableRequests(fake, 'builder_publication_targets')).toHaveLength(0);
    expect(fake.requests.some(request => request.operation === 'upsert')).toBe(false);
  });

  it('rejects a createdBy mismatch before insertion', async () => {
    const fake = new FakeSupabaseClient();
    const response = await makeRepository(fake).createRevision(
      makeRevision('revision-1', { createdBy: 'intruder' }),
      'owner'
    );
    expectFailure(response, 'UNAUTHORIZED');
    expect(fake.requests).toHaveLength(0);
  });

  it('rejects invalid revisions before insertion', async () => {
    const fake = new FakeSupabaseClient();
    const malformed = {
      ...makeRevision('revision-1'),
      documentFingerprint: 'stale'
    } as BuilderPublishedRevision;
    expectFailure(await makeRepository(fake).createRevision(malformed, 'owner'), 'INVALID_INPUT');
    expect(fake.requests).toHaveLength(0);
  });

  it('maps duplicate revision IDs to conflict without exposing database details', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [
      builderPublishedRevisionToRow(makeRevision('revision-1'))
    ]);
    const response = await makeRepository(fake).createRevision(makeRevision('revision-1'), 'owner');
    expectFailure(response, 'CONFLICT');
    expect(response.error).toBe('REVISION_ID_ALREADY_EXISTS');
    expect(response.error).not.toContain('details');
  });

  it('allows identical fingerprints under different revision IDs', async () => {
    const fake = new FakeSupabaseClient();
    const first = makeRevision('revision-1', { heading: 'Same document' });
    const second = {
      ...first,
      id: 'revision-2'
    } as BuilderPublishedRevision;
    fake.seed('builder_published_revisions', [builderPublishedRevisionToRow(first)]);
    const response = await makeRepository(fake).createRevision(second, 'owner');
    expect(response.success).toBe(true);
    expect(fake.tables.get('builder_published_revisions')).toHaveLength(2);
  });

  it('maps inserted rows to deeply frozen independent revisions', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1');
    const response = await makeRepository(fake).createRevision(revision, 'owner');
    const returned = response.data!;
    expect(returned).not.toBe(revision);
    expect(returned.document).not.toBe(revision.document);
    expect(Object.isFrozen(returned)).toBe(true);
    expect(Object.isFrozen(returned.document.sections[0].content)).toBe(true);
  });

  it('queries a revision by ID and maps nullable created_by', async () => {
    const fake = new FakeSupabaseClient();
    const row = { ...builderPublishedRevisionToRow(makeRevision('revision-1')), created_by: null };
    fake.seed('builder_published_revisions', [row]);
    const response = await makeRepository(fake).getRevisionById('revision-1', 'owner');
    expect(response.data?.createdBy).toBeUndefined();
    expect(tableRequests(fake, 'builder_published_revisions')[0].filters).toContainEqual({
      column: 'id', value: 'revision-1'
    });
  });

  it('returns NOT_FOUND when no authorized revision row is visible', async () => {
    expectFailure(
      await makeRepository().getRevisionById('missing', 'owner'),
      'NOT_FOUND'
    );
  });

  it('returns a safe persistence failure for malformed revision rows', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [{ id: 'revision-1' }]);
    expectFailure(
      await makeRepository(fake).getRevisionById('revision-1', 'owner'),
      'PERSISTENCE_ERROR'
    );
  });

  it('rejects a stored row whose fingerprint no longer matches its document', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [{
      ...builderPublishedRevisionToRow(makeRevision('revision-1')),
      document_fingerprint: 'stale-fingerprint'
    }]);
    expectFailure(
      await makeRepository(fake).getRevisionById('revision-1', 'owner'),
      'PERSISTENCE_ERROR'
    );
  });

  it('preserves unknown custom section data on lookup', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1', {
      sectionType: 'custom-pressure-washing-estimator'
    });
    fake.seed('builder_published_revisions', [builderPublishedRevisionToRow(revision)]);
    const returned = (await makeRepository(fake).getRevisionById('revision-1', 'owner')).data!;
    expect(returned.document.sections[0].type).toBe('custom-pressure-washing-estimator');
    expect(returned.document.sections[0].content.unknownNested).toEqual({
      items: [{ label: 'Preserved', enabled: true }]
    });
  });
});

describe('Supabase Builder revision history pagination', () => {
  it('filters website/page, orders deterministically, and requests default limit plus one', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [
      builderPublishedRevisionToRow(makeRevision('revision-b')),
      builderPublishedRevisionToRow(makeRevision('revision-c')),
      builderPublishedRevisionToRow(makeRevision('revision-a'))
    ]);
    const response = await makeRepository(fake).listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );
    expect(response.data?.items.map(item => item.id)).toEqual([
      'revision-c', 'revision-b', 'revision-a'
    ]);
    const request = tableRequests(fake, 'builder_published_revisions')[0];
    expect(request.filters).toEqual([
      { column: 'website_id', value: 'website-1' },
      { column: 'page_id', value: 'page-1' }
    ]);
    expect(request.orders).toEqual([
      { column: 'created_at', ascending: false },
      { column: 'id', ascending: false }
    ]);
    expect(request.limit).toBe(26);
  });

  it('caps history at 100 and floors fractional limits', async () => {
    const capped = new FakeSupabaseClient();
    await makeRepository(capped).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 500 }
    );
    expect(tableRequests(capped, 'builder_published_revisions')[0].limit).toBe(101);

    const fractional = new FakeSupabaseClient();
    await makeRepository(fractional).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 2.9 }
    );
    expect(tableRequests(fractional, 'builder_published_revisions')[0].limit).toBe(3);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid history limit %s before table access',
    async limit => {
      const fake = new FakeSupabaseClient();
      expectFailure(await makeRepository(fake).listRevisionsForPage(
        'website-1', 'page-1', 'owner', { limit }
      ), 'INVALID_INPUT');
      expect(fake.requests).toHaveLength(0);
    }
  );

  it('returns nextCursor only when another row exists', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [
      builderPublishedRevisionToRow(makeRevision('revision-c')),
      builderPublishedRevisionToRow(makeRevision('revision-b')),
      builderPublishedRevisionToRow(makeRevision('revision-a'))
    ]);
    const first = await makeRepository(fake).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 2 }
    );
    expect(first.data?.items.map(item => item.id)).toEqual(['revision-c', 'revision-b']);
    expect(first.data?.nextCursor).toBeTypeOf('string');

    const noMore = await makeRepository(fake).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 3 }
    );
    expect(noMore.data?.nextCursor).toBeUndefined();
  });

  it('resolves a cursor in the same scope and adds the descending boundary', async () => {
    const fake = new FakeSupabaseClient();
    const rows = [
      makeRevision('revision-c'),
      makeRevision('revision-b'),
      makeRevision('revision-a')
    ].map(builderPublishedRevisionToRow);
    fake.seed('builder_published_revisions', rows);
    const repository = makeRepository(fake);
    const first = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1 }
    );
    fake.requests.length = 0;
    const second = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1, cursor: first.data?.nextCursor }
    );

    expect(second.data?.items[0].id).toBe('revision-b');
    const [cursorRequest, pageRequest] = tableRequests(fake, 'builder_published_revisions');
    expect(cursorRequest.filters).toEqual([
      { column: 'id', value: 'revision-c' },
      { column: 'website_id', value: 'website-1' },
      { column: 'page_id', value: 'page-1' }
    ]);
    expect(pageRequest.orFilter).toBe(
      'created_at.lt.2026-07-25T12:00:00.000Z,and(created_at.eq.2026-07-25T12:00:00.000Z,id.lt.revision-c)'
    );
  });

  it('rejects malformed and unknown cursors', async () => {
    const malformed = new FakeSupabaseClient();
    expectFailure(await makeRepository(malformed).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { cursor: '***' }
    ), 'INVALID_INPUT');
    expect(malformed.requests).toHaveLength(0);

    const unknown = new FakeSupabaseClient();
    expectFailure(await makeRepository(unknown).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { cursor: 'dW5rbm93bg' }
    ), 'INVALID_INPUT');
  });

  it('rejects a cursor belonging to another page or website', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [builderPublishedRevisionToRow(
      makeRevision('foreign', { websiteId: 'website-2', pageId: 'page-2' })
    )]);
    expectFailure(await makeRepository(fake).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { cursor: 'Zm9yZWlnbg' }
    ), 'INVALID_INPUT');
  });

  it('returns deeply frozen history without shared transport references', async () => {
    const fake = new FakeSupabaseClient();
    const row = builderPublishedRevisionToRow(makeRevision('revision-1'));
    fake.seed('builder_published_revisions', [row]);
    const response = await makeRepository(fake).listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );
    expect(Object.isFrozen(response.data)).toBe(true);
    expect(Object.isFrozen(response.data?.items)).toBe(true);
    expect(response.data?.items[0].document).not.toBe(row.document);
  });
});

describe('Supabase Builder targets and selected revision lookup', () => {
  it('returns null when no publication target exists', async () => {
    const response = await makeRepository().getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );
    expect(response).toEqual({ success: true, data: null });
  });

  it('maps and deeply freezes target rows', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_publication_targets', [targetRow()]);
    const response = await makeRepository(fake).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );
    expect(response.data).toEqual<BuilderPublicationTarget>({
      websiteId: 'website-1',
      pageId: 'page-1',
      publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z',
      publishedBy: 'owner'
    });
    expect(Object.isFrozen(response.data)).toBe(true);
  });

  it('loads a target and its matching published revision with one auth check', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1');
    fake.seed('builder_publication_targets', [targetRow()]);
    fake.seed('builder_published_revisions', [builderPublishedRevisionToRow(revision)]);
    const response = await makeRepository(fake).getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    );
    expect(response.data?.id).toBe('revision-1');
    expect(fake.authCalls).toBe(1);
  });

  it('returns a safe failure for malformed target rows', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_publication_targets', [targetRow('revision-1', { published_at: 'no-zone' })]);
    expectFailure(await makeRepository(fake).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('returns an integrity failure for a broken target', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_publication_targets', [targetRow('missing')]);
    expectFailure(await makeRepository(fake).getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    ), 'INTEGRITY_ERROR');
  });

  it('rejects cross-page target or revision responses safely', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_publication_targets', [targetRow('revision-1', { page_id: 'page-2' })]);
    const response = await makeRepository(fake).getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    );
    expect(response.data).toBeNull();

    const malformedFake = new FakeSupabaseClient();
    malformedFake.seed('builder_publication_targets', [targetRow()]);
    malformedFake.seed('builder_published_revisions', [builderPublishedRevisionToRow(
      makeRevision('revision-1', { pageId: 'page-2' })
    )]);
    expectFailure(await makeRepository(malformedFake).getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    ), 'INTEGRITY_ERROR');
  });
});

describe('Supabase Builder atomic publication and rollback', () => {
  it('publishes only through publish_builder_revision and maps the exact result', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1');
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(revision), error: null
    });
    const response = await makeRepository(fake).publishRevision(
      publishInput(), 'owner'
    );
    expect(response.data?.revision).toEqual(revision);
    expect(response.data?.target.publishedRevisionId).toBe('revision-1');
    expect(response.data?.previousRevisionId).toBeNull();
    expect(fake.requests[0].name).toBe('publish_builder_revision');
    expect(tableRequests(fake, 'builder_publication_targets')).toHaveLength(0);
  });

  it('maps omitted expectation to inactive with a null expected ID', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(makeRevision('revision-1')), error: null
    });
    await makeRepository(fake).publishRevision(publishInput(), 'owner');
    expect(fake.requests[0].values).toMatchObject({
      p_expected_revision_id: null,
      p_expectation_supplied: false
    });
  });

  it('maps explicit null expectation to active with a null expected ID', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(makeRevision('revision-1')), error: null
    });
    await makeRepository(fake).publishRevision(publishInput('revision-1', {
      expectedPublishedRevisionId: null
    }), 'owner');
    expect(fake.requests[0].values).toMatchObject({
      p_expected_revision_id: null,
      p_expectation_supplied: true
    });
  });

  it('maps string expectations exactly and never sends publishedBy', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(makeRevision('revision-1'), 'revision-old'), error: null
    });
    await makeRepository(fake).publishRevision(publishInput('revision-1', {
      expectedPublishedRevisionId: 'revision-old'
    }), 'owner');
    expect(fake.requests[0].values).toEqual({
      p_website_id: 'website-1',
      p_page_id: 'page-1',
      p_revision_id: 'revision-1',
      p_published_at: '2026-07-25T13:00:00.000Z',
      p_expected_revision_id: 'revision-old',
      p_expectation_supplied: true
    });
  });

  it('maps SQLSTATE 40001 to conflict without a direct-write fallback', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('publish_builder_revision', {
      data: null,
      error: { code: '40001', message: 'BUILDER_PUBLICATION_TARGET_CONFLICT raw SQL' }
    });
    const response = await makeRepository(fake).publishRevision(publishInput(), 'owner');
    expectFailure(response, 'CONFLICT');
    expect(response.error).toBe('PUBLICATION_TARGET_CONFLICT');
    expect(fake.requests).toHaveLength(1);
    expect(tableRequests(fake, 'builder_publication_targets')).toHaveLength(0);
  });

  it('uses the same RPC and expectation semantics for rollback', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-old');
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(revision, 'revision-current'), error: null
    });
    const response = await makeRepository(fake).rollbackToRevision(
      publishInput('revision-old', { expectedPublishedRevisionId: 'revision-current' }),
      'owner'
    );
    expect(response.data?.previousRevisionId).toBe('revision-current');
    expect(fake.requests[0].name).toBe('publish_builder_revision');
    expect(fake.requests[0].values).toMatchObject({
      p_revision_id: 'revision-old',
      p_expected_revision_id: 'revision-current',
      p_expectation_supplied: true
    });
  });

  it('rejects malformed publish inputs before RPC access', async () => {
    const fake = new FakeSupabaseClient();
    expectFailure(await makeRepository(fake).publishRevision(
      publishInput(' ', { publishedAt: '2026-07-25T13:00:00' }),
      'owner'
    ), 'INVALID_INPUT');
    expect(fake.requests).toHaveLength(0);
  });

  it('rejects an own undefined expectation rather than treating it as omitted', async () => {
    const fake = new FakeSupabaseClient();
    const input = publishInput();
    Object.defineProperty(input, 'expectedPublishedRevisionId', {
      value: undefined,
      enumerable: true
    });
    expectFailure(await makeRepository(fake).publishRevision(input, 'owner'), 'INVALID_INPUT');
    expect(fake.requests).toHaveLength(0);
  });

  it('rejects malformed or cross-scope RPC results safely', async () => {
    const malformed = new FakeSupabaseClient();
    malformed.queueRpc('publish_builder_revision', { data: [], error: null });
    expectFailure(await makeRepository(malformed).publishRevision(publishInput(), 'owner'), 'PERSISTENCE_ERROR');

    const crossed = new FakeSupabaseClient();
    crossed.queueRpc('publish_builder_revision', {
      data: publishRpcData(makeRevision('revision-1'), null, { page_id: 'page-2' }),
      error: null
    });
    expectFailure(await makeRepository(crossed).publishRevision(publishInput(), 'owner'), 'INTEGRITY_ERROR');
  });

  it('returns frozen RPC values without sharing response-row references', async () => {
    const fake = new FakeSupabaseClient();
    const revision = makeRevision('revision-1');
    const rpcData = publishRpcData(revision);
    fake.queueRpc('publish_builder_revision', { data: rpcData, error: null });
    const response = await makeRepository(fake).publishRevision(publishInput(), 'owner');
    expect(Object.isFrozen(response.data)).toBe(true);
    expect(Object.isFrozen(response.data?.target)).toBe(true);
    expect(Object.isFrozen(response.data?.revision.document.sections[0].content)).toBe(true);
    expect(response.data?.revision.document).not.toBe(
      (rpcData[0] as { published_revision: { document: unknown } }).published_revision.document
    );
  });
});

describe('Supabase Builder safe deletion and error mapping', () => {
  it('deletes only through delete_unpublished_builder_revision', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('delete_unpublished_builder_revision', {
      data: 'revision-1', error: null
    });
    const response = await makeRepository(fake).deleteRevisionIfUnpublished(
      'revision-1', 'owner'
    );
    expect(response).toEqual({ success: true, data: { id: 'revision-1' } });
    expect(fake.requests[0]).toMatchObject({
      kind: 'rpc',
      name: 'delete_unpublished_builder_revision',
      values: { p_revision_id: 'revision-1' }
    });
    expect(fake.requests.some(request => request.operation === 'delete')).toBe(false);
  });

  it('maps referenced-revision SQLSTATE 55006 to conflict', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('delete_unpublished_builder_revision', {
      data: null,
      error: { code: '55006', message: 'BUILDER_REVISION_IS_PUBLISHED raw details' }
    });
    const response = await makeRepository(fake).deleteRevisionIfUnpublished(
      'revision-1', 'owner'
    );
    expectFailure(response, 'CONFLICT');
    expect(response.error).toBe('PUBLISHED_REVISION_CANNOT_BE_DELETED');
  });

  it('maps absent revisions to NOT_FOUND', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueRpc('delete_unpublished_builder_revision', {
      data: null, error: { code: 'P0002', message: 'private database detail' }
    });
    const response = await makeRepository(fake).deleteRevisionIfUnpublished(
      'missing', 'owner'
    );
    expectFailure(response, 'NOT_FOUND');
    expect(response.error).toBe('NOT_FOUND');
  });

  it('maps a missing or mismatched delete result safely', async () => {
    const missing = new FakeSupabaseClient();
    missing.queueRpc('delete_unpublished_builder_revision', { data: null, error: null });
    expectFailure(await makeRepository(missing).deleteRevisionIfUnpublished(
      'revision-1', 'owner'
    ), 'PERSISTENCE_ERROR');

    const mismatch = new FakeSupabaseClient();
    mismatch.queueRpc('delete_unpublished_builder_revision', { data: 'revision-2', error: null });
    expectFailure(await makeRepository(mismatch).deleteRevisionIfUnpublished(
      'revision-1', 'owner'
    ), 'INTEGRITY_ERROR');
  });

  it('maps RLS and permission failures to an authorization failure', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueTableError('builder_published_revisions', 'select', {
      code: '42501', message: 'policy and SQL details'
    });
    const response = await makeRepository(fake).getRevisionById('revision-1', 'owner');
    expectFailure(response, 'FORBIDDEN');
    expect(response.error).toBe('FORBIDDEN');
  });

  it.each(['22P02', '22004', '23502', '23503', '23514'])(
    'maps database input failure %s to INVALID_INPUT',
    async code => {
      const fake = new FakeSupabaseClient();
      fake.queueTableError('builder_published_revisions', 'select', {
        code, message: 'raw SQL and URL details'
      });
      const response = await makeRepository(fake).getRevisionById('revision-1', 'owner');
      expectFailure(response, 'INVALID_INPUT');
      expect(response.error).toBe('INVALID_DATABASE_INPUT');
    }
  );

  it('maps unknown database errors to a sanitized persistence failure', async () => {
    const fake = new FakeSupabaseClient();
    fake.queueTableError('builder_published_revisions', 'select', {
      code: 'XX999',
      message: 'postgres://secret.example/token raw SQL SELECT *',
      details: 'stack trace'
    });
    const response = await makeRepository(fake).getRevisionById('revision-1', 'owner');
    expectFailure(response, 'PERSISTENCE_ERROR');
    expect(response.error).toBe('SUPABASE_PUBLICATION_PERSISTENCE_ERROR');
    expect(response.error).not.toContain('secret');
    expect(response.error).not.toContain('SELECT');
  });

  it('does not mutate revision, publication input, options, or user values', async () => {
    const fake = new FakeSupabaseClient();
    const revision = structuredClone(makeRevision('revision-1', { createdBy: 'owner' }));
    const input = publishInput('revision-1');
    const user: User = {
      id: 'owner',
      email: 'owner@example.com',
      password_hash: 'hash',
      created_at: '2026-07-25T00:00:00.000Z'
    };
    const options: SupabaseBuilderPublicationRepositoryOptions = {
      client: fake as unknown as SupabaseClient
    };
    const revisionSnapshot = structuredClone(revision);
    const inputSnapshot = structuredClone(input);
    const userSnapshot = structuredClone(user);
    fake.queueRpc('publish_builder_revision', {
      data: publishRpcData(revision), error: null
    });
    const repository = new SupabaseBuilderPublicationRepository(options);

    await repository.createRevision(revision, user);
    await repository.publishRevision(input, user);

    expect(revision).toEqual(revisionSnapshot);
    expect(input).toEqual(inputSnapshot);
    expect(user).toEqual(userSnapshot);
    expect(options.client).toBe(fake);
  });

  it('returns independent nested document references across separate reads', async () => {
    const fake = new FakeSupabaseClient();
    fake.seed('builder_published_revisions', [
      builderPublishedRevisionToRow(makeRevision('revision-1'))
    ]);
    const repository = makeRepository(fake);
    const first = (await repository.getRevisionById('revision-1', 'owner')).data!;
    const second = (await repository.getRevisionById('revision-1', 'owner')).data!;
    expect(first).not.toBe(second);
    expect(first.document).not.toBe(second.document);
    expect(first.document.sections[0].content).not.toBe(
      second.document.sections[0].content
    );
  });
});
