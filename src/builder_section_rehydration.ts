import type { PageSection } from './types';

/**
 * Installs an authoritative persisted snapshot for one Builder page.
 * Sections belonging to every other page remain untouched.
 */
export function replaceBuilderPageSectionsForHydration(
  sections: PageSection[],
  pageId: string,
  persistedSections: readonly PageSection[]
): void {
  const hydratedSections = persistedSections
    .filter(section => section.page_id === pageId)
    .map(section => structuredClone(section));

  for (let index = sections.length - 1; index >= 0; index -= 1) {
    if (sections[index].page_id === pageId) sections.splice(index, 1);
  }
  sections.push(...hydratedSections);
}
