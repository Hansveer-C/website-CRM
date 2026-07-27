import type { BuilderPublishedRevision } from './builder_publication';
import {
  builderPublishedRevisionFromRow,
  builderPublishedRevisionToRow,
  InMemoryBuilderPublicationRepository
} from './builder_publication_repository';
import type {
  BuilderPublicationAccessResolver,
  BuilderPublicationHistoryPage,
  BuilderPublicationListOptions,
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishedRevisionRow,
  BuilderPublishRevisionInput,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
import type { RepoResponse, User } from './types';

export interface BuilderPublicationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageBuilderPublicationRepositoryOptions {
  storage: BuilderPublicationStorage;
  canAccessPage: BuilderPublicationAccessResolver;
  storageKey?: string;
}

export interface LocalBuilderPublicationSnapshot {
  schemaVersion: 1;
  revisions: BuilderPublishedRevisionRow[];
  targets: BuilderPublicationTarget[];
}

const DEFAULT_STORAGE_KEY = 'crm_builder_publications_v1';

interface LoadedSnapshot {
  snapshot: LocalBuilderPublicationSnapshot;
  repository: InMemoryBuilderPublicationRepository;
}

type LoadResult =
  | { success: true; data: LoadedSnapshot }
  | { success: false; response: RepoResponse<never> };

function persistenceFailure(error: string): RepoResponse<never> {
  return { success: false, error, code: 'PERSISTENCE_ERROR' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && Number.isFinite(Date.parse(value));
}

function compareRevisionRows(
  left: BuilderPublishedRevisionRow,
  right: BuilderPublishedRevisionRow
): number {
  const timeDifference = Date.parse(right.created_at) - Date.parse(left.created_at);
  if (timeDifference !== 0) return timeDifference;
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

function compareTargets(
  left: BuilderPublicationTarget,
  right: BuilderPublicationTarget
): number {
  if (left.websiteId !== right.websiteId) {
    return left.websiteId < right.websiteId ? -1 : 1;
  }
  if (left.pageId === right.pageId) return 0;
  return left.pageId < right.pageId ? -1 : 1;
}

function normalizeSnapshot(
  value: unknown,
  canAccessPage: BuilderPublicationAccessResolver
): LoadedSnapshot {
  if (!isRecord(value)) {
    throw new Error('Builder publication snapshot root must be an object.');
  }
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported builder publication snapshot schema version: ${String(value.schemaVersion)}.`);
  }
  if (!Array.isArray(value.revisions)) {
    throw new Error('Builder publication snapshot revisions must be an array.');
  }
  if (!Array.isArray(value.targets)) {
    throw new Error('Builder publication snapshot targets must be an array.');
  }

  const revisions: BuilderPublishedRevision[] = [];
  const revisionIds = new Set<string>();
  for (const candidate of value.revisions) {
    if (!isRecord(candidate)) {
      throw new Error('Builder publication snapshot contains a malformed revision row.');
    }
    const revision = builderPublishedRevisionFromRow(
      candidate as unknown as BuilderPublishedRevisionRow
    );
    if (revisionIds.has(revision.id)) {
      throw new Error(`Duplicate builder publication revision ID: ${revision.id}.`);
    }
    revisionIds.add(revision.id);
    revisions.push(revision);
  }

  const targets: BuilderPublicationTarget[] = [];
  const targetKeys = new Set<string>();
  for (const candidate of value.targets) {
    if (!isRecord(candidate)) {
      throw new Error('Builder publication snapshot contains a malformed target.');
    }

    const target = candidate as unknown as BuilderPublicationTarget;
    if (
      typeof target.websiteId !== 'string'
      || !target.websiteId.trim()
      || typeof target.pageId !== 'string'
      || !target.pageId.trim()
      || typeof target.publishedRevisionId !== 'string'
      || !target.publishedRevisionId.trim()
      || !isValidIsoDateTime(target.publishedAt)
      || (target.publishedBy !== undefined && typeof target.publishedBy !== 'string')
    ) {
      throw new Error('Builder publication snapshot contains a malformed target.');
    }

    const key = `${target.websiteId}\u0000${target.pageId}`;
    if (targetKeys.has(key)) {
      throw new Error(`Duplicate builder publication target: ${target.websiteId}/${target.pageId}.`);
    }
    targetKeys.add(key);

    const revision = revisions.find(item => item.id === target.publishedRevisionId);
    if (!revision) {
      throw new Error(
        `Builder publication target references missing revision: ${target.publishedRevisionId}.`
      );
    }
    if (revision.websiteId !== target.websiteId || revision.pageId !== target.pageId) {
      throw new Error(
        `Builder publication target revision scope mismatch: ${target.publishedRevisionId}.`
      );
    }

    targets.push(structuredClone(target));
  }

  const snapshot: LocalBuilderPublicationSnapshot = {
    schemaVersion: 1,
    revisions: revisions
      .map(builderPublishedRevisionToRow)
      .sort(compareRevisionRows),
    targets: targets
      .map(target => structuredClone(target))
      .sort(compareTargets)
  };

  return {
    snapshot,
    repository: new InMemoryBuilderPublicationRepository({
      canAccessPage,
      revisions,
      targets
    })
  };
}

function emptySnapshot(): LocalBuilderPublicationSnapshot {
  return { schemaVersion: 1, revisions: [], targets: [] };
}

export class LocalStorageBuilderPublicationRepository
implements BuilderPublicationRepository {
  private readonly storage: BuilderPublicationStorage;
  private readonly canAccessPage: BuilderPublicationAccessResolver;
  private readonly storageKey: string;

  constructor(options: LocalStorageBuilderPublicationRepositoryOptions) {
    if (
      !options
      || !options.storage
      || typeof options.storage.getItem !== 'function'
      || typeof options.storage.setItem !== 'function'
      || typeof options.storage.removeItem !== 'function'
    ) {
      throw new Error('LocalStorageBuilderPublicationRepository requires storage.');
    }
    if (typeof options.canAccessPage !== 'function') {
      throw new Error('LocalStorageBuilderPublicationRepository requires canAccessPage.');
    }

    const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    if (typeof storageKey !== 'string' || !storageKey.trim()) {
      throw new Error('LocalStorageBuilderPublicationRepository storageKey must not be blank.');
    }

    this.storage = options.storage;
    this.canAccessPage = options.canAccessPage;
    this.storageKey = storageKey;
  }

  private load(): LoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch {
      return {
        success: false,
        response: persistenceFailure('LOCAL_PUBLICATION_STORAGE_READ_FAILED')
      };
    }

    if (raw === null || !raw.trim()) {
      return {
        success: true,
        data: normalizeSnapshot(emptySnapshot(), this.canAccessPage)
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        response: persistenceFailure('LOCAL_PUBLICATION_STORAGE_CORRUPT')
      };
    }

    try {
      return {
        success: true,
        data: normalizeSnapshot(parsed, this.canAccessPage)
      };
    } catch {
      return {
        success: false,
        response: persistenceFailure('LOCAL_PUBLICATION_STORAGE_CORRUPT')
      };
    }
  }

  private persist(snapshot: LocalBuilderPublicationSnapshot): RepoResponse<never> | null {
    let normalized: LocalBuilderPublicationSnapshot;
    try {
      normalized = normalizeSnapshot(snapshot, this.canAccessPage).snapshot;
    } catch {
      return persistenceFailure('LOCAL_PUBLICATION_SNAPSHOT_INVALID');
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(normalized));
      return null;
    } catch {
      return persistenceFailure('LOCAL_PUBLICATION_STORAGE_WRITE_FAILED');
    }
  }

  async createRevision(
    revision: BuilderPublishedRevision,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;

    const result = await loaded.data.repository.createRevision(revision, user);
    if (!result.success || !result.data) return result;

    const nextSnapshot: LocalBuilderPublicationSnapshot = {
      schemaVersion: 1,
      revisions: [
        ...loaded.data.snapshot.revisions.map(row => structuredClone(row)),
        builderPublishedRevisionToRow(result.data)
      ],
      targets: loaded.data.snapshot.targets.map(target => structuredClone(target))
    };
    const failure = this.persist(nextSnapshot);
    return failure ?? result;
  }

  async getRevisionById(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;
    return loaded.data.repository.getRevisionById(revisionId, user);
  }

  async listRevisionsForPage(
    websiteId: string,
    pageId: string,
    user: User | string,
    options?: BuilderPublicationListOptions
  ): Promise<RepoResponse<BuilderPublicationHistoryPage>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;
    return loaded.data.repository.listRevisionsForPage(
      websiteId,
      pageId,
      user,
      options
    );
  }

  async getPublishedRevisionForPage(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishedRevision | null>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;
    return loaded.data.repository.getPublishedRevisionForPage(
      websiteId,
      pageId,
      user
    );
  }

  async getPublicationTarget(
    websiteId: string,
    pageId: string,
    user: User | string
  ): Promise<RepoResponse<BuilderPublicationTarget | null>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;
    return loaded.data.repository.getPublicationTarget(websiteId, pageId, user);
  }

  async publishRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    return this.updateTarget('publish', input, user);
  }

  async rollbackToRevision(
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    return this.updateTarget('rollback', input, user);
  }

  private async updateTarget(
    operation: 'publish' | 'rollback',
    input: BuilderPublishRevisionInput,
    user: User | string
  ): Promise<RepoResponse<BuilderPublishRevisionResult>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;

    const result = operation === 'publish'
      ? await loaded.data.repository.publishRevision(input, user)
      : await loaded.data.repository.rollbackToRevision(input, user);
    if (!result.success || !result.data) return result;

    const target = result.data.target;
    const nextSnapshot: LocalBuilderPublicationSnapshot = {
      schemaVersion: 1,
      revisions: loaded.data.snapshot.revisions.map(row => structuredClone(row)),
      targets: [
        ...loaded.data.snapshot.targets
          .filter(existing => (
            existing.websiteId !== target.websiteId || existing.pageId !== target.pageId
          ))
          .map(existing => structuredClone(existing)),
        structuredClone(target)
      ]
    };
    const failure = this.persist(nextSnapshot);
    return failure ?? result;
  }

  async deleteRevisionIfUnpublished(
    revisionId: string,
    user: User | string
  ): Promise<RepoResponse<{ id: string }>> {
    const loaded = this.load();
    if (!loaded.success) return loaded.response;

    const result = await loaded.data.repository.deleteRevisionIfUnpublished(
      revisionId,
      user
    );
    if (!result.success || !result.data) return result;

    const nextSnapshot: LocalBuilderPublicationSnapshot = {
      schemaVersion: 1,
      revisions: loaded.data.snapshot.revisions
        .filter(row => row.id !== result.data?.id)
        .map(row => structuredClone(row)),
      targets: loaded.data.snapshot.targets.map(target => structuredClone(target))
    };
    const failure = this.persist(nextSnapshot);
    return failure ?? result;
  }
}
