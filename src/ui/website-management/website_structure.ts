import { escapeHtmlText } from '../../crm_html_output';
import type { Funnel, Website, WebsiteRoute } from '../../types';
import { isOwnedWebsiteFunnel } from '../../website_funnel_ownership';
import { renderButton, renderCard, renderEmptyState, renderField, renderInput, renderSelect, renderStatusBadge } from '../primitives';

export function getEligibleWebsiteStructureFunnels(input: {
  actingUserId: string;
  website: Website | undefined;
  funnels: Funnel[];
}): Funnel[] {
  return input.funnels.filter(funnel => isOwnedWebsiteFunnel(funnel, input.website, input.actingUserId));
}

export function isWebsiteStructureRouteDestination(input: {
  actingUserId: string;
  website: Website | undefined;
  funnel: Funnel | undefined;
}): boolean {
  return isOwnedWebsiteFunnel(input.funnel, input.website, input.actingUserId);
}

export function canDeleteWebsiteStructureRoute(route: Pick<WebsiteRoute, 'path'> | undefined): boolean {
  return !!route && route.path !== '/';
}

export interface WebsiteStructureRoute {
  id: string;
  path: string;
  destinationName: string;
  isHomepage: boolean;
}

export interface WebsiteStructureModel {
  websiteName: string;
  websiteUrl: string;
  routes: WebsiteStructureRoute[];
  canManageRoutes: boolean;
  unavailableReason?: string;
}

export interface WebsiteStructureActions {
  add: string;
  edit: (routeId: string) => string;
  view: (routeId: string) => string;
  remove: (routeId: string) => string;
}

export function renderWebsiteStructureContent(model: WebsiteStructureModel, actions: WebsiteStructureActions): string {
  const rows = model.routes.map(route => `<li class="wo-website-structure-row"><div class="wo-website-structure-route"><code>${escapeHtmlText(route.path)}</code>${route.isHomepage ? renderStatusBadge('homepage') : ''}</div><div class="wo-website-structure-destination"><strong>${escapeHtmlText(route.destinationName || 'Unknown page')}</strong><span>Destination page</span></div><div class="wo-website-structure-status">${renderStatusBadge('live')}</div><div class="wo-website-structure-actions">${actions.edit(route.id)}${actions.view(route.id)}${route.isHomepage ? '' : actions.remove(route.id)}</div></li>`).join('');
  const content = rows ? `<ol class="wo-website-structure-list">${rows}</ol>` : renderEmptyState({ title: 'No routes configured', description: 'This website does not have any route mappings yet.' });
  const manageNote = model.canManageRoutes ? '' : `<p id="website-structure-unavailable" class="wo-website-structure-unavailable" role="status">${escapeHtmlText(model.unavailableReason ?? 'Route changes are unavailable in this environment.')}</p>`;
  return `<section class="wo-website-structure" aria-label="Website Structure"><div class="wo-website-structure-identity">${renderCard({ bodyHtml: `<div><span class="wo-website-structure-eyebrow">Public website address</span><strong>${escapeHtmlText(model.websiteName)}</strong><a href="${escapeHtmlText(model.websiteUrl)}" target="_blank" rel="noreferrer">${escapeHtmlText(model.websiteUrl)}</a></div>${actions.view('')}` })}</div>${renderCard({ className: 'wo-website-structure-card', bodyHtml: `<div class="wo-website-structure-heading"><div><h2>Mapped routes</h2><p>Review how this website’s URLs connect to destination pages.</p></div>${actions.add}</div>${manageNote}${content}` })}</section>`;
}

export function renderWebsiteStructureRouteModal(input: { funnels: Array<{ id: string; name: string }>; }): string {
  const destinationField = renderField({
    id: 'route-funnel-id',
    label: 'Destination page',
    required: true,
    controlHtml: renderSelect({
      id: 'route-funnel-id',
      required: true,
      options: input.funnels.map(funnel => ({ value: funnel.id, label: funnel.name }))
    })
  });
  return `<div class="wo-website-structure-modal-backdrop" role="presentation" onkeydown="if (event.key === 'Escape') { event.preventDefault(); window.closeWebsiteStructureRouteModal(); }"><section class="wo-website-structure-modal" role="dialog" aria-modal="true" aria-labelledby="website-structure-route-title" aria-describedby="website-structure-route-description"><div class="wo-website-structure-heading"><div><h2 id="website-structure-route-title">Add website route</h2><p id="website-structure-route-description">Map a URL to a page on this website.</p></div>${renderButton({ label: 'Close', ariaLabel: 'Close add route', variant: 'ghost', icon: '×', iconOnly: true, attributes: { onclick: 'window.closeWebsiteStructureRouteModal()' } })}</div><form class="wo-website-structure-form" onsubmit="event.preventDefault(); window.saveRoute();">${renderField({ id: 'route-path', label: 'URL path', required: true, helperText: 'The URL relative to this website’s domain.', controlHtml: renderInput({ id: 'route-path', placeholder: 'driveway-cleaning', required: true }) })}${destinationField}<div class="wo-website-structure-modal-actions">${renderButton({ label: 'Cancel', variant: 'secondary', attributes: { onclick: 'window.closeWebsiteStructureRouteModal()' } })}${renderButton({ label: 'Create route', variant: 'primary', type: 'submit' })}</div></form></section></div>`;
}
