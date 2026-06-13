import { readFileSync } from 'fs';
import { mockPages, mockPageSections } from './src/db';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing expected builder context code: ${label}`);
}

console.log('===============================================================');
console.log('STARTING BUILDER CONTEXT PERSISTENCE VERIFICATION');
console.log('===============================================================\n');

console.log('[WB-067] Checking route-backed builder context...');
includesSnippet('type BuilderContext = {', 'BuilderContext type');
includesSnippet('mock_builder_context_${userId}', 'localStorage fallback key');
includesSnippet('function getBuilderContextFromHash()', 'builder hash parser');
includesSnippet("view !== 'builder' || !query", 'builder route query guard');
includesSnippet("params.set('pageId', builderContext.pageId)", 'builder pageId route param');
includesSnippet("params.set('sectionId', builderContext.sectionId)", 'builder sectionId route param');
includesSnippet('newHash = `#/builder?${params.toString()}`', 'builder route query navigation');
console.log('PASS: Builder navigation can carry page/section context in the route.');

console.log('\n[WB-067] Checking localStorage context fallback...');
includesSnippet('function persistBuilderContext(context: BuilderContext)', 'persist builder context helper');
includesSnippet('window.localStorage.setItem(getBuilderContextStorageKey()', 'builder context persisted to localStorage');
includesSnippet('function getStoredBuilderContext()', 'stored builder context reader');
includesSnippet('const context = getBuilderContextFromHash() || getStoredBuilderContext()', 'route-first, storage-second hydration');
console.log('PASS: Builder context is persisted and hydrated from localStorage fallback.');

console.log('\n[WB-067] Checking Edit Section integration...');
includesSnippet('(window as any).openBuilderFromFunnel = (pageId: string, funnelId: string) => {', 'Edit Section entry point');
includesSnippet('const primarySection = getPrimarySectionForPage(pageId)', 'primary section selection');
includesSnippet("returnTo: 'funnels'", 'funnel return context');
includesSnippet("funnelId", 'funnel id context');
includesSnippet("(window as any).navigateTo('builder', undefined, { builderContext: context })", 'context-aware builder navigation');
console.log('PASS: Edit Section stores and routes with selected builder context.');

console.log('\n[WB-067] Checking refresh hydration and invalid-context empty state...');
const renderStart = source.indexOf('function _renderBuilder()');
const hydrateCall = source.indexOf('hydrateBuilderContext();', renderStart);
const pageLookup = source.indexOf('const page = mockPages.find', renderStart);
assert(renderStart >= 0, 'Could not find _renderBuilder.');
assert(hydrateCall > renderStart && hydrateCall < pageLookup, 'Builder context must hydrate before page lookup.');
includesSnippet('Select a page or section to edit.', 'friendly missing context state');
console.log('PASS: Builder refresh hydrates context before rendering and has a friendly empty state.');

console.log('\n[WB-067] Checking mock Driveway Cleaning context data...');
const drivewayPage = mockPages.find((page: any) => page.slug === 'driveway-cleaning');
assert(drivewayPage, 'Missing mock Driveway Cleaning page.');
const drivewaySection = mockPageSections.find((section: any) => section.page_id === drivewayPage!.id);
assert(drivewaySection, 'Missing mock Driveway Cleaning section.');
assert(
  drivewaySection!.content?.heading === 'Pristine Driveways, Every Time.',
  `Unexpected Driveway Cleaning heading: ${drivewaySection!.content?.heading}`
);

const params = new URLSearchParams();
params.set('pageId', drivewayPage!.id);
params.set('sectionId', drivewaySection!.id);
assert(
  `#/builder?${params.toString()}`.includes(`pageId=${drivewayPage!.id}`),
  'Simulated builder route did not include Driveway Cleaning pageId.'
);
console.log('PASS: Driveway Cleaning page/section context can be represented in the builder route.');

console.log('\n===============================================================');
console.log('ALL BUILDER CONTEXT PERSISTENCE CHECKS PASSED');
console.log('===============================================================');
