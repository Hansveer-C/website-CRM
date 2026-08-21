import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as tokensModule from './tokens';
import {
  WASHOPS_BREAKPOINTS,
  WASHOPS_MEDIA_QUERIES,
  REQUIRED_SEMANTIC_CSS_TOKENS
} from './tokens';

describe('WashOps Design Token Foundation Authority (Phase 1C / Task 7A.1)', () => {
  const cssPath = path.resolve(__dirname, 'tokens.css');
  const stylePath = path.resolve(__dirname, '../style.css');

  it('A. verifies that tokens.css exists', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  it('B. verifies that style.css imports tokens.css at the root', () => {
    expect(fs.existsSync(stylePath)).toBe(true);
    const styleContent = fs.readFileSync(stylePath, 'utf8');
    expect(styleContent).toMatch(/^@import\s+['"]\.\/tokens\/tokens\.css['"];/m);
  });

  it('C. verifies that all required semantic CSS custom properties are declared in tokens.css', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    for (const token of REQUIRED_SEMANTIC_CSS_TOKENS) {
      const regex = new RegExp(`${token}\\s*:`, 'm');
      expect(cssContent).toMatch(regex);
    }
  });

  it('D. verifies that all foundational required token families exist in tokens.css', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. Primitives (Neutral, Brand, Feedback)
    expect(cssContent).toContain('--wo-primitive-neutral-0: #ffffff;');
    expect(cssContent).toContain('--wo-primitive-neutral-900: #111827;');
    expect(cssContent).toContain('--wo-primitive-neutral-950: #0a0a0a;');
    expect(cssContent).toContain('--wo-primitive-brand-600: #2563eb;');
    expect(cssContent).toContain('--wo-primitive-emerald-600: #059669;');
    expect(cssContent).toContain('--wo-primitive-amber-600: #d97706;');
    expect(cssContent).toContain('--wo-primitive-rose-600: #dc2626;');

    // 2. Typography
    expect(cssContent).toMatch(/--wo-font-sans\s*:/);
    expect(cssContent).toMatch(/--wo-font-mono\s*:/);
    expect(cssContent).toMatch(/--wo-font-size-xs\s*:/);
    expect(cssContent).toMatch(/--wo-font-size-base\s*:\s*1rem;/);
    expect(cssContent).toMatch(/--wo-font-size-4xl\s*:/);
    expect(cssContent).toMatch(/--wo-font-weight-regular\s*:\s*400;/);
    expect(cssContent).toMatch(/--wo-font-weight-bold\s*:\s*700;/);
    expect(cssContent).toMatch(/--wo-line-height-normal\s*:/);
    expect(cssContent).toMatch(/--wo-letter-spacing-tighter\s*:/);

    // 3. Spacing scale
    expect(cssContent).toMatch(/--wo-space-0\s*:\s*0px;/);
    expect(cssContent).toMatch(/--wo-space-1\s*:\s*4px;/);
    expect(cssContent).toMatch(/--wo-space-2\s*:\s*8px;/);
    expect(cssContent).toMatch(/--wo-space-4\s*:\s*16px;/);
    expect(cssContent).toMatch(/--wo-space-6\s*:\s*24px;/);
    expect(cssContent).toMatch(/--wo-space-8\s*:\s*32px;/);
    expect(cssContent).toMatch(/--wo-space-16\s*:\s*64px;/);

    // 4. Radii scale
    expect(cssContent).toMatch(/--wo-radius-none\s*:\s*0px;/);
    expect(cssContent).toMatch(/--wo-radius-sm\s*:\s*4px;/);
    expect(cssContent).toMatch(/--wo-radius-md\s*:\s*8px;/);
    expect(cssContent).toMatch(/--wo-radius-lg\s*:\s*12px;/);
    expect(cssContent).toMatch(/--wo-radius-xl\s*:\s*16px;/);
    expect(cssContent).toMatch(/--wo-radius-full\s*:\s*9999px;/);

    // 5. Shadows / Elevation
    expect(cssContent).toMatch(/--wo-shadow-none\s*:\s*none;/);
    expect(cssContent).toMatch(/--wo-shadow-sm\s*:/);
    expect(cssContent).toMatch(/--wo-shadow-md\s*:/);
    expect(cssContent).toMatch(/--wo-shadow-lg\s*:/);
    expect(cssContent).toMatch(/--wo-shadow-focus\s*:/);

    // 6. Z-index hierarchy
    expect(cssContent).toMatch(/--wo-z-base\s*:\s*0;/);
    expect(cssContent).toMatch(/--wo-z-dropdown\s*:\s*100;/);
    expect(cssContent).toMatch(/--wo-z-sticky\s*:\s*500;/);
    expect(cssContent).toMatch(/--wo-z-drawer\s*:\s*900;/);
    expect(cssContent).toMatch(/--wo-z-modal\s*:\s*1100;/);
    expect(cssContent).toMatch(/--wo-z-max\s*:\s*9999;/);

    // 7. Motion & Transitions
    expect(cssContent).toMatch(/--wo-duration-fast\s*:\s*150ms;/);
    expect(cssContent).toMatch(/--wo-ease-standard\s*:/);
    expect(cssContent).toMatch(/--wo-transition-all\s*:/);

    // 8. Accessibility & Focus
    expect(cssContent).toMatch(/--wo-min-touch-target\s*:\s*44px;/);
    expect(cssContent).toMatch(/--wo-focus-outline-width\s*:\s*2px;/);
    expect(cssContent).toMatch(/--wo-focus-outline-offset\s*:\s*2px;/);
    expect(cssContent).toMatch(/--wo-focus-outline-style\s*:\s*solid;/);
    expect(cssContent).toMatch(/--wo-focus-ring-outline\s*:/);
  });

  it('E. verifies that breakpoints are programmatically defined in TypeScript', () => {
    expect(WASHOPS_BREAKPOINTS.sm).toBe(640);
    expect(WASHOPS_BREAKPOINTS.md).toBe(768);
    expect(WASHOPS_BREAKPOINTS.lg).toBe(1024);
    expect(WASHOPS_BREAKPOINTS.xl).toBe(1280);
    expect(WASHOPS_BREAKPOINTS['2xl']).toBe(1536);
  });

  it('F. verifies that media query exports match the breakpoint contract', () => {
    expect(WASHOPS_MEDIA_QUERIES.sm).toBe('(min-width: 640px)');
    expect(WASHOPS_MEDIA_QUERIES.md).toBe('(min-width: 768px)');
    expect(WASHOPS_MEDIA_QUERIES.lg).toBe('(min-width: 1024px)');
    expect(WASHOPS_MEDIA_QUERIES.xl).toBe('(min-width: 1280px)');
    expect(WASHOPS_MEDIA_QUERIES['2xl']).toBe('(min-width: 1536px)');
    expect(WASHOPS_MEDIA_QUERIES.maxSm).toBe('(max-width: 639px)');
    expect(WASHOPS_MEDIA_QUERIES.maxMd).toBe('(max-width: 767px)');
    expect(WASHOPS_MEDIA_QUERIES.maxLg).toBe('(max-width: 1023px)');
  });

  it('G. verifies dark-theme semantic override boundary in tokens.css', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('[data-theme="dark"]');
    expect(cssContent).toContain('.theme-dark');
    expect(cssContent).toMatch(/--wo-color-canvas:\s*var\(--wo-primitive-neutral-950\);/);
    expect(cssContent).toMatch(/--wo-color-surface:\s*var\(--wo-primitive-neutral-900\);/);
    expect(cssContent).toMatch(/--wo-color-text-primary:\s*var\(--wo-primitive-neutral-50\);/);
  });

  it('H. verifies reduced motion accessibility media query in tokens.css', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssContent).toMatch(/--wo-duration-fast:\s*0ms;/);
    expect(cssContent).toMatch(/--wo-transition-all:\s*none;/);
  });

  it('I. verifies that legacy compatibility aliases preserve their PRE-7A.1 values for zero-visual-change', () => {
    const styleContent = fs.readFileSync(stylePath, 'utf8');

    // Legacy shadows preserve exact pre-7A.1 literal values
    expect(styleContent).toContain('--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);');
    expect(styleContent).toContain('--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);');
    expect(styleContent).toContain('--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);');
    expect(styleContent).toContain('--shadow-subtle: var(--shadow-sm);');
    expect(styleContent).toContain('--shadow: var(--shadow-sm);');

    // Legacy transition preserves exact pre-7A.1 value
    expect(styleContent).toContain('--transition: all 150ms ease;');

    // Safe semantic mappings link to canonical tokens
    expect(styleContent).toContain('--background: var(--wo-color-canvas);');
    expect(styleContent).toContain('--card: var(--wo-color-surface);');
    expect(styleContent).toContain('--primary: var(--wo-color-interactive);');
    expect(styleContent).toContain('--text-primary: var(--wo-color-text-primary);');
    expect(styleContent).toContain('--border: var(--wo-color-border);');
  });

  it('J. verifies that tokens.ts does NOT duplicate visual value literals', () => {
    const exportedKeys = Object.keys(tokensModule);
    expect(exportedKeys.sort()).toEqual(['REQUIRED_SEMANTIC_CSS_TOKENS', 'WASHOPS_BREAKPOINTS', 'WASHOPS_MEDIA_QUERIES'].sort());

    // Ensure no visual value dictionaries are exported in TypeScript
    expect(tokensModule).not.toHaveProperty('WASHOPS_PRIMITIVES');
    expect(tokensModule).not.toHaveProperty('WASHOPS_SPACING');
    expect(tokensModule).not.toHaveProperty('WASHOPS_RADII');
    expect(tokensModule).not.toHaveProperty('WASHOPS_SHADOWS');
    expect(tokensModule).not.toHaveProperty('WASHOPS_TYPOGRAPHY');
    expect(tokensModule).not.toHaveProperty('WASHOPS_Z_INDEX');
  });
});
