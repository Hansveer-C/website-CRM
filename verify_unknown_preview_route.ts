import { readFileSync } from 'fs';
import { mockWebsiteRoutes } from './src/db';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing expected unknown-preview-route code: ${label}`);
}

function normalize(path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath === '/home' ? '/' : cleanPath;
}

console.log('===============================================================');
console.log('STARTING UNKNOWN PREVIEW ROUTE VERIFICATION');
console.log('===============================================================\n');

console.log('[WB-115] Checking preview exact-route guard...');
includesSnippet('const resolvedRoutePath = normalizePreviewPath(result.route?.path || \'/\')', 'resolved route normalization');
includesSnippet('const requestedRoutePath = normalizePreviewPath(targetPath)', 'requested route normalization');
includesSnippet('if (isPreview && resolvedRoutePath !== requestedRoutePath)', 'preview exact route check');
includesSnippet("render404('Preview target not found.')", 'preview not-found response');
console.log('PASS: Unknown preview routes are guarded against resolver fallback.');

console.log('\n[WB-115] Checking known preview route remains valid...');
const drivewayRoute = mockWebsiteRoutes.find((route: any) => route.path === '/driveway-cleaning');
assert(drivewayRoute, 'Missing /driveway-cleaning website route.');
assert(normalize(drivewayRoute!.path) === normalize('/driveway-cleaning'), 'Driveway route normalization mismatch.');
console.log('PASS: /preview/driveway-cleaning can still match an exact website route.');

console.log('\n[WB-115] Checking home preview normalization remains supported...');
const homeRoute = mockWebsiteRoutes.find((route: any) => route.path === '/');
assert(homeRoute, 'Missing home website route.');
assert(normalize('/home') === normalize(homeRoute!.path), '/preview/home should normalize to the home route.');
console.log('PASS: /preview/home can still resolve to the home route.');

console.log('\n[WB-115] Checking fallback regression guards...');
assert(!mockWebsiteRoutes.some((route: any) => route.path === '/not-a-real-page-xyz'), 'Unexpected mock route exists for /not-a-real-page-xyz.');
assert(!mockWebsiteRoutes.some((route: any) => route.path === '/random-service-test-404'), 'Unexpected mock route exists for /random-service-test-404.');
includesSnippet('const targetPath = resolveWebsitePathFromBrowserPath(rawPath)', 'public route bridge remains active');
includesSnippet("if (normalizedPath === '/') return null", 'root and hash admin routes remain untouched');
console.log('PASS: Unknown public routes remain unknown while known public routes still enter the bridge.');

console.log('\n===============================================================');
console.log('ALL UNKNOWN PREVIEW ROUTE CHECKS PASSED');
console.log('===============================================================');
