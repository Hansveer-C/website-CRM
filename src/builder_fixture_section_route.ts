export type BuilderFixtureSectionRouteKind = 'save' | 'revision';

export interface BuilderFixtureSectionRoute {
  kind: BuilderFixtureSectionRouteKind;
  pageId: string | null;
}

/** Resolves only the literal browser-fixture routes used by the save clients. */
export function resolveBuilderFixtureSectionRoute(
  requestUrl: string,
  method: string,
  origin: string
): BuilderFixtureSectionRoute | null {
  const parsed = new URL(requestUrl, origin);
  const normalizedMethod = method.toUpperCase();
  const kind = parsed.pathname === '/api/page-sections' && normalizedMethod === 'PUT'
    ? 'save'
    : parsed.pathname === '/api/page-section-save-revision' && normalizedMethod === 'GET'
      ? 'revision'
      : null;

  if (!kind) return null;
  const pageId = parsed.searchParams.get('pageId');
  return { kind, pageId: pageId?.trim() ? pageId : null };
}
