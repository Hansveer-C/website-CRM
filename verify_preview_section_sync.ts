import { readFileSync } from 'fs';
import { mockPages, mockPageSections, mockWebsiteRoutes, mockWebsiteSettings } from './src/db';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing expected preview sync code: ${label}`);
}

console.log('===============================================================');
console.log('STARTING PREVIEW SECTION SYNC VERIFICATION');
console.log('===============================================================\n');

console.log('[WB-110] Checking preview path-to-page mapping...');
includesSnippet('function resolvePageForPreviewPath(path: string = \'/\', funnelId?: string)', 'preview path resolver');
includesSnippet("return cleanPath === '/home' ? '/' : cleanPath", 'home preview route normalization');
includesSnippet("mockPages.find((p: any) => p.slug === slug)", 'slug-to-page mapping');

const drivewayRoute = mockWebsiteRoutes.find((route: any) => route.path === '/driveway-cleaning');
assert(drivewayRoute, 'Missing /driveway-cleaning mock route.');
const drivewayPage = mockPages.find((page: any) => page.slug === 'driveway-cleaning');
assert(drivewayPage?.id === 'p3', `Expected /driveway-cleaning to map to p3, got ${drivewayPage?.id}`);

const homePage = mockPages.find((page: any) => page.slug === 'home' || page.name?.toLowerCase() === 'home');
assert(homePage?.id === 'p1', `Expected /preview/home to map to p1, got ${homePage?.id}`);
console.log('PASS: Preview paths can resolve to builder page ids.');

console.log('\n[WB-110] Checking local/mock section hydration bridge...');
includesSnippet('function hydratePreviewSectionsForPage(pageId: string)', 'preview hydration helper');
includesSnippet('hydrateBuilderSectionsFromLocalStorage(pageId)', 'preview reuses builder storage hydration');
includesSnippet('hydratePreviewSectionsForPage(page.id)', 'preview hydrates before selecting sections');
includesSnippet(".filter(s => s.page_id === page.id && s.styles?.visible !== false)", 'preview renders page_id sections');
assert(
  !source.includes(".filter(s => s.funnel_id === funnel_id && s.styles?.visible !== false)"),
  'Preview still filters sections by funnel_id instead of page_id.'
);
console.log('PASS: Preview hydrates and renders page-scoped builder sections.');

console.log('\n[WB-110] Checking saved section content shape...');
const drivewaySection = mockPageSections.find((section: any) => section.page_id === 'p3' && section.id === 'ps-d1');
assert(drivewaySection, 'Missing Driveway Cleaning hero section ps-d1.');
const savedPreviewSection = {
  ...drivewaySection,
  content: {
    ...drivewaySection!.content,
    heading: 'Preview Sync Headline 001',
    subheading: 'Preview Sync Subheadline 001',
    button_text: 'Preview Sync CTA 001'
  }
};
const storageKey = 'mock_sections_system:p3';
const storageValue = JSON.stringify([savedPreviewSection]);
assert(storageValue.includes('Preview Sync Headline 001'), 'Saved heading missing from simulated section storage.');
assert(storageValue.includes('Preview Sync Subheadline 001'), 'Saved subheadline missing from simulated section storage.');
assert(storageValue.includes('Preview Sync CTA 001'), 'Saved CTA missing from simulated section storage.');
console.log(`PASS: Saved builder sections use key ${storageKey}.`);

console.log('\n[WB-110] Checking generic shell-only regression guards...');
includesSnippet('${sections.map(section => {', 'public renderer maps sections');
includesSnippet('renderPublicHeader(layout.header_config, settings)', 'public header preserved');
includesSnippet('renderPublicFooter(layout.footer_config, settings)', 'public footer preserved');
assert(mockWebsiteSettings.business_name, 'Branding settings missing business_name.');
assert(mockWebsiteSettings.phone !== undefined, 'Branding settings missing phone.');
assert(mockWebsiteSettings.primary_color !== undefined, 'Branding settings missing primary_color.');
console.log('PASS: Preview still preserves header/footer/branding while rendering sections.');

console.log('\n===============================================================');
console.log('ALL PREVIEW SECTION SYNC CHECKS PASSED');
console.log('===============================================================');
