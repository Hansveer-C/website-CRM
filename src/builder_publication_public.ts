import type { BuilderPublishedRevision } from './builder_publication';
import type { BuilderPublicationTarget } from './builder_publication_repository';
import {
  LocalStorageBuilderPublicationRepository,
  type BuilderPublicationStorage
} from './builder_publication_repository_local';

export type BuilderPublicRevisionLoadResult =
  | { state: 'not-published' }
  | {
    state: 'published';
    revision: BuilderPublishedRevision;
    target: BuilderPublicationTarget;
  }
  | { state: 'publication-error'; error: string };

const PUBLIC_READ_USER = 'builder-public-read';
const SAFE_PUBLICATION_ERROR = 'Published page data is unavailable.';

export async function loadBuilderPublicRevision(
  storage: BuilderPublicationStorage,
  websiteId: string,
  pageId: string,
  storageKey?: string
): Promise<BuilderPublicRevisionLoadResult> {
  try {
    const repository = new LocalStorageBuilderPublicationRepository({
      storage,
      canAccessPage: (_user, requestedWebsiteId, requestedPageId) => (
        requestedWebsiteId === websiteId && requestedPageId === pageId
      ),
      ...(storageKey === undefined ? {} : { storageKey })
    });

    const targetResult = await repository.getPublicationTarget(
      websiteId,
      pageId,
      PUBLIC_READ_USER
    );
    if (!targetResult.success) {
      return { state: 'publication-error', error: SAFE_PUBLICATION_ERROR };
    }
    if (!targetResult.data) return { state: 'not-published' };

    const revisionResult = await repository.getPublishedRevisionForPage(
      websiteId,
      pageId,
      PUBLIC_READ_USER
    );
    if (!revisionResult.success || !revisionResult.data) {
      return { state: 'publication-error', error: SAFE_PUBLICATION_ERROR };
    }

    const target = targetResult.data;
    const revision = revisionResult.data;
    if (
      target.websiteId !== websiteId
      || target.pageId !== pageId
      || revision.websiteId !== websiteId
      || revision.pageId !== pageId
      || target.publishedRevisionId !== revision.id
    ) {
      return { state: 'publication-error', error: SAFE_PUBLICATION_ERROR };
    }

    return { state: 'published', revision, target };
  } catch {
    return { state: 'publication-error', error: SAFE_PUBLICATION_ERROR };
  }
}
