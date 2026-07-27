import { describe, expect, it } from 'vitest';
import type { GalleryItem } from './types';
import { selectGalleryItemsForPage } from './gallery_selection';

const records: Partial<GalleryItem>[] = [
  { id: 'later', service_type: 'house-washing', city: 'Seattle', sort_order: 2, is_featured: true },
  { id: 'exact', service_type: 'driveway-cleaning', city: 'Seattle', sort_order: 1 },
  { id: 'other-page-target', service_type: 'driveway-cleaning', city: 'Tacoma', sort_order: 3 }
];

describe('selectGalleryItemsForPage', () => {
  it('selects the exact normalized service and city deterministically', () => {
    expect(selectGalleryItemsForPage(records, [], 'Driveway Cleaning', 'seattle'))
      .toEqual([records[1]]);
  });

  it('does not leak a different page target when an exact target exists', () => {
    const selected = selectGalleryItemsForPage(records, [], 'driveway-cleaning', 'Seattle');
    expect(selected.map(item => item.id)).toEqual(['exact']);
  });

  it('uses featured legacy records before the general stable fallback', () => {
    expect(selectGalleryItemsForPage(records, [], 'roof-cleaning', 'Portland'))
      .toEqual([records[0]]);
  });

  it('uses independent design-time records only when no persisted records exist', () => {
    const design = [{ label: 'Design item', nested: { value: 1 } }];
    const selected = selectGalleryItemsForPage([], design, '', '');
    expect(selected).toEqual(design);
    expect(selected).not.toBe(design);
  });
});
