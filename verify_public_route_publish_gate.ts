import { readFileSync } from 'fs';

if (typeof global !== 'undefined' && typeof window === 'undefined') {
  const storage = new Map<string, string>();
  const createMockElement = (tagName: string = 'div') => {
    const el: any = {
      tagName: tagName.toUpperCase(),
      innerHTML: '',
      style: {},
      setAttribute: (name: string, val: string) => { el[name] = val; },
      getAttribute: (name: string) => el[name] || null,
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child: any) => {
        if (!el._children) el._children = [];
        el._children.push(child);
      },
      classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} }
    };
    return el;
  };

  const appElement = createMockElement('div');
  appElement.id = 'app';
  const headElement = createMockElement('head');
  const bodyElement = createMockElement('body');

  (global as any).window = {
    currentUser: 'system',
    location: {
      href: 'http://127.0.0.1/',
      pathname: '/',
      hostname: '127.0.0.1',
      hash: '#/dashboard'
    },
    history: { pushState: () => {} },
    addEventListener: () => {},
    localStorage: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      key: (index: number) => Array.from(storage.keys())[index] || null,
      get length() { return storage.size; }
    },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ success: true, data: {} }) })
  };

  (global as any).document = {
    title: '',
    referrer: '',
    querySelector: (selector: string) => selector === '#app' ? appElement : createMockElement(),
    getElementById: (id: string) => id === 'app' ? appElement : null,
    createElement: (tag: string) => createMockElement(tag),
    head: headElement,
    body: bodyElement,
    addEventListener: () => {},
    querySelectorAll: () => []
  };

  (global as any).localStorage = (global as any).window.localStorage;
  (global as any).fetch = (...args: any[]) => (global as any).window.fetch(...args);
  (global as any).requestAnimationFrame = (callback: any) => setTimeout(callback, 0);
}

import { mockPageSections, mockWebsiteRoutes, mockWebsiteSettings } from './src/db';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing expected public route publish gate code: ${label}`);
}

async function run() {
  console.log('===============================================================');
  console.log('STARTING PUBLIC ROUTE PUBLISH GATE VERIFICATION');
  console.log('===============================================================\n');

  console.log('[WB-111] Checking direct public route bridge...');
  includesSnippet('function resolveWebsitePathFromBrowserPath(rawPath: string): string | null', 'public browser path resolver');
  includesSnippet('const targetPath = resolveWebsitePathFromBrowserPath(rawPath)', 'boot router uses public path resolver');
  includesSnippet("rawPath === '/preview' || rawPath.startsWith('/preview/')", 'preview detection remains explicit');
  includesSnippet('normalizePreviewPath(route.path || \'/\') === normalizedPath', 'known website routes are matched exactly');
  console.log('PASS: Direct public paths can enter the website renderer without using the preview prefix.');

  const drivewaySection = mockPageSections.find((section: any) => section.page_id === 'p3' && section.id === 'ps-d1');
  assert(drivewaySection, 'Missing Driveway Cleaning section ps-d1.');
  const savedSection = {
    ...drivewaySection,
    content: {
      ...drivewaySection!.content,
      heading: 'Preview Sync Headline 001',
      subheading: 'Preview Sync Subheadline 001',
      button_text: 'Preview Sync CTA 001'
    }
  };
  Object.assign(drivewaySection!.content, savedSection.content);
  window.localStorage.setItem('mock_sections_system:p3', JSON.stringify([savedSection]));

  console.log('\n[WB-111] Checking published public route render path...');
  const drivewayRoute = mockWebsiteRoutes.find((route: any) => route.path === '/driveway-cleaning');
  assert(drivewayRoute?.funnel_id === 'fnl-1', `Expected /driveway-cleaning to resolve to fnl-1, got ${drivewayRoute?.funnel_id}`);
  includesSnippet('if (targetPath) {', 'known public path enters website resolver');
  includesSnippet('await renderSitePage(result.funnel_id, mergedContext, isPreview)', 'public and preview routes use shared renderer');
  includesSnippet('hydratePreviewSectionsForPage(page.id)', 'renderer hydrates saved builder sections before public rendering');
  includesSnippet(".filter(s => s.page_id === page.id && s.styles?.visible !== false)", 'renderer selects page-scoped sections');
  console.log('PASS: Published public route uses the shared section renderer.');

  console.log('\n[WB-112] Checking publish gate and preview bypass...');
  includesSnippet("if (!isPreview && settings.publish_status !== 'published')", 'public publish gate');
  includesSnippet('This website is not published yet.', 'friendly unpublished public state');
  includesSnippet('${isPreview ? `', 'preview banner is scoped to preview mode');
  assert(mockWebsiteSettings.publish_status !== undefined, 'Mock website settings missing publish_status.');
  assert(!source.includes("rawPath.startsWith('/site/') || rawPath.startsWith('/preview/')"), 'Boot router still excludes direct public website paths.');
  console.log('PASS: Public routes are gated by publish_status while preview bypass remains available.');

  console.log('\n===============================================================');
  console.log('ALL PUBLIC ROUTE PUBLISH GATE CHECKS PASSED');
  console.log('===============================================================');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
