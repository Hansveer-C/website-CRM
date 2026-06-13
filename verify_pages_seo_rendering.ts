import { readFileSync } from 'fs';

function extractFunctionSource(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}()`);
  if (start === -1) throw new Error(`${functionName} is missing.`);

  const nextMarker = source.indexOf('\n(window as any).navigateTo', start);
  if (nextMarker === -1) throw new Error(`Could not isolate ${functionName}.`);
  return source.slice(start, nextMarker);
}

const mainContent = readFileSync('./src/main.ts', 'utf-8');
const pagesSeoRenderer = extractFunctionSource(mainContent, 'renderPagesSeoLanding');

console.log('===============================================================');
console.log('Pages & SEO Rendering Verification');
console.log('===============================================================');

if (pagesSeoRenderer.includes('\\${renderSidebar(')) {
  throw new Error('Escaped renderSidebar interpolation is still present.');
}

if (!pagesSeoRenderer.includes("${renderSidebar('pages-seo')}")) {
  throw new Error('Pages & SEO renderer does not render the sidebar interpolation.');
}

if (!pagesSeoRenderer.includes('Local Service Pages')) {
  throw new Error('Visible label "Local Service Pages" is missing.');
}

if (pagesSeoRenderer.includes('>SEO Pages<') || pagesSeoRenderer.includes('Manage SEO Pages')) {
  throw new Error('Old visible "SEO Pages" wording remains in Pages & SEO landing view.');
}

if (!mainContent.includes("case 'seo-pages':")) {
  throw new Error("Internal route key 'seo-pages' was removed.");
}

if (!pagesSeoRenderer.includes("onclick=\"window.navigateTo('seo-pages')\"")) {
  throw new Error("Local Service Pages card no longer routes to 'seo-pages'.");
}

for (const label of ['Site Pages', 'Local Service Pages', 'Site Structure', 'Navigation']) {
  if (!pagesSeoRenderer.includes(label)) {
    throw new Error(`Expected grouped card "${label}" is missing.`);
  }
}

if (!pagesSeoRenderer.includes('Create specialized pages to help your business rank higher on Google in the cities and services you cover.')) {
  throw new Error('Local Service Pages description is missing.');
}

if (!pagesSeoRenderer.includes('Manage Local Service Pages')) {
  throw new Error('Local Service Pages button text is missing.');
}

console.log('PASS: Pages & SEO renderer uses real sidebar interpolation, Local Service Pages copy, and preserved seo-pages route.');
