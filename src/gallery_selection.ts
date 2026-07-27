import type { GalleryItem } from './types';

export type GalleryDesignItem = Record<string, unknown>;
export type GallerySelectionItem = Record<string, unknown>;

function normalizedTarget(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s_-]+/g, '-')
    : '';
}

function stableGalleryOrder(
  items: readonly Partial<GalleryItem>[]
): Partial<GalleryItem>[] {
  return items
    .map((item, inputIndex) => ({ item, inputIndex }))
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.item.sort_order) ? left.item.sort_order as number : 0;
      const rightOrder = Number.isFinite(right.item.sort_order) ? right.item.sort_order as number : 0;
      return leftOrder - rightOrder || left.inputIndex - right.inputIndex;
    })
    .map(({ item }) => item);
}

/**
 * Selects from the caller's already owner-scoped legacy gallery records.
 * Builder media assets are intentionally not accepted by this compatibility helper.
 */
export function selectGalleryItemsForPage(
  persistedItems: readonly Partial<GalleryItem>[],
  designTimeItems: readonly GalleryDesignItem[],
  serviceType: string,
  city: string
): GallerySelectionItem[] {
  const ordered = stableGalleryOrder(persistedItems);
  if (ordered.length === 0) return designTimeItems.map(item => ({ ...item }));

  const service = normalizedTarget(serviceType);
  const location = normalizedTarget(city);
  const exact = ordered.filter(item => (
    service !== '' && location !== ''
    && normalizedTarget(item.service_type) === service
    && normalizedTarget(item.city) === location
  ));
  if (exact.length > 0) return exact as GallerySelectionItem[];

  const serviceMatches = ordered.filter(item => (
    service !== '' && normalizedTarget(item.service_type) === service
  ));
  if (serviceMatches.length > 0) return serviceMatches as GallerySelectionItem[];

  const cityMatches = ordered.filter(item => (
    location !== '' && normalizedTarget(item.city) === location
  ));
  if (cityMatches.length > 0) return cityMatches as GallerySelectionItem[];

  const featured = ordered.filter(item => item.is_featured === true);
  return (featured.length > 0 ? featured : ordered) as GallerySelectionItem[];
}
