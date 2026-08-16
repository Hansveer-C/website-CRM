import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260810050518_save_page_sections_document.sql', import.meta.url), 'utf8').toLowerCase();
const hardeningMigration = readFileSync(new URL('../supabase/migrations/20260816030645_harden_page_section_save_conflict_ownership.sql', import.meta.url), 'utf8').toLowerCase();
const saveRoute = readFileSync(new URL('../api/page-sections.ts', import.meta.url), 'utf8');
const revisionRoute = readFileSync(new URL('../api/page-section-save-revision.ts', import.meta.url), 'utf8');
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');

describe('page section save deployment boundary', () => {
  it('ships literal Vercel routes that resolve before the API catch-all', () => {
    expect(saveRoute).toContain('createPageSectionSaveHandler');
    expect(saveRoute).toContain('export function PUT');
    expect(revisionRoute).toContain('createPageSectionSaveHandler');
    expect(revisionRoute).toContain('export function GET');
  });
  it('lets filesystem routes resolve before the API catch-all', () => expect(vercel.indexOf('"handle": "filesystem"')).toBeLessThan(vercel.indexOf('"src": "/api')));
  it('uses a security definer with an empty search path', () => expect(migration).toMatch(/security definer\s+set search_path = ''/));
  it('derives identity from auth.uid', () => expect(migration).toContain("v_user_id text := (select auth.uid())::text"));
  it('checks page ownership server-side', () => expect(migration).toContain('if v_page_owner <> v_user_id'));
  it('serializes same-page replacements', () => expect(migration).toContain('pg_advisory_xact_lock'));
  it('deletes removed sections inside the function', () => expect(migration).toMatch(/delete from public\.page_sections[\s\S]*not exists/));
  it('upserts retained and new sections inside the function', () => expect(migration).toMatch(/insert into public\.page_sections[\s\S]*on conflict \(id\) do update/));
  it('maintains a server revision and hash', () => { expect(migration).toContain('page_section_save_revisions'); expect(migration).toContain('v_document_hash'); });
  it('seeds revision zero for existing documents', () => expect(migration).toMatch(/insert into private\.page_section_save_revisions[\s\S]*from public\.pages/));
  it('provides an authenticated revision read boundary', () => { expect(migration).toContain('get_page_sections_save_revision'); expect(migration).toMatch(/grant execute on function public\.get_page_sections_save_revision\(text\) to authenticated/); });
  it('does not accept a caller-selected user ID', () => expect(migration).not.toMatch(/p_user_id/));
  it('revokes public and anonymous execution', () => expect(migration).toMatch(/revoke all on function public\.save_page_sections_document[\s\S]*from public, anon/));
  it('grants only authenticated execution', () => expect(migration).toMatch(/grant execute on function public\.save_page_sections_document[\s\S]*to authenticated/));
  it('ships a forward-only conflict ownership boundary', () => {
    expect(hardeningMigration).toContain('where page_sections.user_id = excluded.user_id');
    expect(hardeningMigration).toContain('and page_sections.page_id = excluded.page_id');
    expect(hardeningMigration).toContain('get diagnostics v_affected_count = row_count');
    expect(hardeningMigration).toContain('if v_affected_count <> v_count');
  });
  it('preserves the privileged-function security boundary in the forward migration', () => {
    expect(hardeningMigration).toMatch(/security definer\s+set search_path = ''/);
    expect(hardeningMigration).toContain("v_user_id text := (select auth.uid())::text");
    expect(hardeningMigration).toMatch(/revoke all on function public\.save_page_sections_document[\s\S]*from public, anon/);
    expect(hardeningMigration).toMatch(/grant execute on function public\.save_page_sections_document[\s\S]*to authenticated/);
  });
});
