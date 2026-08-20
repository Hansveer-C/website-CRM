/**
 * WashOps Design System — Programmatic Token Definitions & Types
 * (Phase 1C / Task 7A.1)
 */

export const WASHOPS_PRIMITIVES = {
  neutral: {
    0: '#ffffff',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#0a0a0a'
  },
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46'
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e'
  },
  rose: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b'
  }
} as const;

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

export const WASHOPS_SPACING = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px'
} as const;

export type WashopsSpacingKey = keyof typeof WASHOPS_SPACING;

export const WASHOPS_RADII = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px'
} as const;

export const WASHOPS_Z_INDEX = {
  base: 0,
  docked: 10,
  dropdown: 100,
  sticky: 500,
  drawer: 900,
  modalBackdrop: 1000,
  modal: 1100,
  popover: 1200,
  toast: 1500,
  max: 9999
} as const;

export const WASHOPS_SHADOWS = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
  focus: '0 0 0 3px rgba(37, 99, 235, 0.35)'
} as const;

export const WASHOPS_TYPOGRAPHY = {
  fontSans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif',
  fontMono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", "Courier New", monospace',
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    md: '1.125rem',
    lg: '1.25rem',
    xl: '1.375rem',
    '2xl': '1.5rem',
    '3xl': '1.75rem',
    '4xl': '2.25rem'
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },
  lineHeight: {
    none: 1,
    tight: 1.2,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6
  }
} as const;

/**
 * Required Semantic Token Names in CSS custom property format
 */
export const REQUIRED_SEMANTIC_CSS_TOKENS = [
  '--wo-color-canvas',
  '--wo-color-surface',
  '--wo-color-surface-subtle',
  '--wo-color-surface-elevated',
  '--wo-color-border',
  '--wo-color-border-strong',
  '--wo-color-text-primary',
  '--wo-color-text-secondary',
  '--wo-color-text-muted',
  '--wo-color-text-inverse',
  '--wo-color-interactive',
  '--wo-color-interactive-hover',
  '--wo-color-interactive-active',
  '--wo-color-focus-ring',
  '--wo-color-success',
  '--wo-color-warning',
  '--wo-color-danger',
  '--wo-color-info',
  '--wo-font-sans',
  '--wo-font-size-base',
  '--wo-space-4',
  '--wo-radius-md',
  '--wo-radius-lg',
  '--wo-shadow-sm',
  '--wo-shadow-md',
  '--wo-z-modal',
  '--wo-duration-fast'
] as const;
