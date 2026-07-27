import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BuilderMediaAsset,
  BuilderMediaDimensionDecoder,
  BuilderMediaListOptions,
  BuilderMediaUploadInput
} from './builder_media_asset';
import {
  BUILDER_MEDIA_BUCKET,
  createBuilderMediaObjectPath,
  freezeBuilderMediaAsset,
  sanitizeBuilderMediaDisplayName,
  validateBuilderMediaFile
} from './builder_media_asset';
import type { BuilderMediaRepository } from './builder_media_repository';

interface BuilderMediaAssetRow {
  id: string;
  user_id: string;
  website_id: string;
  bucket_id: string;
  object_path: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface SupabaseBuilderMediaRepositoryOptions {
  client: SupabaseClient;
  decodeDimensions?: BuilderMediaDimensionDecoder;
  createId?: () => string;
}

function mapRow(client: SupabaseClient, row: BuilderMediaAssetRow): BuilderMediaAsset {
  if (
    !row
    || typeof row.id !== 'string'
    || typeof row.user_id !== 'string'
    || typeof row.website_id !== 'string'
    || row.bucket_id !== BUILDER_MEDIA_BUCKET
    || typeof row.object_path !== 'string'
    || typeof row.display_name !== 'string'
    || !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime_type)
    || !Number.isFinite(Number(row.size_bytes))
    || !Number.isInteger(row.width)
    || !Number.isInteger(row.height)
    || !Number.isFinite(Date.parse(row.created_at))
    || !Number.isFinite(Date.parse(row.updated_at))
  ) {
    throw new Error('BUILDER_MEDIA_INVALID_ROW');
  }
  const { data } = client.storage.from(row.bucket_id).getPublicUrl(row.object_path);
  if (!data.publicUrl || /[?&](token|apikey|signature)=/i.test(data.publicUrl)) {
    throw new Error('BUILDER_MEDIA_INVALID_PUBLIC_URL');
  }
  return freezeBuilderMediaAsset({
    id: row.id,
    userId: row.user_id,
    websiteId: row.website_id,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    publicUrl: data.publicUrl,
    displayName: row.display_name,
    mimeType: row.mime_type as BuilderMediaAsset['mimeType'],
    sizeBytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export class SupabaseBuilderMediaRepository implements BuilderMediaRepository {
  private readonly client: SupabaseClient;
  private readonly decodeDimensions?: BuilderMediaDimensionDecoder;
  private readonly createId: () => string;
  private readonly pendingUploads = new WeakMap<Blob, Map<string, Promise<BuilderMediaAsset>>>();

  constructor(options: SupabaseBuilderMediaRepositoryOptions) {
    this.client = options.client;
    this.decodeDimensions = options.decodeDimensions;
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  private async authenticatedUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error('BUILDER_MEDIA_UNAUTHENTICATED');
    return data.user.id;
  }

  private async assertWebsiteOwnership(websiteId: string, userId: string): Promise<void> {
    const { data, error } = await this.client
      .from('websites')
      .select('id')
      .eq('id', websiteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('BUILDER_MEDIA_WEBSITE_LOOKUP_FAILED');
    if (!data) throw new Error('BUILDER_MEDIA_WEBSITE_FORBIDDEN');
  }

  async listAssets(websiteId: string, options: BuilderMediaListOptions = {}) {
    const userId = await this.authenticatedUserId();
    await this.assertWebsiteOwnership(websiteId, userId);
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 40), 1), 100);
    let query = this.client
      .from('builder_media_assets')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (options.search?.trim()) {
      const search = options.search.trim().replace(/[\\%_]/g, character => `\\${character}`);
      query = query.ilike('display_name', `%${search}%`);
    }
    const offset = options.cursor && /^\d+$/.test(options.cursor) ? Number(options.cursor) : 0;
    query = query.range(offset, offset + limit);
    const { data, error } = await query;
    if (error) throw new Error('BUILDER_MEDIA_LIST_FAILED');
    const rows = (data ?? []) as BuilderMediaAssetRow[];
    const items = rows.slice(0, limit).map(row => mapRow(this.client, row));
    return {
      items,
      ...(rows.length > limit && items.length > 0
        ? { nextCursor: String(offset + limit) }
        : {})
    };
  }

  uploadAsset(input: BuilderMediaUploadInput): Promise<BuilderMediaAsset> {
    const key = input.websiteId;
    let pendingByWebsite = this.pendingUploads.get(input.file);
    if (!pendingByWebsite) {
      pendingByWebsite = new Map();
      this.pendingUploads.set(input.file, pendingByWebsite);
    }
    const existing = pendingByWebsite.get(key);
    if (existing) return existing;
    const promise = this.performUpload(input).finally(() => {
      pendingByWebsite?.delete(key);
      if (pendingByWebsite?.size === 0) this.pendingUploads.delete(input.file);
    });
    pendingByWebsite.set(key, promise);
    return promise;
  }

  private async performUpload(input: BuilderMediaUploadInput): Promise<BuilderMediaAsset> {
    const userId = await this.authenticatedUserId();
    await this.assertWebsiteOwnership(input.websiteId, userId);
    const validation = await validateBuilderMediaFile(input.file, this.decodeDimensions);
    const id = this.createId();
    const objectPath = createBuilderMediaObjectPath(
      userId,
      input.websiteId,
      id,
      validation.extension
    );
    const bucket = this.client.storage.from(BUILDER_MEDIA_BUCKET);
    const upload = await bucket.upload(
      objectPath,
      input.file,
      { contentType: validation.mimeType, upsert: false }
    );
    let uploadedThisAttempt = !upload.error;
    if (upload.error) {
      try {
        const existing = await this.client
          .from('builder_media_assets')
          .select('*')
          .eq('id', id)
          .eq('website_id', input.websiteId)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) {
          const asset = mapRow(this.client, existing.data as BuilderMediaAssetRow);
          if (asset.objectPath !== objectPath || asset.userId !== userId) {
            throw new Error('BUILDER_MEDIA_ASSET_CONFLICT');
          }
          return asset;
        }

        const folder = `${userId}/${input.websiteId}`;
        const expectedName = objectPath.slice(folder.length + 1);
        const listed = await bucket.list(folder, { search: expectedName, limit: 2 });
        if (listed.error || !listed.data?.some(item => item.name === expectedName)) {
          throw new Error('BUILDER_MEDIA_UPLOAD_FAILED');
        }
        uploadedThisAttempt = false;
      } catch (error) {
        if (error instanceof Error && error.message === 'BUILDER_MEDIA_ASSET_CONFLICT') throw error;
        throw new Error('BUILDER_MEDIA_UPLOAD_FAILED');
      }
    }

    const insert = await this.client
      .from('builder_media_assets')
      .insert({
        id,
        user_id: userId,
        website_id: input.websiteId,
        bucket_id: BUILDER_MEDIA_BUCKET,
        object_path: objectPath,
        display_name: sanitizeBuilderMediaDisplayName(input.displayName),
        mime_type: validation.mimeType,
        size_bytes: validation.sizeBytes,
        width: validation.width,
        height: validation.height
      })
      .select('*')
      .single();
    if (insert.error || !insert.data) {
      try {
        const existing = await this.client
          .from('builder_media_assets')
          .select('*')
          .eq('id', id)
          .eq('website_id', input.websiteId)
          .maybeSingle();
        if (!existing.error && existing.data) {
          const asset = mapRow(this.client, existing.data as BuilderMediaAssetRow);
          if (asset.objectPath === objectPath && asset.userId === userId) return asset;
          throw new Error('BUILDER_MEDIA_ASSET_CONFLICT');
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'BUILDER_MEDIA_ASSET_CONFLICT') throw error;
      }
      if (uploadedThisAttempt) await bucket.remove([objectPath]);
      throw new Error('BUILDER_MEDIA_METADATA_FAILED');
    }
    return mapRow(this.client, insert.data as BuilderMediaAssetRow);
  }
}
