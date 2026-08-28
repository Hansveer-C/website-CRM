import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PageSection } from './types';
import { replaceBuilderPageSectionsForHydration } from './builder_section_rehydration';

function section(
  id: string,
  pageId: string,
  order: number,
  overrides: Partial<PageSection> = {}
): PageSection {
  return {
    id,
    page_id: pageId,
    type: 'faq',
    content: { items: [{ question: id, answer: 'answer' }] },
    order,
    styles: { visible: true, background: '#ffffff' },
    variant: 'accordion',
    ...overrides
  };
}

describe('Builder page-section authoritative rehydration', () => {
  it('replaces stale target-page sections with the exact non-empty snapshot', () => {
    const store = [section('A', 'page-1', 0), section('B', 'page-1', 1), section('C', 'page-1', 2)];
    const snapshot = [
      section('B', 'page-1', 0, { content: { items: [{ question: 'persisted B', answer: 'B' }] } }),
      section('D', 'page-1', 1, { styles: { visible: false }, variant: 'split' })
    ];

    replaceBuilderPageSectionsForHydration(store, 'page-1', snapshot);

    expect(store.map(item => item.id)).toEqual(['B', 'D']);
    expect(store.map(item => item.order)).toEqual([0, 1]);
    expect(store[0].content).toEqual(snapshot[0].content);
    expect(store[1]).toMatchObject({ styles: { visible: false }, variant: 'split' });
  });

  it('honors an authoritative empty snapshot', () => {
    const store = [section('ps-p1', 'page-1', 0), section('other', 'page-2', 0)];

    replaceBuilderPageSectionsForHydration(store, 'page-1', []);

    expect(store).toEqual([section('other', 'page-2', 0)]);
  });

  it('preserves every unrelated page section', () => {
    const pageTwo = [section('other-a', 'page-2', 0), section('other-b', 'page-2', 1)];
    const store = [section('stale', 'page-1', 0), ...structuredClone(pageTwo)];

    replaceBuilderPageSectionsForHydration(store, 'page-1', [section('persisted', 'page-1', 0)]);

    expect(store.filter(item => item.page_id === 'page-1').map(item => item.id)).toEqual(['persisted']);
    expect(store.filter(item => item.page_id === 'page-2')).toEqual(pageTwo);
  });

  it('is idempotent and preserves IDs, order, content, styles, and variant', () => {
    const snapshot = [
      section('faq-1', 'page-1', 0),
      section('gallery-1', 'page-1', 1, {
        type: 'gallery',
        content: { items: [{ before: 'before.jpg', after: 'after.jpg' }] },
        styles: { visible: false, padding: '40px' },
        variant: 'grid'
      })
    ];
    const store = [section('stale', 'page-1', 0)];

    replaceBuilderPageSectionsForHydration(store, 'page-1', snapshot);
    const firstHydration = structuredClone(store);
    replaceBuilderPageSectionsForHydration(store, 'page-1', snapshot);

    expect(store).toEqual(firstHydration);
    expect(store).not.toBe(snapshot);
    expect(store[1].content).not.toBe(snapshot[1].content);
  });

  it('keeps missing-snapshot fallback distinct from a present empty snapshot in the active path', () => {
    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
    const hydration = main.slice(
      main.indexOf('function hydrateBuilderSectionsFromLocalStorage'),
      main.indexOf('function getBuilderContextStorageKey')
    );

    expect(hydration).toContain('if (cached === null) return;');
    expect(hydration).toContain('replaceBuilderPageSectionsForHydration(mockPageSections, pageId, sections);');
    expect(hydration).not.toContain('findIndex');
  });
});
