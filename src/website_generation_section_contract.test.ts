import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILDER_SECTION_REGISTRY,
  createBuilderSection,
  getBuilderSectionDefinition
} from './builder_section_registry';
import { getBuilderInspectorSchema } from './builder_inspector_schema';

const root = new URL('../', import.meta.url);
const migration = readFileSync(
  new URL('supabase/migrations/20260801044852_align_initial_website_section_types.sql', root),
  'utf8'
);
const main = readFileSync(new URL('src/main.ts', root), 'utf8');

type SeededSection = {
  type: string;
  contentSql: string;
  order: number;
  stylesSql: string;
};

function functionBody(name: string, nextName: string): string {
  const start = main.indexOf(`function ${name}`);
  const end = main.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Unable to locate ${name}.`);
  return main.slice(start, end);
}

function seededSections(): SeededSection[] {
  const insert = migration.match(
    /insert into public\.page_sections[\s\S]*?values([\s\S]*?);\s*\n\s*select jsonb_agg/i
  )?.[1];
  if (!insert) throw new Error('Unable to locate the initial PageSection insert.');

  return [...insert.matchAll(
    /v_page\.id,\s*'([^']+)',\s*jsonb_build_object\(([\s\S]*?)\)\s*,\s*(\d+)\s*,\s*jsonb_build_object\(([\s\S]*?)\)\s*,\s*v_now\)/g
  )].map(match => ({
    type: match[1],
    contentSql: match[2],
    order: Number(match[3]),
    stylesSql: match[4]
  }));
}

const sections = seededSections();
const canvasRenderer = functionBody('renderSectionPreviewContent', 'updateMetaTag');
const publicRenderer = functionBody('renderSectionBody', 'renderReports');

describe('initial Website section contract', () => {
  it('seeds exactly three registered sections with unique deterministic orders', () => {
    expect(sections.map(section => section.type)).toEqual(['hero', 'offer', 'form']);
    expect(sections.map(section => section.order)).toEqual([0, 1, 2]);
    expect(new Set(sections.map(section => section.order)).size).toBe(3);
  });

  it('keeps every seeded type accepted by the registry factory and inspector', () => {
    const registered = new Set(BUILDER_SECTION_REGISTRY.map(definition => definition.type));
    for (const section of sections) {
      expect(registered.has(section.type)).toBe(true);
      expect(getBuilderSectionDefinition(section.type)).toBeDefined();
      expect(createBuilderSection(section.type, {
        id: `section-${section.order}`,
        pageId: 'page-1',
        order: section.order,
        funnelId: 'funnel-1'
      }).type).toBe(section.type);
      expect(getBuilderInspectorSchema(section.type)).toBeDefined();
    }
  });

  it('keeps every seeded type supported by the canvas and public renderers', () => {
    for (const section of sections) {
      expect(canvasRenderer).toContain(`case '${section.type}':`);
      expect(publicRenderer).toContain(`case '${section.type}':`);
    }
  });

  it('seeds registry-compatible content and style keys', () => {
    const byType = Object.fromEntries(sections.map(section => [section.type, section]));

    expect(byType.hero.contentSql).toMatch(/'heading',\s*v_business_name/);
    expect(byType.hero.contentSql).toMatch(/'subheading',\s*'Trusted service in '\s*\|\|\s*v_city/);
    expect(byType.hero.contentSql).toMatch(/'button_text',\s*'Get a Free Quote'/);
    expect(byType.hero.contentSql).toContain("'background_image'");
    expect(byType.hero.stylesSql).toMatch(/'padding',\s*'100px 20px'/);
    expect(byType.hero.stylesSql).toMatch(/'text_alignment',\s*'center'/);
    expect(byType.hero.stylesSql).toMatch(/'background',\s*'#ffffff'/);
    expect(byType.hero.stylesSql).toMatch(/'visible',\s*true/);

    expect(byType.offer.contentSql).toMatch(/'headline',\s*'Our Services'/);
    expect(byType.offer.contentSql).toMatch(/'description',\s*array_to_string\(v_services,\s*', '\)/);
    expect(byType.offer.contentSql).toMatch(/'button_text',\s*'Request a Quote'/);
    expect(byType.offer.contentSql).toMatch(/'expiry',\s*''/);
    expect(byType.offer.stylesSql).toMatch(/'padding',\s*'80px 20px'/);
    expect(byType.offer.stylesSql).toMatch(/'background',\s*'#4f46e5'/);
    expect(byType.offer.stylesSql).toMatch(/'color',\s*'#ffffff'/);
    expect(byType.offer.stylesSql).toMatch(/'visible',\s*true/);

    expect(byType.form.contentSql).toMatch(/'title',\s*'Get My Free Quote'/);
    expect(byType.form.contentSql).toMatch(/'fields',\s*jsonb_build_array\('name',\s*'phone'\)/);
    expect(byType.form.contentSql).toMatch(/'pipeline_id',\s*v_funnel\.id/);
    expect(byType.form.stylesSql).toMatch(/'padding',\s*'60px 20px'/);
    expect(byType.form.stylesSql).toMatch(/'background',\s*'#f8fafc'/);
    expect(byType.form.stylesSql).toMatch(/'visible',\s*true/);
  });

  it('preserves the privileged RPC security and concurrency boundaries', () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/i);
    expect(migration).toContain('v_user_id text := (select auth.uid())::text');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon/i);
    expect(migration).toMatch(/grant execute on function[\s\S]+to authenticated/i);
  });
});
