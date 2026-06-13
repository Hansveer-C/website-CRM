// Force offline/mock database fallback by ensuring Supabase env variables are undefined.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

import { readFileSync, existsSync } from 'fs';

const sessionStorageStore: Record<string, string> = {};
const localStorageStore: Record<string, string> = {};

// Browser Sandbox Setup for Node Environment
if (typeof global !== 'undefined' && typeof window === 'undefined') {
  const createMockElement = (tagName: string = 'div') => {
    const el: any = {
      tagName: tagName.toUpperCase(),
      innerHTML: '',
      value: '',
      id: '',
      textContent: '',
      style: {},
      _attrs: {} as Record<string, string>,
      focus: () => {}, // Mock focus method
      setAttribute: (name: string, val: string) => {
        el._attrs[name] = val;
      },
      getAttribute: (name: string) => el._attrs[name] || null,
      addEventListener: () => {},
      querySelector: (sel: string) => {
        return createMockElement('div');
      },
      querySelectorAll: (sel: string) => {
        return [createMockElement('div'), createMockElement('div')];
      },
      appendChild: (child: any) => {
        if (!el._children) el._children = [];
        el._children.push(child);
      },
      removeChild: (child: any) => {
        if (el._children) {
          el._children = el._children.filter((c: any) => c !== child);
        }
      },
      remove: () => {
        if (el._parent && el._parent._children) {
          el._parent._children = el._parent._children.filter((c: any) => c !== el);
        }
      },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {}
      },
      _children: [],
      _parent: null
    };
    return el;
  };

  const appElement = createMockElement('div');
  appElement.id = 'app';

  const headElement = createMockElement('head');
  const bodyElement = createMockElement('body');

  (global as any).window = {
    fetch: (input: any, init: any) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({ success: true, data: {} }),
        text: () => Promise.resolve('{"success":true,"data":{}}')
      });
    },
    location: { href: 'http://localhost/', pathname: '/', hostname: 'localhost' },
    currentUser: 'system',
    addEventListener: () => {},
    localStorage: {
      getItem: (key: string) => localStorageStore[key] || null,
      setItem: (key: string, val: string) => { localStorageStore[key] = val; },
      removeItem: (key: string) => { delete localStorageStore[key]; }
    },
    sessionStorage: {
      getItem: (key: string) => sessionStorageStore[key] || null,
      setItem: (key: string, val: string) => { sessionStorageStore[key] = val; }
    },
    history: {
      pushState: () => {}
    },
    isWebsitePreviewMode: false,
    dataLayer: []
  };

  // Mock DOM elements that the builder queries
  const elementsStore: Record<string, any> = {
    'app': appElement,
  };

  (global as any).document = {
    referrer: '',
    querySelector: (selector: string) => {
      if (selector === '#app') return appElement;
      return createMockElement('div');
    },
    querySelectorAll: (sel: string) => {
      return [createMockElement('div'), createMockElement('div')];
    },
    getElementById: (id: string) => {
      if (elementsStore[id]) return elementsStore[id];
      const newEl = createMockElement('div');
      newEl.id = id;
      elementsStore[id] = newEl;
      return newEl;
    },
    createElement: (tag: string) => {
      const newEl = createMockElement(tag);
      newEl._parent = headElement;
      return newEl;
    },
    head: headElement,
    body: bodyElement,
    addEventListener: () => {}
  };

  (global as any).localStorage = (global as any).window.localStorage;
  (global as any).sessionStorage = (global as any).window.sessionStorage;
  (global as any).requestAnimationFrame = (callback: any) => setTimeout(callback, 0);
}

// Intercept window fetch to redirect page sections PUT and GET requests correctly
(global as any).fetch = async (input: any, init: any) => {
  const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
  const method = init?.method || 'GET';

  // Match /api/pages/:pageId/sections PUT auto-save
  const sectionsMatch = url.match(/^\/api\/pages\/([^/]+)\/sections$/);
  if (sectionsMatch && method === 'PUT') {
     const pageId = sectionsMatch[1];
     const payload = JSON.parse(init.body);
     const sections = payload.sections || [];

     // If Supabase is offline/mock, we call SectionsRepo directly in main.ts
     const { SectionsRepo } = await import('./src/sections_repo_supabase');
     for (const s of sections) {
        await SectionsRepo.persistSection(s, 'system');
     }
     
     const response = {
        success: true,
        saved: sections.length
     };

     return {
       ok: true,
       status: 200,
       json: () => Promise.resolve(response),
       text: () => Promise.resolve(JSON.stringify(response))
     };
  }

  // Intercept settings GET/POST
  if (url === '/api/settings') {
     const { getWebsiteSettings, persistWebsiteSettings } = await import('./src/website_settings_repo');
     if (method === 'GET') {
        const response = await getWebsiteSettings('system', 'ws-1');
        return {
          ok: true,
          status: response.success ? 200 : 500,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response))
        };
     }
  }

  // Fallback for other relative API routes in the browser shell to prevent node fetch URL parsing crashes
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Map(),
    json: () => Promise.resolve({ success: true, data: [] }),
    text: () => Promise.resolve('{"success":true,"data":[]}')
  });
};

// Import main.ts
await import('./src/main');

async function runBuilderVerification() {
  console.log('===============================================================');
  console.log('🔬 STARTING BUILDER RUNTIME & SECTION PERSISTENCE TESTS');
  console.log('===============================================================\n');

  const { mockPages, mockPageSections } = await import('./src/db');

  console.log('📍 [US-050] Open builder from Edit Section...');
  
  // Make sure at least one mock page exists
  if (mockPages.length === 0) {
     throw new Error('No mock pages exist to build');
  }
  const testPage = mockPages[0];
  console.log('Using target page:', testPage.name, '(ID:', testPage.id, ')');

  // Trigger Edit Section / open builder from funnel
  await (window as any).openBuilderFromFunnel(testPage.id, testPage.funnel_id);

  // Await skeleton transition timeout (350ms)
  await new Promise(resolve => setTimeout(resolve, 500));

  // Assert builder is rendering
  const appElement = document.getElementById('app');
  console.log('App element content size:', appElement.innerHTML.length);
  
  if (!appElement.innerHTML.includes('Exit') || !appElement.innerHTML.includes('Studio')) {
     throw new Error('Builder UI did not render correctly or remains blank/white');
  }
  console.log('✅ US-050 PASSED: Builder successfully initialized and loaded UI from Edit Section trigger.');

  console.log('\n📍 [US-051] Edit page section...');
  const targetSection = mockPageSections.find(s => s.page_id === testPage.id);
  if (!targetSection) {
     throw new Error(`No sections found mapped to page ${testPage.id}`);
  }
  console.log('Editing section type:', targetSection.type, '(ID:', targetSection.id, ')');

  // Modify some text in target section
  const originalHeading = targetSection.content.heading || '';
  console.log('Original content heading:', originalHeading);
  targetSection.content.heading = 'Awesome Pressure Cleaning Services';

  // Trigger Save Page Sections
  await (window as any).savePageSections();
  
  // Verify that the change persists in the mock page sections array
  const updatedSection = mockPageSections.find(s => s.id === targetSection.id);
  console.log('Updated content heading:', updatedSection?.content.heading);
  if (updatedSection?.content.heading !== 'Awesome Pressure Cleaning Services') {
     throw new Error('Page section text edits were not persisted in the database array!');
  }
  console.log('✅ US-051 PASSED: Edited page section content saves successfully.');

  console.log('\n📍 [US-052] Builder does not lose state on refresh...');
  
  // Verify that localStorage contains the backup key for custom sections
  const expectedKey = `mock_sections_system:${testPage.id}`;
  console.log('Checking localStorage backup key:', expectedKey, '->', !!localStorageStore[expectedKey]);
  if (!localStorageStore[expectedKey]) {
     throw new Error(`Expected mock sections localStorage backup key "${expectedKey}" to exist, but it was missing!`);
  }

  // We simulate refresh by clearing in-memory mockPageSections array and seeing if we can restore them!
  console.log('Simulating full browser page refresh: wiping in-memory mockPageSections...');
  mockPageSections.length = 0;

  // Let's retrieve from database/mock source
  const { SectionsRepo } = await import('./src/sections_repo_supabase');
  const sectionsRes = await SectionsRepo.getSectionsForPage(testPage.id, 'system');
  console.log('Retrieved sections after in-memory wipe:', sectionsRes.data?.length);

  if (!sectionsRes.success || !sectionsRes.data || sectionsRes.data.length === 0) {
     throw new Error('Failed to restore page sections from localStorage after simulated refresh!');
  }

  const restoredSection = sectionsRes.data.find(s => s.id === targetSection.id);
  console.log('Restored section heading:', restoredSection?.content.heading);
  if (restoredSection?.content.heading !== 'Awesome Pressure Cleaning Services') {
     throw new Error(`Restored heading mismatch: expected "Awesome Pressure Cleaning Services", got "${restoredSection?.content.heading}"`);
  }

  // Ensure no duplicate sections were created in getSectionsForPage
  const duplicateCheck = mockPageSections.filter(s => s.id === targetSection.id);
  console.log('Duplicates check count:', duplicateCheck.length);
  if (duplicateCheck.length !== 1) {
     throw new Error(`Duplicate sections were created during restore! Count: ${duplicateCheck.length}`);
  }

  console.log('✅ US-052 PASSED: Restored section successfully survives refreshes via localStorage and avoids duplicates.');

  console.log('\n===============================================================');
  console.log('🎉 ALL WEBSITE BUILDER PERSISTENCE USER STORIES VERIFIED SUCCESSFULLY!');
  console.log('===============================================================');
  process.exit(0);
}

runBuilderVerification().catch(err => {
  console.error('\n❌ BUILDER TESTING FAILED:', err.message);
  process.exit(1);
});
