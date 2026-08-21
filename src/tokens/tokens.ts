/**
 * WashOps Design System — Programmatic Token Contracts
 * (Phase 1C / Task 7A.1)
 *
 * NOTE: CSS (tokens.css) is the single canonical source of truth for runtime visual values.
 * This TypeScript module only defines programmatic contracts (breakpoints, media queries,
 * and token name registries) where JavaScript runtime evaluation is strictly required.
 */

export const WASHOPS_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

export type WashopsBreakpoint = keyof typeof WASHOPS_BREAKPOINTS;

export const WASHOPS_MEDIA_QUERIES = {
  sm: `(min-width: ${WASHOPS_BREAKPOINTS.sm}px)`,
  md: `(min-width: ${WASHOPS_BREAKPOINTS.md}px)`,
  lg: `(min-width: ${WASHOPS_BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${WASHOPS_BREAKPOINTS.xl}px)`,
  '2xl': `(min-width: ${WASHOPS_BREAKPOINTS['2xl']}px)`,
  maxSm: `(max-width: ${WASHOPS_BREAKPOINTS.sm - 1}px)`,
  maxMd: `(max-width: ${WASHOPS_BREAKPOINTS.md - 1}px)`,
  maxLg: `(max-width: ${WASHOPS_BREAKPOINTS.lg - 1}px)`
} as const;

/**
 * Required Semantic Token Names (CSS Custom Properties)
 * Used for architectural enforcement and test suite integrity.
 */
export const REQUIRED_SEMANTIC_CSS_TOKENS = [
  '--wo-color-canvas',
  '--wo-color-surface',
  '--wo-color-surface-subtle',
  '--wo-color-surface-elevated',
  '--wo-color-surface-sunken',
  '--wo-color-sidebar-bg',
  '--wo-color-backdrop-overlay',
  '--wo-color-border',
  '--wo-color-border-subtle',
  '--wo-color-border-strong',
  '--wo-color-border-interactive',
  '--wo-color-text-primary',
  '--wo-color-text-secondary',
  '--wo-color-text-muted',
  '--wo-color-text-subtle',
  '--wo-color-text-inverse',
  '--wo-color-text-link',
  '--wo-color-text-link-hover',
  '--wo-color-interactive',
  '--wo-color-interactive-hover',
  '--wo-color-interactive-active',
  '--wo-color-interactive-subtle',
  '--wo-color-interactive-disabled',
  '--wo-color-focus-ring',
  '--wo-color-success',
  '--wo-color-warning',
  '--wo-color-danger',
  '--wo-color-info',
  '--wo-font-sans',
  '--wo-font-mono',
  '--wo-font-size-base',
  '--wo-space-0',
  '--wo-space-1',
  '--wo-space-2',
  '--wo-space-4',
  '--wo-space-6',
  '--wo-space-8',
  '--wo-radius-sm',
  '--wo-radius-md',
  '--wo-radius-lg',
  '--wo-radius-xl',
  '--wo-shadow-xs',
  '--wo-shadow-sm',
  '--wo-shadow-md',
  '--wo-shadow-lg',
  '--wo-shadow-focus',
  '--wo-z-base',
  '--wo-z-modal',
  '--wo-duration-fast',
  '--wo-duration-normal',
  '--wo-ease-standard',
  '--wo-min-touch-target',
  '--wo-focus-ring-outline',
  '--wo-focus-outline-width',
  '--wo-focus-outline-offset',
  '--wo-focus-outline-style'
] as const;

export type RequiredSemanticCssToken = typeof REQUIRED_SEMANTIC_CSS_TOKENS[number];
