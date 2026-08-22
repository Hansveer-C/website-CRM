import { escapeHtmlText } from '../../crm_html_output';
import type { Funnel, Website, WebsiteRoute } from '../../types';
import { renderCard, renderEmptyState, renderStatusBadge } from '../primitives';

export interface SitePagesViewModel {
  website?: Website;
  rows: Array<{ funnel: Funnel; route: WebsiteRoute }>;
}

export function createSitePagesViewModel(input: {
  userId: string;
  activeWebsiteId: string | null;
  websites: readonly Website[];
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
}): SitePagesViewModel {
  const website = input.websites.find(site => site.user_id === input.userId && site.id === input.activeWebsiteId);
  if (!website) return { rows: [] };
  const routes = input.routes.filter(route => route.website_id === website.id);
  const rows = input.funnels
    .filter(funnel => funnel.user_id === input.userId)
    .map(funnel => ({ funnel, route: routes.find(route => route.funnel_id === funnel.id) }))
    .filter((row): row is { funnel: Funnel; route: WebsiteRoute } => Boolean(row.route));
  return { website, rows };
}

export interface SitePagesRenderInput {
  model: SitePagesViewModel;
  renderManageAction: (funnelId: string) => string;
  renderDeleteAction: (routeId: string, funnelId: string) => string;
}

export function renderSitePagesContent(input: SitePagesRenderInput): string {
  const rows = input.model.rows.map(({ funnel, route }) => {
    const actions = `<div class="wo-site-pages-actions">${input.renderManageAction(funnel.id)}${route.path !== '/' ? input.renderDeleteAction(route.id, funnel.id) : ''}</div>`;
    return `<tr class="wo-site-pages-row"><td data-label="Page name"><strong>${escapeHtmlText(funnel.name || 'Untitled Page')}</strong></td><td data-label="Web address"><code>${escapeHtmlText(route.path)}</code></td><td data-label="Status">${renderStatusBadge(funnel.status)}</td><td data-label="Actions">${actions}</td></tr>`;
  }).join('');
  const list = rows
    ? `<div class="wo-site-pages-table-wrap"><table class="wo-site-pages-table"><thead><tr><th>Page name</th><th>Web address</th><th>Status</th><th><span class="wo-sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : renderEmptyState({ title: 'No Site Pages yet', description: 'No Site Pages exist for this website yet.' });
  return `<section class="wo-site-pages" aria-label="Site Pages">${renderCard({ className: 'wo-site-pages-card', bodyHtml: list })}</section>`;
}
