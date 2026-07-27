import { describe, expect, it } from 'vitest';
import { createBuilderDocument } from './builder_document';
import { createBuilderPublishedRevision } from './builder_publication';
import {
  builderPublishedRevisionToRow,
  type BuilderPublicationTarget
} from './builder_publication_repository';
import type {
  BuilderPublicationStorage,
  LocalBuilderPublicationSnapshot
} from './builder_publication_repository_local';
import { loadBuilderPublicRevision } from './builder_publication_public';
import type { Page, PageSection } from './types';

class TrackingStorage implements BuilderPublicationStorage {
  readonly values = new Map<string, string>();
  reads = 0;
  writes = 0;
  removes = 0;
  readError = false;

  getItem(key: string): string | null {
    this.reads += 1;
    if (this.readError) throw new Error('private storage failure');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removes += 1;
    this.values.delete(key);
  }
}

function page(id = 'page-1'): Page {
  return {
    id,
    user_id: 'owner',
    name: `Page ${id}`,
    slug: id,
    status: 'draft',
    seo_title: `SEO ${id}`,
    seo_description: `Description ${id}`,
    seo_keywords: ['pressure washing'],
    created_at: '2026-07-25T00:00:00.000Z'
  };
}

function sections(pageId = 'page-1'): PageSection[] {
  return [{
    id: `custom-${pageId}`,
    page_id: pageId,
    funnel_id: 'funnel-1',
    type: 'custom-unknown',
    variant: 'special',
    order: 0,
    content: { heading: 'Immutable published heading', nested: { value: 7 } },
    styles: { visible: true, custom: { color: '#123456' } }
  }];
}

function revision(
  websiteId = 'website-1',
  pageId = 'page-1',
  id = `revision-${websiteId}-${pageId}`
) {
  return createBuilderPublishedRevision(
    createBuilderDocument(page(pageId), sections(pageId)),
    {
      id,
      websiteId,
      createdAt: '2026-07-25T12:00:00.000Z',
      createdBy: 'owner'
    }
  );
}

function target(
  websiteId = 'website-1',
  pageId = 'page-1',
  revisionId = `revision-${websiteId}-${pageId}`
): BuilderPublicationTarget {
  return {
    websiteId,
    pageId,
    publishedRevisionId: revisionId,
    publishedAt: '2026-07-25T12:05:00.000Z',
    publishedBy: 'owner'
  };
}

function snapshot(
  revisions = [revision()],
  targets = [target()]
): LocalBuilderPublicationSnapshot {
  return {
    schemaVersion: 1,
    revisions: revisions.map(builderPublishedRevisionToRow),
    targets
  };
}

function storageWith(value: unknown, key = 'crm_builder_publications_v1'): TrackingStorage {
  const storage = new TrackingStorage();
  storage.values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  return storage;
}

describe('public Builder revision loader', () => {
  it('returns not-published when no snapshot is stored', async () => {
    await expect(loadBuilderPublicRevision(
      new TrackingStorage(), 'website-1', 'page-1'
    )).resolves.toEqual({ state: 'not-published' });
  });

  it('returns not-published for a valid snapshot without a target', async () => {
    const storage = storageWith(snapshot([revision()], []));
    await expect(loadBuilderPublicRevision(storage, 'website-1', 'page-1'))
      .resolves.toEqual({ state: 'not-published' });
  });

  it('returns the selected immutable revision and target', async () => {
    const storage = storageWith(snapshot());
    const result = await loadBuilderPublicRevision(storage, 'website-1', 'page-1');
    expect(result.state).toBe('published');
    if (result.state !== 'published') return;
    expect(result.revision.id).toBe('revision-website-1-page-1');
    expect(result.target.publishedRevisionId).toBe(result.revision.id);
    expect(Object.isFrozen(result.revision)).toBe(true);
    expect(Object.isFrozen(result.revision.document.sections[0].content.nested)).toBe(true);
    expect(Object.isFrozen(result.target)).toBe(true);
  });

  it('uses the exact website/page pair when several targets exist', async () => {
    const first = revision();
    const second = revision('website-1', 'page-2');
    const storage = storageWith(snapshot(
      [first, second],
      [target(), target('website-1', 'page-2')]
    ));
    const result = await loadBuilderPublicRevision(storage, 'website-1', 'page-2');
    expect(result.state === 'published' && result.revision.id).toBe(second.id);
  });

  it('does not return another page target', async () => {
    const other = revision('website-1', 'page-2');
    const storage = storageWith(snapshot([other], [target('website-1', 'page-2')]));
    await expect(loadBuilderPublicRevision(storage, 'website-1', 'page-1'))
      .resolves.toEqual({ state: 'not-published' });
  });

  it('does not return another website target', async () => {
    const other = revision('website-2', 'page-1');
    const storage = storageWith(snapshot([other], [target('website-2', 'page-1')]));
    await expect(loadBuilderPublicRevision(storage, 'website-1', 'page-1'))
      .resolves.toEqual({ state: 'not-published' });
  });

  it('does not write, remove, or normalize storage during reads', async () => {
    const storage = storageWith(snapshot());
    const before = storage.values.get('crm_builder_publications_v1');
    await loadBuilderPublicRevision(storage, 'website-1', 'page-1');
    expect(storage.reads).toBeGreaterThan(0);
    expect(storage.writes).toBe(0);
    expect(storage.removes).toBe(0);
    expect(storage.values.get('crm_builder_publications_v1')).toBe(before);
  });

  it.each([
    ['invalid JSON', '{not-json'],
    ['unsupported schema', { schemaVersion: 2, revisions: [], targets: [] }],
    ['broken target', snapshot([], [target()])]
  ])('returns publication-error for %s', async (_label, value) => {
    const result = await loadBuilderPublicRevision(
      storageWith(value), 'website-1', 'page-1'
    );
    expect(result).toEqual({
      state: 'publication-error',
      error: 'Published page data is unavailable.'
    });
  });

  it('returns publication-error for a cross-page target', async () => {
    const selected = revision('website-1', 'page-2', 'revision-cross-page');
    const brokenTarget = target('website-1', 'page-1', selected.id);
    const result = await loadBuilderPublicRevision(
      storageWith(snapshot([selected], [brokenTarget])), 'website-1', 'page-1'
    );
    expect(result.state).toBe('publication-error');
  });

  it('returns publication-error for a cross-website target', async () => {
    const selected = revision('website-2', 'page-1', 'revision-cross-website');
    const brokenTarget = target('website-1', 'page-1', selected.id);
    const result = await loadBuilderPublicRevision(
      storageWith(snapshot([selected], [brokenTarget])), 'website-1', 'page-1'
    );
    expect(result.state).toBe('publication-error');
  });

  it('returns publication-error for an invalid revision fingerprint', async () => {
    const value = snapshot();
    value.revisions[0].document_fingerprint = 'tampered';
    const result = await loadBuilderPublicRevision(
      storageWith(value), 'website-1', 'page-1'
    );
    expect(result.state).toBe('publication-error');
  });

  it('returns a safe publication-error for storage read exceptions', async () => {
    const storage = new TrackingStorage();
    storage.readError = true;
    const result = await loadBuilderPublicRevision(storage, 'website-1', 'page-1');
    expect(result).toEqual({
      state: 'publication-error',
      error: 'Published page data is unavailable.'
    });
    expect(JSON.stringify(result)).not.toContain('private storage failure');
  });

  it('does not mutate inputs and honors a custom storage key', async () => {
    const websiteId = 'website-1';
    const pageId = 'page-1';
    const storageKey = 'custom-publication-key';
    const storage = storageWith(snapshot(), storageKey);
    await loadBuilderPublicRevision(storage, websiteId, pageId, storageKey);
    expect({ websiteId, pageId, storageKey }).toEqual({
      websiteId: 'website-1', pageId: 'page-1', storageKey: 'custom-publication-key'
    });
    expect(storage.reads).toBeGreaterThan(0);
  });

  it('preserves unknown sections and does not expose history', async () => {
    const result = await loadBuilderPublicRevision(
      storageWith(snapshot()), 'website-1', 'page-1'
    );
    expect(result.state).toBe('published');
    if (result.state !== 'published') return;
    expect(result.revision.document.sections[0]).toMatchObject({
      type: 'custom-unknown', variant: 'special', funnel_id: 'funnel-1'
    });
    expect(result.revision.document.sections[0].content.nested.value).toBe(7);
    expect(Object.keys(result).sort()).toEqual(['revision', 'state', 'target']);
    expect(result).not.toHaveProperty('items');
    expect(result).not.toHaveProperty('history');
  });
});
