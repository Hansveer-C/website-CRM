import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  WASHOPS_PRIMITIVES,
  WASHOPS_BREAKPOINTS,
  WASHOPS_MEDIA_QUERIES,
  WASHOPS_SPACING,
  WASHOPS_RADII,
  WASHOPS_Z_INDEX,
  WASHOPS_SHADOWS,
  WASHOPS_TYPOGRAPHY,
  REQUIRED_SEMANTIC_CSS_TOKENS
} from './tokens';

describe('WashOps Design Token Foundation (Phase 1C / Task 7A.1)', () => {
  it('1. verifies that the tokens.css file exists and contains all required semantic tokens', () => {
    const cssPath = path.resolve(__dirname, 'tokens.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const cssContent = fs.readFileSync(cssPath, 'utf8');

    for (const token of REQUIRED_SEMANTIC_CSS_TOKENS) {
      expect(cssContent).toContain(token);
    }
  });

  it('2. verifies that src/style.css imports the canonical tokens stylesheet', () => {
    const stylePath = path.resolve(__dirname, '../style.css');
    expect(fs.existsSync(stylePath)).toBe(true);

    const styleContent = fs.readFileSync(stylePath, 'utf8');
    expect(styleContent).toMatch(/@import\s+['"]\.\/tokens\/tokens\.css['"]/);
  });

  it('3. verifies foundational primitive color scales', () => {
    expect(WASHOPS_PRIMITIVES.neutral[0]).toBe('#ffffff');
    expect(WASHOPS_PRIMITIVES.neutral[50]).toBe('#f9fafb');
    expect(WASHOPS_PRIMITIVES.neutral[900]).toBe('#111827');
    expect(WASHOPS_PRIMITIVES.neutral[950]).toBe('#0a0a0a');

    expect(WASHOPS_PRIMITIVES.brand[600]).toBe('#2563eb');
    expect(WASHOPS_PRIMITIVES.brand[700]).toBe('#1d4ed8');

    expect(WASHOPS_PRIMITIVES.emerald[600]).toBe('#059669');
    expect(WASHOPS_PRIMITIVES.amber[600]).toBe('#d97706');
    expect(WASHOPS_PRIMITIVES.rose[600]).toBe('#dc2626');
  });

  it('4. verifies responsive breakpoint contract', () => {
    expect(WASHOPS_BREAKPOINTS.sm).toBe(640);
    expect(WASHOPS_BREAKPOINTS.md).toBe(768);
    expect(WASHOPS_BREAKPOINTS.lg).toBe(1024);
    expect(WASHOPS_BREAKPOINTS.xl).toBe(1280);
    expect(WASHOPS_BREAKPOINTS['2xl']).toBe(1536);

    expect(WASHOPS_MEDIA_QUERIES.sm).toBe('(min-width: 640px)');
    expect(WASHOPS_MEDIA_QUERIES.md).toBe('(min-width: 768px)');
    expect(WASHOPS_MEDIA_QUERIES.maxSm).toBe('(max-width: 639px)');
    expect(WASHOPS_MEDIA_QUERIES.maxMd).toBe('(max-width: 767px)');
  });

  it('5. verifies spacing scale is monotonic and positive', () => {
    const keys = Object.keys(WASHOPS_SPACING).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16]);

    for (let i = 1; i < keys.length; i++) {
      const prevVal = parseInt(WASHOPS_SPACING[keys[i - 1] as keyof typeof WASHOPS_SPACING], 10);
      const currVal = parseInt(WASHOPS_SPACING[keys[i] as keyof typeof WASHOPS_SPACING], 10);
      expect(currVal).toBeGreaterThan(prevVal);
    }
  });

  it('6. verifies shape radii scale', () => {
    expect(WASHOPS_RADII.none).toBe('0px');
    expect(WASHOPS_RADII.sm).toBe('4px');
    expect(WASHOPS_RADII.md).toBe('8px');
    expect(WASHOPS_RADII.lg).toBe('12px');
    expect(WASHOPS_RADII.xl).toBe('16px');
    expect(WASHOPS_RADII['2xl']).toBe('24px');
    expect(WASHOPS_RADII.full).toBe('9999px');
  });

  it('7. verifies z-index layering hierarchy', () => {
    expect(WASHOPS_Z_INDEX.base).toBeLessThan(WASHOPS_Z_INDEX.docked);
    expect(WASHOPS_Z_INDEX.docked).toBeLessThan(WASHOPS_Z_INDEX.dropdown);
    expect(WASHOPS_Z_INDEX.dropdown).toBeLessThan(WASHOPS_Z_INDEX.sticky);
    expect(WASHOPS_Z_INDEX.sticky).toBeLessThan(WASHOPS_Z_INDEX.drawer);
    expect(WASHOPS_Z_INDEX.drawer).toBeLessThan(WASHOPS_Z_INDEX.modalBackdrop);
    expect(WASHOPS_Z_INDEX.modalBackdrop).toBeLessThan(WASHOPS_Z_INDEX.modal);
    expect(WASHOPS_Z_INDEX.modal).toBeLessThan(WASHOPS_Z_INDEX.popover);
    expect(WASHOPS_Z_INDEX.popover).toBeLessThan(WASHOPS_Z_INDEX.toast);
    expect(WASHOPS_Z_INDEX.toast).toBeLessThan(WASHOPS_Z_INDEX.max);
  });

  it('8. verifies typography scale definitions', () => {
    expect(WASHOPS_TYPOGRAPHY.fontSans).toContain('-apple-system');
    expect(WASHOPS_TYPOGRAPHY.fontMono).toContain('SF Mono');
    expect(WASHOPS_TYPOGRAPHY.fontWeight.regular).toBe(400);
    expect(WASHOPS_TYPOGRAPHY.fontWeight.bold).toBe(700);
    expect(WASHOPS_TYPOGRAPHY.fontSize.base).toBe('1rem');
  });

  it('9. verifies dark theme definition strategy in CSS', () => {
    const cssPath = path.resolve(__dirname, 'tokens.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(cssContent).toContain('[data-theme="dark"]');
    expect(cssContent).toContain('.theme-dark');
    expect(cssContent).toContain('--wo-color-canvas: var(--wo-primitive-neutral-950)');
  });

  it('10. verifies reduced motion accessibility media query in CSS', () => {
    const cssPath = path.resolve(__dirname, 'tokens.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssContent).toContain('--wo-transition-all: none');
  });
});
