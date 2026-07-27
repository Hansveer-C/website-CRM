import type {
  BuilderMediaAsset,
  BuilderMediaAssetPage,
  BuilderMediaListOptions,
  BuilderMediaUploadInput
} from './builder_media_asset';

export interface BuilderMediaRepository {
  listAssets(
    websiteId: string,
    options?: BuilderMediaListOptions
  ): Promise<BuilderMediaAssetPage>;
  uploadAsset(input: BuilderMediaUploadInput): Promise<BuilderMediaAsset>;
  dispose?(): void;
}

export function compareBuilderMediaAssets(
  left: BuilderMediaAsset,
  right: BuilderMediaAsset
): number {
  const dateDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return dateDifference || right.id.localeCompare(left.id);
}

export function filterAndPageBuilderMediaAssets(
  assets: readonly BuilderMediaAsset[],
  options: BuilderMediaListOptions = {}
): BuilderMediaAssetPage {
  const search = options.search?.trim().toLocaleLowerCase() ?? '';
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 40), 1), 100);
  const ordered = assets
    .filter(asset => !search || asset.displayName.toLocaleLowerCase().includes(search))
    .slice()
    .sort(compareBuilderMediaAssets);
  const start = options.cursor
    ? Math.max(ordered.findIndex(asset => asset.id === options.cursor) + 1, 0)
    : 0;
  const items = ordered.slice(start, start + limit);
  return {
    items,
    ...(start + limit < ordered.length && items.length > 0
      ? { nextCursor: items[items.length - 1].id }
      : {})
  };
}
