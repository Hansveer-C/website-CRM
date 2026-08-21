/**
 * WashOps Design System — Permanent Application Shell (Phase 1C / Task 7B.1)
 *
 * Implements the canonical application shell architecture:
 * - Desktop docked sidebar with grouped navigation and user profile affordance
 * - Topbar with page title, supporting subtitle, header actions, and responsive menu trigger
 * - Main content container supporting standard and wide content layouts
 * - Accessible mobile drawer with focus trap, backdrop click, Escape dismiss, and background inert isolation
 * - Builder & public site isolation boundary protection
 * - Single typed shell navigation authority
 */

import { escapeHtmlText } from '../../crm_html_output';

// ============================================================================
// 1. DEVELOPER-OWNED SVG ICONS (ARIA-HIDDEN)
// ============================================================================

export const SHELL_ICONS = {
  dashboard: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  clients: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  opportunities: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>`,
  quotes: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  invoices: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="6.01" y2="15"/><line x1="10" y1="15" x2="14" y2="15"/></svg>`,
  leadCapture: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  marketingFunnels: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  websiteDashboard: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  sitePages: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  navigation: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  seoPages: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  websiteSettings: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  reports: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  quickstart: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`,
  eventLogs: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  qaTools: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  signOut: `<svg class="wo-shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

// ============================================================================
// 2. SHELL CONTRACT TYPES
// ============================================================================

export type ShellNavigationTarget =
  | { kind: 'view'; view: string; id?: string }
  | { kind: 'website-settings' }
  | { kind: 'website-management'; view: 'website-settings' | 'funnels' | 'website-navigation' | 'website-structure' | 'seo-pages' };

export interface ShellUser {
  name: string;
  email?: string;
  businessName?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface ShellNavBadge {
  count: number;
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface ShellNavItem {
  id: string;
  label: string;
  iconSvg: string;
  href?: string;
  badge?: ShellNavBadge;
  disabled?: boolean;
  navTarget?: ShellNavigationTarget;
}

export interface ShellNavGroup {
  title: string;
  items: ShellNavItem[];
}

export interface FunnelDetailContext {
  funnelId?: string | null;
  userId?: string | null;
  websites?: Array<{ id: string; user_id?: string }>;
  routes?: Array<{ website_id: string; funnel_id?: string | null }>;
}

export interface ActiveNavContext {
  funnelMode?: 'website' | 'marketing';
  funnelDetailContext?: FunnelDetailContext;
}

export interface ShellSidebarOptions {
  activeView: string;
  activeNavId?: string;
  navContext?: ActiveNavContext;
  navGroups?: ShellNavGroup[];
  user?: ShellUser;
  className?: string;
  isDrawer?: boolean;
}

export interface ShellTopbarOptions {
  activeView: string;
  title: string;
  subtitle?: string;
  headerActionsHtml?: string;
  user?: ShellUser;
}

export interface ApplicationShellOptions {
  activeView: string;
  activeNavId?: string;
  navContext?: ActiveNavContext;
  title: string;
  subtitle?: string;
  headerActionsHtml?: string;
  contentHtml: string;
  contentVariant?: 'standard' | 'wide';
  user?: ShellUser;
  navGroups?: ShellNavGroup[];
  className?: string;
}

// ============================================================================
// 3. CANONICAL NAVIGATION INFORMATION ARCHITECTURE
// ============================================================================

export function getDefaultNavGroups(activeView: string, badgeCounts: Record<string, number> = {}): ShellNavGroup[] {
  const clientsBadgeCount = badgeCounts['clients'] ?? 0;

  return [
    {
      title: 'Core',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          iconSvg: SHELL_ICONS.dashboard,
          href: '#/dashboard',
          navTarget: { kind: 'view', view: 'dashboard' }
        }
      ]
    },
    {
      title: 'Customers & Sales',
      items: [
        {
          id: 'clients',
          label: 'Clients & Leads',
          iconSvg: SHELL_ICONS.clients,
          href: '#/clients',
          badge: clientsBadgeCount > 0 ? { count: clientsBadgeCount, variant: 'warning' } : undefined,
          navTarget: { kind: 'view', view: 'clients' }
        },
        {
          id: 'opportunities',
          label: 'Opportunities',
          iconSvg: SHELL_ICONS.opportunities,
          href: '#/opportunities',
          navTarget: { kind: 'view', view: 'opportunities' }
        },
        {
          id: 'quotes',
          label: 'Quotes',
          iconSvg: SHELL_ICONS.quotes,
          href: '#/quotes',
          navTarget: { kind: 'view', view: 'quotes' }
        },
        {
          id: 'invoices',
          label: 'Invoices',
          iconSvg: SHELL_ICONS.invoices,
          href: '#/invoices',
          navTarget: { kind: 'view', view: 'invoices' }
        }
      ]
    },
    {
      title: 'Marketing & Outreach',
      items: [
        {
          id: 'lead-capture',
          label: 'Lead Capture',
          iconSvg: SHELL_ICONS.leadCapture,
          href: '#/lead-capture',
          navTarget: { kind: 'view', view: 'lead-capture' }
        },
        {
          id: 'marketing-funnels',
          label: 'Ad Landing Pages',
          iconSvg: SHELL_ICONS.marketingFunnels,
          href: '#/marketing-funnels',
          navTarget: { kind: 'view', view: 'marketing-funnels' }
        }
      ]
    },
    {
      title: 'Websites',
      items: [
        {
          id: 'website-dashboard',
          label: 'My Website',
          iconSvg: SHELL_ICONS.websiteDashboard,
          href: '#/website-dashboard',
          navTarget: { kind: 'view', view: 'website-dashboard' }
        },
        {
          id: 'funnels',
          label: 'Site Pages',
          iconSvg: SHELL_ICONS.sitePages,
          href: '#/funnels',
          navTarget: { kind: 'website-management', view: 'funnels' }
        },
        {
          id: 'website-navigation',
          label: 'Navigation',
          iconSvg: SHELL_ICONS.navigation,
          href: '#/website-navigation',
          navTarget: { kind: 'website-management', view: 'website-navigation' }
        },
        {
          id: 'seo-pages',
          label: 'SEO Pages',
          iconSvg: SHELL_ICONS.seoPages,
          href: '#/seo-pages',
          navTarget: { kind: 'website-management', view: 'seo-pages' }
        },
        {
          id: 'website-settings',
          label: 'Settings',
          iconSvg: SHELL_ICONS.websiteSettings,
          href: '#/website-settings',
          navTarget: { kind: 'website-settings' }
        }
      ]
    },
    {
      title: 'System',
      items: [
        {
          id: 'reports',
          label: 'Reports & Insights',
          iconSvg: SHELL_ICONS.reports,
          href: '#/reports',
          navTarget: { kind: 'view', view: 'reports' }
        },
        {
          id: 'quickstart',
          label: 'Quickstart Guide',
          iconSvg: SHELL_ICONS.quickstart,
          href: '#/quickstart',
          navTarget: { kind: 'view', view: 'quickstart' }
        },
        {
          id: 'event-logs',
          label: 'Event Logs',
          iconSvg: SHELL_ICONS.eventLogs,
          href: '#/event-logs',
          navTarget: { kind: 'view', view: 'event-logs' }
        },
        {
          id: 'qa-tools',
          label: 'QA Tools',
          iconSvg: SHELL_ICONS.qaTools,
          href: '#/qa-tools',
          navTarget: { kind: 'view', view: 'qa-tools' }
        }
      ]
    }
  ];
}

// ============================================================================
// 4. SIDEBAR RENDERER
// ============================================================================

export function resolveFunnelDetailMode(ctx: FunnelDetailContext): 'website' | 'marketing' {
  if (!ctx.funnelId) return 'marketing';
  const websites = ctx.websites || [];
  const routes = ctx.routes || [];
  const userId = ctx.userId;

  // Identify owned website IDs
  const ownedWebsiteIds = new Set(
    websites
      .filter(w => !userId || w.user_id === userId)
      .map(w => w.id)
  );

  // Check if any route on an owned website matches this funnel
  const hasOwnedRoute = routes.some(r =>
    ownedWebsiteIds.has(r.website_id) && r.funnel_id === ctx.funnelId
  );

  return hasOwnedRoute ? 'website' : 'marketing';
}

export function resolveActiveNavId(activeView: string, context?: ActiveNavContext | string): string {
  if (activeView === 'contact-detail') return 'clients';
  if (activeView === 'new-quote' || activeView === 'quote-preview') return 'quotes';
  if (activeView === 'pages' || activeView === 'page-sections' || activeView === 'website-structure' || activeView === 'templates' || activeView === 'components') return 'funnels';
  if (activeView === 'pages-seo') return 'seo-pages';
  if (activeView === 'funnel-detail') {
    if (typeof context === 'string') {
      return context === 'marketing' || context === 'marketing-funnels' ? 'marketing-funnels' : 'funnels';
    }
    if (context?.funnelMode) {
      return context.funnelMode === 'marketing' ? 'marketing-funnels' : 'funnels';
    }
    if (context?.funnelDetailContext) {
      const mode = resolveFunnelDetailMode(context.funnelDetailContext);
      return mode === 'marketing' ? 'marketing-funnels' : 'funnels';
    }
    return 'funnels';
  }
  return activeView;
}

export function renderShellSidebar(opts: ShellSidebarOptions): string {
  const groups = opts.navGroups ?? getDefaultNavGroups(opts.activeView);
  const isDrawer = Boolean(opts.isDrawer);
  const sidebarClass = isDrawer ? 'wo-shell-drawer' : 'wo-shell-sidebar';
  const effectiveActiveNav = opts.activeNavId ?? resolveActiveNavId(opts.activeView, opts.navContext);

  const groupsHtml = groups.map(group => {
    const itemsHtml = group.items.map(item => {
      const isActive = effectiveActiveNav === item.id;

      const activeClass = isActive ? ' wo-shell-nav-item--active' : '';
      const currentAttr = isActive ? ' aria-current="page"' : '';
      const hrefAttr = item.href ?? `#/${item.id}`;
      const targetPayload = JSON.stringify(item.navTarget || { kind: 'view', view: item.id });

      let badgeHtml = '';
      if (item.badge && item.badge.count > 0) {
        const badgeVariant = item.badge.variant ?? 'info';
        badgeHtml = `<span class="wo-shell-nav-badge wo-shell-nav-badge--${badgeVariant}">${item.badge.count}</span>`;
      }

      return `
        <li>
          <a href="${escapeHtmlText(hrefAttr)}" class="wo-shell-nav-item${activeClass}" data-nav-target="${escapeHtmlText(targetPayload)}" data-nav-view="${escapeHtmlText(item.id)}"${currentAttr}>
            <span class="wo-shell-nav-item-content">
              ${item.iconSvg}
              <span class="wo-shell-nav-label">${escapeHtmlText(item.label)}</span>
            </span>
            ${badgeHtml}
          </a>
        </li>
      `.trim();
    }).join('');

    return `
      <div class="wo-shell-nav-group">
        <h3 class="wo-shell-nav-group-title">${escapeHtmlText(group.title)}</h3>
        <ul class="wo-shell-nav-list">${itemsHtml}</ul>
      </div>
    `.trim();
  }).join('');

  // User Section
  const userName = opts.user?.name ?? 'Account User';
  const businessName = opts.user?.businessName ?? 'WashOps Pressure Washing';
  const initials = opts.user?.initials ?? (userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'WO');

  const userSectionHtml = `
    <div class="wo-shell-user-section">
      <div class="wo-shell-user-info">
        <div class="wo-shell-avatar" aria-hidden="true">${escapeHtmlText(initials)}</div>
        <div class="wo-shell-user-details">
          <span class="wo-shell-user-name">${escapeHtmlText(userName)}</span>
          <span class="wo-shell-user-business">${escapeHtmlText(businessName)}</span>
        </div>
      </div>
      <button type="button" class="wo-shell-sign-out" onclick="window.signOutApplication ? window.signOutApplication() : undefined" aria-label="Sign out">
        ${SHELL_ICONS.signOut}
      </button>
    </div>
  `.trim();

  let headerHtml = `
    <div class="wo-shell-brand">
      <a href="#/dashboard" class="wo-shell-logo" data-nav-target='{"kind":"view","view":"dashboard"}'>
        <span>WashOps</span>
        <span class="wo-shell-logo-badge">CRM</span>
      </a>
    </div>
  `;

  if (isDrawer) {
    headerHtml = `
      <div class="wo-shell-drawer-header">
        <a href="#/dashboard" class="wo-shell-logo" data-nav-target='{"kind":"view","view":"dashboard"}'>
          <span>WashOps</span>
          <span class="wo-shell-logo-badge">CRM</span>
        </a>
        <button type="button" class="wo-shell-menu-button" data-shell-drawer-close aria-label="Close navigation menu">
          ${SHELL_ICONS.close}
        </button>
      </div>
    `;
  }

  return `
    <aside class="${sidebarClass}">
      ${headerHtml}
      <nav class="wo-shell-nav" aria-label="${isDrawer ? 'Mobile Navigation' : 'Primary Navigation'}">
        ${groupsHtml}
      </nav>
      ${userSectionHtml}
    </aside>
  `.trim();
}

// ============================================================================
// 5. TOPBAR RENDERER
// ============================================================================

export function renderShellTopbar(opts: ShellTopbarOptions): string {
  const subtitleHtml = opts.subtitle ? `<span class="wo-shell-topbar-subtitle">${escapeHtmlText(opts.subtitle)}</span>` : '';
  const actionsHtml = opts.headerActionsHtml ? `<div class="wo-shell-topbar-actions">${opts.headerActionsHtml}</div>` : '';

  return `
    <header class="wo-shell-topbar">
      <div class="wo-shell-topbar-left">
        <button type="button" class="wo-shell-menu-button" data-shell-drawer-toggle aria-label="Open navigation menu" aria-expanded="false" aria-controls="wo-shell-drawer">
          ${SHELL_ICONS.menu}
        </button>
        <div class="wo-shell-title-group">
          <h1 class="wo-shell-topbar-title">${escapeHtmlText(opts.title)}</h1>
          ${subtitleHtml}
        </div>
      </div>
      ${actionsHtml}
    </header>
  `.trim();
}

// ============================================================================
// 6. GLOBAL APPLICATION SHELL RENDERER
// ============================================================================

export function renderApplicationShell(opts: ApplicationShellOptions): string {
  const sidebarHtml = renderShellSidebar({
    activeView: opts.activeView,
    activeNavId: opts.activeNavId,
    navContext: opts.navContext,
    navGroups: opts.navGroups,
    user: opts.user
  });

  const drawerSidebarHtml = renderShellSidebar({
    activeView: opts.activeView,
    activeNavId: opts.activeNavId,
    navContext: opts.navContext,
    navGroups: opts.navGroups,
    user: opts.user,
    isDrawer: true
  });

  const topbarHtml = renderShellTopbar({
    activeView: opts.activeView,
    title: opts.title,
    subtitle: opts.subtitle,
    headerActionsHtml: opts.headerActionsHtml,
    user: opts.user
  });

  const variantClass = opts.contentVariant === 'wide' ? 'wo-shell-main--wide' : 'wo-shell-main--standard';
  const customClass = opts.className ? ` ${opts.className}` : '';

  return `
    <div class="wo-shell${customClass}">
      ${sidebarHtml}
      <div id="wo-shell-drawer-backdrop" class="wo-shell-drawer-backdrop" hidden role="dialog" aria-modal="true" aria-label="Navigation drawer">
        <div id="wo-shell-drawer">
          ${drawerSidebarHtml}
        </div>
      </div>
      <div class="wo-shell-body">
        ${topbarHtml}
        <main class="wo-shell-main ${variantClass}">
          ${opts.contentHtml}
        </main>
      </div>
    </div>
  `.trim();
}

// ============================================================================
// 7. SHELL DOM INTERACTION CONTROLLER (DRAWER / ACCESSIBILITY / ROUTING)
// ============================================================================

interface InertEntry {
  element: HTMLElement;
  prevInert: boolean;
  prevAriaHidden: string | null;
}

function applyInertToBackground(dialogEl: HTMLElement): () => void {
  const entries: InertEntry[] = [];
  let current: HTMLElement | null = dialogEl;

  while (current && current !== document.body && current.parentElement) {
    const parent: HTMLElement = current.parentElement;
    const siblings = Array.from(parent.children) as HTMLElement[];

    for (const sibling of siblings) {
      if (sibling !== current && sibling.nodeType === 1 && !sibling.contains(dialogEl)) {
        entries.push({
          element: sibling,
          prevInert: (sibling as any).inert === true,
          prevAriaHidden: sibling.getAttribute('aria-hidden')
        });

        (sibling as any).inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      }
    }
    current = parent;
  }

  return () => {
    for (const entry of entries) {
      (entry.element as any).inert = entry.prevInert;
      if (entry.prevAriaHidden !== null) {
        entry.element.setAttribute('aria-hidden', entry.prevAriaHidden);
      } else {
        entry.element.removeAttribute('aria-hidden');
      }
    }
  };
}

export interface ShellController {
  destroy: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export function initApplicationShell(
  containerEl: HTMLElement,
  opts: { onNavigate?: (target: ShellNavigationTarget) => void } = {}
): ShellController {
  const drawerBackdrop = containerEl.querySelector<HTMLElement>('#wo-shell-drawer-backdrop');
  const drawer = containerEl.querySelector<HTMLElement>('#wo-shell-drawer');
  const menuToggle = containerEl.querySelector<HTMLElement>('[data-shell-drawer-toggle]');

  let restoreInert: (() => void) | null = null;
  let isOpen = false;

  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const getFocusableElements = (): HTMLElement[] => {
    if (!drawer) return [];
    return Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      el => el.offsetParent !== null || el === document.activeElement || el.tagName.toLowerCase() === 'button'
    );
  };

  const openDrawer = () => {
    if (!drawerBackdrop || isOpen) return;
    isOpen = true;
    drawerBackdrop.hidden = false;
    menuToggle?.setAttribute('aria-expanded', 'true');

    // Apply inert boundary to non-drawer content
    restoreInert = applyInertToBackground(drawerBackdrop);

    // Initial focus into drawer
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  };

  const closeDrawer = () => {
    if (!drawerBackdrop || !isOpen) return;
    isOpen = false;
    drawerBackdrop.hidden = true;
    menuToggle?.setAttribute('aria-expanded', 'false');

    if (restoreInert) {
      restoreInert();
      restoreInert = null;
    }

    // Restore focus to opener menu button
    menuToggle?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen || !drawerBackdrop) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer();
      return;
    }

    if (e.key === 'Tab') {
      const items = getFocusableElements();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !drawerBackdrop.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !drawerBackdrop.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Toggle button clicked
    if (target.closest('[data-shell-drawer-toggle]')) {
      e.preventDefault();
      if (isOpen) closeDrawer();
      else openDrawer();
      return;
    }

    // Close button clicked
    if (target.closest('[data-shell-drawer-close]')) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Backdrop clicked outside drawer
    if (isOpen && drawerBackdrop && target === drawerBackdrop) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Shell nav item or brand logo clicked -> single navigation authority across desktop & drawer
    const navLink = target.closest<HTMLElement>('.wo-shell-nav-item, .wo-shell-logo');
    if (navLink && containerEl.contains(navLink)) {
      if (isOpen) {
        closeDrawer();
      }
      if (opts.onNavigate) {
        e.preventDefault();
        const rawTarget = navLink.getAttribute('data-nav-target');
        if (rawTarget) {
          try {
            const parsed = JSON.parse(rawTarget) as ShellNavigationTarget;
            opts.onNavigate(parsed);
          } catch {
            const view = navLink.getAttribute('data-nav-view') || 'dashboard';
            opts.onNavigate({ kind: 'view', view });
          }
        } else {
          const view = navLink.getAttribute('data-nav-view') || 'dashboard';
          opts.onNavigate({ kind: 'view', view });
        }
      }
    }
  };

  const targetWindow = typeof window !== 'undefined' ? window : null;
  containerEl.addEventListener('click', handleClick);
  if (targetWindow) {
    targetWindow.addEventListener('keydown', handleKeyDown);
  } else {
    containerEl.addEventListener('keydown', handleKeyDown);
  }

  const destroy = () => {
    if (isOpen) {
      closeDrawer();
    }
    containerEl.removeEventListener('click', handleClick);
    if (targetWindow) {
      targetWindow.removeEventListener('keydown', handleKeyDown);
    } else {
      containerEl.removeEventListener('keydown', handleKeyDown);
    }
  };

  return { destroy, openDrawer, closeDrawer };
}
