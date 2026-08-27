import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

function sourceBetween(startText: string, endText: string): string {
  const start = main.indexOf(startText);
  const end = main.indexOf(endText, start + startText.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return main.slice(start, end);
}

describe('Builder section lifecycle semantic UI contracts', () => {
  const layers = sourceBetween(
    'function renderBuilderLayersPanel(',
    'type BuilderWebsitePageEntry'
  );
  const builderMarkup = sourceBetween('function _renderBuilder()', 'function setNestedValue(');

  it('renders all six Add options as named native buttons', () => {
    expect(builderMarkup).toContain('<button type="button" class="pb-component-item"');
    expect(builderMarkup).toContain('aria-label="Add ${item.label} section"');
    expect(builderMarkup).not.toContain('<div class="pb-component-item"');
    for (const label of ['Hero', 'Proof', 'Offer', 'Gallery', 'Form', 'FAQ']) {
      expect(builderMarkup).toContain(`label: '${label}'`);
    }
  });

  it('renders a visible, named native between-section Add button', () => {
    expect(builderMarkup).toContain('<button type="button" class="pb-add-between"');
    expect(builderMarkup).toContain('aria-label="${escapeBuilderInspectorHtml(insertionLabel)}"');
    expect(builderMarkup).not.toContain('<div class="pb-add-between"');
    expect(css).not.toMatch(/\.pb-add-between\s*\{[^}]*opacity:\s*0\s*;/s);
    expect(css).not.toMatch(/\.pb-add-between\s*\{[^}]*display:\s*none/s);
  });

  it('keeps direct Add and disabled Paste actions in the permanent Layers header', () => {
    expect(layers).toContain('id="pb-layers-add-section"');
    expect(layers).toContain('>Add section</button>');
    expect(layers).toContain('id="pb-layers-paste-section"');
    expect(layers).toContain("builderSectionClipboard ? '' : 'disabled'");
  });

  it('exposes all per-section lifecycle actions as named native buttons', () => {
    for (const action of ['Move', 'Duplicate', 'Reset', 'Copy', 'Delete']) {
      expect(layers).toContain(`${action} \${safeAccessibleSectionLabel}`);
    }
    expect(layers).toContain("${isHidden ? 'Show' : 'Hide'} ${safeAccessibleSectionLabel}");
    expect(layers).toContain("index === 0 ? 'disabled' : ''");
    expect(layers).toContain("index === orderedSections.length - 1 ? 'disabled' : ''");
    expect(layers).toContain('definition ? `<button type="button" aria-label="Reset');
  });

  it('keeps legacy Reset unavailable while retaining the other actions', () => {
    expect(layers).toContain('const definition = getBuilderSectionDefinition(section.type);');
    expect(layers).toMatch(/\$\{definition \? `<button[^`]+Reset[^`]+` : ''\}/s);
  });

  it('provides an obvious non-Guided-Setup empty-page Add path', () => {
    expect(layers).toContain('<h4>No sections yet</h4>');
    expect(layers).toContain('onclick="window.openBuilderAddPanel()">Add section</button>');
    expect(builderMarkup).toContain('class="pb-empty-add-section"');
    expect(builderMarkup).toContain('Start Guided Setup');
  });

  it('makes Layers rows stable programmatic focus targets', () => {
    expect(layers).toContain('data-builder-section-id="${escapeBuilderInspectorHtml(section.id)}" tabindex="-1"');
    expect(main).toContain("requestAnimationFrame(() => {");
    expect(main).toContain("request.pageId !== builderPageId");
    expect(main).toContain("row.dataset.builderSectionId === request.sectionId");
    expect(main).toContain("document.getElementById('pb-layers-add-section')");
  });

  it('uses one scoped polite atomic live region and suppresses no-op preparation', () => {
    expect(main.match(/id="pb-lifecycle-live"/g)).toHaveLength(1);
    expect(main).toContain('aria-live="polite" aria-atomic="true"');
    expect(main).toContain('if (!result.changed) return;');
  });

  it('uses 44px primary lifecycle hit areas and visible focus styles', () => {
    expect(css).toMatch(/\.pb-layer-actions button,[\s\S]*?min-height:\s*44px;/);
    expect(css).toMatch(/\.pb-layers-primary-actions button\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(css).toMatch(/\.pb-component-item\s*\{[\s\S]*?min-height:\s*56px;/);
    expect(css).toMatch(/\.pb-add-between\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(css).toContain('.pb-layer-row:focus-visible');
  });

  it('keeps the canvas toolbar secondary but named and selected-state reachable', () => {
    expect(builderMarkup).toContain('class="pb-section-controls"');
    expect(builderMarkup).not.toMatch(/class="pb-section-controls"[^>]*display:\s*none/);
    expect(builderMarkup).toContain('aria-label="Move ${escapeBuilderInspectorHtml(section.type)} section up"');
    expect(css).toContain('.pb-section-preview.active .pb-section-controls');
  });

  it('retains the existing practical 980px compact inspector contract', () => {
    expect(css).toContain('@media (max-width: 980px)');
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.pb-inspector-panel\s*\{[\s\S]*?width:\s*250px;/);
  });
});
