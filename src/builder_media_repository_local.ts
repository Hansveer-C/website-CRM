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
import { filterAndPageBuilderMediaAssets } from './builder_media_repository';

export interface BuilderMediaLocalRecord {
  asset: Omit<BuilderMediaAsset, 'publicUrl'>;
  blob: Blob;
}

export interface BuilderMediaLocalDatabase {
  put(record: BuilderMediaLocalRecord): Promise<void>;
  getAll(): Promise<readonly BuilderMediaLocalRecord[]>;
}

export interface BuilderMediaObjectUrlFactory {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface LocalBuilderMediaRepositoryOptions {
  userId: string;
  database: BuilderMediaLocalDatabase;
  decodeDimensions?: BuilderMediaDimensionDecoder;
  objectUrls?: BuilderMediaObjectUrlFactory;
  now?: () => Date;
  createId?: () => string;
}

const DB_NAME = 'pressure-wash-builder-media';
const STORE_NAME = 'assets';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export class IndexedDbBuilderMediaDatabase implements BuilderMediaLocalDatabase {
  private readonly openDatabase: () => Promise<IDBDatabase>;

  constructor(indexedDb: IDBFactory = globalThis.indexedDB) {
    if (!indexedDb) throw new Error('IndexedDB is unavailable.');
    this.openDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'asset.id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    });
  }

  async put(record: BuilderMediaLocalRecord): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      await requestResult(transaction.objectStore(STORE_NAME).put(record));
    } finally {
      database.close();
    }
  }

  async getAll(): Promise<readonly BuilderMediaLocalRecord[]> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      return await requestResult(transaction.objectStore(STORE_NAME).getAll()) as BuilderMediaLocalRecord[];
    } finally {
      database.close();
    }
  }
}

export class LocalBuilderMediaRepository implements BuilderMediaRepository {
  private readonly userId: string;
  private readonly database: BuilderMediaLocalDatabase;
  private readonly decodeDimensions?: BuilderMediaDimensionDecoder;
  private readonly objectUrls: BuilderMediaObjectUrlFactory;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly activeUrls = new Map<string, string>();

  constructor(options: LocalBuilderMediaRepositoryOptions) {
    if (!options.userId.trim()) throw new Error('Local media repository requires a user ID.');
    this.userId = options.userId;
    this.database = options.database;
    this.decodeDimensions = options.decodeDimensions;
    this.objectUrls = options.objectUrls ?? URL;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  private publicUrl(record: BuilderMediaLocalRecord): string {
    const existing = this.activeUrls.get(record.asset.id);
    if (existing) return existing;
    const next = this.objectUrls.createObjectURL(record.blob);
    this.activeUrls.set(record.asset.id, next);
    return next;
  }

  async listAssets(websiteId: string, options: BuilderMediaListOptions = {}) {
    const records = await this.database.getAll();
    const assets = records
      .filter(record => record.asset.userId === this.userId && record.asset.websiteId === websiteId)
      .map(record => freezeBuilderMediaAsset({ ...structuredClone(record.asset), publicUrl: this.publicUrl(record) }));
    return filterAndPageBuilderMediaAssets(assets, options);
  }

  async uploadAsset(input: BuilderMediaUploadInput): Promise<BuilderMediaAsset> {
    const validation = await validateBuilderMediaFile(input.file, this.decodeDimensions);
    const id = this.createId();
    const timestamp = this.now().toISOString();
    const assetWithoutUrl: Omit<BuilderMediaAsset, 'publicUrl'> = {
      id,
      userId: this.userId,
      websiteId: input.websiteId,
      bucketId: BUILDER_MEDIA_BUCKET,
      objectPath: createBuilderMediaObjectPath(
        this.userId,
        input.websiteId,
        id,
        validation.extension
      ),
      displayName: sanitizeBuilderMediaDisplayName(input.displayName),
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
      width: validation.width,
      height: validation.height,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const record = { asset: structuredClone(assetWithoutUrl), blob: input.file.slice() };
    await this.database.put(record);
    return freezeBuilderMediaAsset({ ...structuredClone(assetWithoutUrl), publicUrl: this.publicUrl(record) });
  }

  dispose(): void {
    this.activeUrls.forEach(url => this.objectUrls.revokeObjectURL(url));
    this.activeUrls.clear();
  }
}
