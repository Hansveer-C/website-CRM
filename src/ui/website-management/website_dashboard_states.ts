import { renderButton, renderCard, renderEmptyState, renderErrorState, renderField, renderSelect, renderSpinner } from '../primitives';
import type { Website } from '../../types';

type WebsiteManagementView = 'website-settings' | 'funnels' | 'website-navigation' | 'website-structure' | 'seo-pages';

const dashboardRetry = () => renderButton({
  label: 'Retry',
  variant: 'secondary',
  attributes: { onclick: 'window.refreshWebsiteDashboard()' }
});

const dashboardStateCard = (bodyHtml: string, className: string, role?: 'status' | 'alert') =>
  `<section class="wo-website-dashboard-state ${className}"${role ? ` role="${role}"` : ''}>${renderCard({ bodyHtml })}</section>`;

export function renderWebsiteDashboardLoading(): string {
  return dashboardStateCard(
    `<div class="wo-website-dashboard-state-loading" role="status" aria-live="polite">${renderSpinner({ ariaLabel: 'Loading website dashboard…' })}<span>Loading website dashboard…</span></div>`,
    'wo-website-dashboard-state--loading'
  );
}

export function renderWebsiteDashboardSelectionRequired(websites: readonly Website[]): string {
  const selectHtml = renderSelect({
    id: 'dashboard-website-select',
    options: [
      { value: '', label: 'Select a website' },
      ...websites.map(site => ({ value: site.id, label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}` }))
    ],
    attributes: { onchange: 'window.selectDashboardWebsite(this.value)' }
  });
  return dashboardStateCard(
    `<div class="wo-website-dashboard-state-copy"><h2>Choose a website</h2><p>Select an owned website to manage its draft and published experience.</p></div>${renderField({ id: 'dashboard-website-select', label: 'Website', controlHtml: selectHtml })}`,
    'wo-website-dashboard-state--selection'
  );
}

export function renderWebsiteDashboardEmpty(): string {
  return dashboardStateCard(
    renderEmptyState({
      title: 'Create your first website.',
      description: 'Add your business details and we will create an editable homepage and site structure.',
      actionHtml: `<div class="wo-website-dashboard-state-actions">${renderButton({ label: 'Create your website', variant: 'primary', attributes: { onclick: 'window.showOnboardingModal()' } })}${dashboardRetry()}</div>`
    }),
    'wo-website-dashboard-state--empty',
    'status'
  );
}

export function renderWebsiteDashboardUnavailable(): string {
  return dashboardStateCard(
    renderErrorState({
      title: 'This website is not available.',
      message: 'Check your access or choose another owned website.',
      retryActionHtml: dashboardRetry()
    }),
    'wo-website-dashboard-state--unavailable',
    'alert'
  );
}

export function renderWebsiteDashboardError(): string {
  return dashboardStateCard(
    renderErrorState({
      title: 'Website information could not be loaded.',
      message: 'Please try again.',
      retryActionHtml: dashboardRetry()
    }),
    'wo-website-dashboard-state--error',
    'alert'
  );
}

export interface WebsiteManagementSelectorInput {
  view: WebsiteManagementView;
  title: string;
  websites: readonly Website[];
  invalid?: boolean;
}

export function renderWebsiteManagementSelectorContent(input: WebsiteManagementSelectorInput): string {
  const errorMessage = input.invalid ? 'That website is not available for this account. Choose an owned website.' : undefined;
  const selectHtml = renderSelect({
    id: 'management-website-select',
    invalid: Boolean(errorMessage),
    describedBy: errorMessage ? 'management-website-select-error' : undefined,
    options: [
      { value: '', label: 'Select a website' },
      ...input.websites.map(site => ({ value: site.id, label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}` }))
    ],
    attributes: { onchange: `window.selectWebsiteForManagement('${input.view}', this.value)` }
  });
  return `<section class="wo-website-management-selection">${renderCard({
    className: 'wo-website-management-selection-card',
    bodyHtml: `<div class="wo-website-dashboard-state-copy"><h2>Choose a website</h2><p>${errorMessage ?? `Select the website whose ${input.title.toLowerCase()} you want to manage.`}</p></div>${renderField({ id: 'management-website-select', label: 'Website', controlHtml: selectHtml, errorMessage })}`
  })}</section>`;
}

export function renderWebsiteManagementSwitcher(input: { view: WebsiteManagementView; websites: readonly Website[]; actingUserId: string; activeWebsiteId: string | null }): string {
  const ownedWebsites = input.websites.filter(site => site.user_id === input.actingUserId);
  if (ownedWebsites.length < 2 || !input.activeWebsiteId) return '';
  return `<div class="wo-website-management-switcher">${renderField({
    id: 'management-website-select',
    label: 'Active website',
    controlHtml: renderSelect({
      id: 'management-website-select',
      options: ownedWebsites.map(site => ({ value: site.id, label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}`, selected: site.id === input.activeWebsiteId })),
      attributes: { onchange: `window.selectWebsiteForManagement('${input.view}', this.value)` }
    })
  })}</div>`;
}
