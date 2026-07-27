import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function resolveLocalImport(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.js`, resolve(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function browserModuleGraph(entry: string): Set<string> {
  const graph = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (graph.has(file)) continue;
    graph.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
      const dependency = resolveLocalImport(file, match[1]);
      if (dependency && !graph.has(dependency)) pending.push(dependency);
    }
    expect(source).not.toMatch(/from\s*['"]twilio['"]|import\s*\(\s*['"]twilio['"]\s*\)/);
  }
  return graph;
}

describe('browser bundle boundary', () => {
  it('keeps Node-only messaging and server credential modules out of the browser graph', () => {
    const graph = [...browserModuleGraph(resolve(process.cwd(), 'src/main.ts'))]
      .map(file => file.replaceAll('\\', '/'));
    expect(graph.some(file => /\/(smsService|sms_logic|calls_api|websites_api)\.ts$/.test(file))).toBe(false);
    expect(graph.some(file => file.endsWith('/utils/db/supabase.ts'))).toBe(false);
  });
});
