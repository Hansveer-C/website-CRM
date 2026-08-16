import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');

describe('Builder revision conflict recovery wiring', () => {
  it('invalidates stale revision authority and offers reload instead of conflict retry', () => {
    expect(main).toContain("if (result.error.code === 'CONFLICT') builderPageRevisionAuthority.invalidateAfterConflict(pageId)");
    expect(main).toContain('onclick="window.reloadBuilderAfterConflict()">Reload page</button>');
    expect(main).toContain('if (builderPageRevisionAuthority.requiresReload(builderPageId))');
    expect(main).toContain('(window as any).reloadBuilderAfterConflict();');
  });

  it('blocks another save before revision fetch while a conflict requires reload', () => {
    const guard = main.indexOf('if (builderPageRevisionAuthority.requiresReload(pageId))');
    const begin = main.indexOf('builderSaveState.begin(generation);', guard);
    const fetchRevision = main.indexOf('const revisionResult = await fetchPageSectionRevision(pageId);', guard);
    expect(guard).toBeGreaterThan(-1);
    expect(begin).toBeGreaterThan(guard);
    expect(fetchRevision).toBeGreaterThan(begin);
  });
});
