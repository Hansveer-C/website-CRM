import { describe, expect, it } from 'vitest';
import { BuilderPageRevisionAuthority } from './builder_page_revision_authority';

describe('BuilderPageRevisionAuthority', () => {
  it('invalidates stale revision N on conflict and requires a reload', () => {
    const authority = new BuilderPageRevisionAuthority();
    authority.accept('page-1', 7);
    authority.invalidateAfterConflict('page-1');

    expect(authority.has('page-1')).toBe(false);
    expect(authority.get('page-1')).toBeUndefined();
    expect(authority.requiresReload('page-1')).toBe(true);
  });

  it('does not block safe ordinary retries or unrelated pages', () => {
    const authority = new BuilderPageRevisionAuthority();
    authority.accept('page-1', 3);
    authority.accept('page-2', 4);

    expect(authority.requiresReload('page-1')).toBe(false);
    expect(authority.get('page-1')).toBe(3);
    expect(authority.get('page-2')).toBe(4);
  });

  it('accepts a freshly authoritative revision after a new runtime load', () => {
    const authority = new BuilderPageRevisionAuthority();
    authority.invalidateAfterConflict('page-1');
    authority.accept('page-1', 8);

    expect(authority.requiresReload('page-1')).toBe(false);
    expect(authority.get('page-1')).toBe(8);
  });
});
