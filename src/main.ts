import { mockContacts, mockOpportunities, mockPipelines, mockActivities, mockQuotes, mockQuoteItems, mockInvoices, mockPages, mockPageSections, mockComponents, mockWebsiteSettings, mockFunnels, mockWebsiteLayouts, mockWebsites, mockWebsiteRoutes, mockTemplates } from './db';
import { escapeHtmlText, safeTelHref, safeNavHref } from './crm_html_output';
import { contactMatchesClientSearch, formatContactPhone, hasContactPhone } from './crm_contact_phone';
import { templates } from './templates';
import { Activity, Contact, Funnel, Page, PageSection, User, Website, WebsiteLayout, WebsiteRoute, WebsiteSettings } from './types';
import { createBuilderSection, getBuilderSectionDefinition, isRegisteredBuilderSectionType } from './builder_section_registry';
import type { BuilderInspectorFieldDefinition, BuilderInspectorTab } from './builder_inspector_schema';
import { createBuilderInspectorPatch, getBuilderInspectorField, getBuilderInspectorFieldValue, getBuilderInspectorSchema } from './builder_inspector_schema';
import { resolveWebsiteRequest } from './website_resolver';
import { normalizePhone, normalizeEmail, normalizeName } from './utils/validators';
import { LocalStorageBuilderPublicationRepository } from './builder_publication_repository_local';
import { SupabaseBuilderPublicationRepository } from './builder_publication_repository_supabase';
import { handleBuilderPublicationRuntimeBrowserRequest, isBuilderPublicationBrowserRequest } from './builder_publication_browser';
import { createBuilderPublicationRuntimeResolver } from './builder_publication_runtime';
import type { BuilderPublicationRuntimeResult } from './builder_publication_runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuilderMediaAsset } from './builder_media_asset';
import { BuilderMediaController } from './builder_media_controller';
import { IndexedDbBuilderMediaDatabase, LocalBuilderMediaRepository } from './builder_media_repository_local';
import { SupabaseBuilderMediaRepository } from './builder_media_repository_supabase';
import { createBuilderMediaRuntime } from './builder_media_runtime';
import { builderDocumentToPageSections, createBuilderDocument, validateBuilderDocument } from './builder_document';
import type { BuilderDocument } from './builder_document';
import { resolveBuilderFixtureSectionRoute } from './builder_fixture_section_route';
import { BuilderPageRevisionAuthority } from './builder_page_revision_authority';
import {
  BuilderHistoryController,
  BuilderSerializedSaveQueue,
  handleBuilderHistoryKeyboardShortcut
} from './builder_history_controller';
import {
  renderCard,
  renderField,
  renderSelect,
  renderStatusBadge,
  getFieldAccessibilityProps,
  renderApplicationShell,
  renderShellSidebar,
  getDefaultNavGroups,
  initApplicationShell,
  resolveFunnelDetailMode,
  type ShellController,
  type ShellUser,
  type ShellNavigationTarget,
  type ApplicationShellOptions
} from './ui';
import {
  createDashboardLoadingShellOptions,
  createDashboardShellOptions,
  createDashboardViewModel,
  type DashboardDataAvailability
} from './ui/dashboard';
import {
  renderClientsContent,
  renderClientsLoading,
  renderContactDetailContent,
  renderContactDetailLoading,
  type ContactFilter
} from './ui/contacts';
import { renderOpportunitiesContent } from './ui/opportunities';
import {
  BUILDER_PAGE_NAME_MAX_LENGTH,
  BUILDER_PAGE_SLUG_MAX_LENGTH,
  BUILDER_SEO_DESCRIPTION_MAX_LENGTH,
  BUILDER_SEO_TITLE_MAX_LENGTH,
  applyBuilderPageSettings,
  normalizeBuilderPageSettings,
  pageToBuilderPageSettings,
  validateBuilderPageSettings,
  type BuilderPageSettingsField,
  type BuilderPageSettingsPatch
} from './builder_page_settings';
import {
  BuilderPageSettingsController,
  type BuilderPageSettingsPersistResult
} from './builder_page_settings_controller';
import {
  createBuilderNewPageDefaults,
  getEligibleNewPageDestinations,
  isExpectedCreatedBuilderPage,
  validateBuilderNewPageInput,
  type BuilderNewPageValidationField
} from './builder_new_page';
import {
  BuilderNewPageController,
  type BuilderNewPageContext,
  type BuilderNewPagePersistResult
} from './builder_new_page_controller';
import {
  BuilderDuplicatePageController,
  type BuilderDuplicatePagePersistResult
} from './builder_duplicate_page_controller';
import {
  BuilderDeletePageController,
  type BuilderDeletePagePersistResult
} from './builder_delete_page_controller';
import { BuilderReorderPagesController } from './builder_reorder_pages_controller';
import { handleBuilderReorderPagesBrowserPost as handleBuilderReorderPagesBrowserPostImpl } from './builder_reorder_browser';
import { BuilderSetHomepageController } from './builder_set_homepage_controller';
import { handleBuilderSetHomepageBrowserPost as handleBuilderSetHomepageBrowserPostImpl } from './builder_homepage_browser';
import { BuilderPageRouteController } from './builder_page_route_controller';
import { createPageRouteViewModel, type PageRouteViewModel } from './builder_page_route_model';
import { PagesRepo } from './pages_repo_supabase';
import {
  createBuilderPublishedRevision,
  getBuilderPublicationState,
  hasBuilderUnpublishedChanges
} from './builder_publication';
import type { BuilderPublishedRevision } from './builder_publication';
import type { BuilderPublicationHistoryPage, BuilderPublicationTarget } from './builder_publication_repository';
import {
  createBuilderPageRevision,
  getBuilderPagePublication,
  listBuilderPageRevisions,
  publishBuilderPageRevision,
  rollbackBuilderPageRevision
} from './builder_publication_client';
import { loadBuilderPublicRevision } from './builder_publication_public';
import { adaptPublicSitePayload, type PublicSiteRenderModel } from './public_site_adapter';
import { getPublicSitePayload } from './public_site_client';
import {
  derivePublicSiteLocation,
  resolvePublicSiteRuntime,
  type PublicSiteRuntimeResult
} from './public_site_runtime';
import { submitPublicLead } from './public_lead_client';
import { resolvePublicLeadRuntime, shouldUsePublicLeadEdge } from './public_lead_runtime';
import { FormSubmissionIdempotency } from './form_submission_idempotency';
import { validateSelectedQuoteTier } from './quote_tier_validation';
import { shouldShowWebsiteOnboarding } from './website_onboarding_gate';
import { buildAuthenticatedPreviewUrl, resolveAuthenticatedPreview } from './authenticated_preview_route';
import {
  BUILDER_SETUP_SERVICE_CATALOG,
  parseBuilderSetupBrief,
  validateBuilderSetupBrief,
  type BuilderSetupBriefV1,
  type BuilderSetupService,
  type BuilderSetupTemplateId
} from './builder_setup_brief';
import { BuilderSetupController } from './builder_setup_controller';
import { BUILDER_SETUP_TEMPLATES, type BuilderSetupApplyMode } from './builder_template_generator';
import {
  buildBuilderNavigationTarget,
  parseBuilderNavigationTarget,
  resolveBuilderNavigationTarget,
  type BuilderNavigationAction
} from './builder_navigation';
import {
  BuilderNavigationUiManager,
  renderBuilderNavigationPanel,
  renderNavigationItemModal,
  renderNavigationPublishModal,
  type NavigationUiContext
} from './builder_site_navigation_ui';
import { BuilderSiteNavigationController } from './builder_site_navigation_controller';
import { BuilderSiteNavigationPublishController } from './builder_site_navigation_publish_controller';
import {
  BuilderSiteNavigationRepository,
  MockBuilderSiteNavigationRepository
} from './builder_site_navigation_repository';
import { SupabaseBuilderSiteNavigationRepository } from './builder_site_navigation_repository_supabase';
import { BuilderUnifiedPublicationController } from './builder_unified_publication_controller';
import { SupabaseBuilderUnifiedPublicationRepository } from './builder_unified_publication_repository_supabase';
import { renderUnifiedPublishModal } from './builder_unified_publication_ui';
import type { NavigationMenuScope } from './builder_site_navigation_domain';
import { WebsiteDashboardController, type WebsiteDashboardCoreData } from './website_dashboard_controller';
import { getWebsiteScopedPages, resolveWebsiteHomepage, type WebsiteDashboardModel, type WebsiteDashboardSummaryInput } from './website_dashboard_model';
import { createBrowserCallSimulator } from './browser_call_simulation';
import { isCrmApplicationHost } from './application_host';
import { resolveApplicationHostRoute } from './application_host_route';
import { CrmProductionHydrator, type CrmHydrationClient } from './crm_production_hydration';
import { WebsiteLayoutHydrator, type WebsiteLayoutHydrationClient } from './website_layout_hydration';
import { WebsiteSettingsHydrator, type WebsiteSettingsHydrationClient } from './website_settings_hydration';
import {
  ProtectedAsyncOperationGuard,
  SupersededOperationError,
  isSupersededOperationError,
  type ProtectedAsyncOperationToken
} from './website_dashboard_hydration_guard';
import {
  buildWebsiteManagementRoute,
  buildWebsiteSettingsRoute,
  parseWebsiteManagementRoute,
  parseWebsiteSettingsRoute,
  resolveWebsiteSettingsSelection,
  type WebsiteManagementView,
  type WebsiteSettingsRouteSelection
} from './website_settings_selection';
import { resolveSiteRenderPage } from './site_render_page_resolution';
import {
  createProductionLead,
  saveProductionQuote,
  type CrmMutationClient
} from './crm_production_mutations';
import {
  ApplicationAuthController,
  createApplicationSignupRedirect,
  type ApplicationAuthClient,
  type ApplicationAuthState
} from './application_auth';
import {
  buildApplicationLoginHash,
  getLoginReturnRoute,
  resolveApplicationBootstrap,
  sanitizeApplicationReturnRoute
} from './application_bootstrap';
import { resolveEditorRuntime } from './editor_runtime';
import { WebsiteGenerationClient, WebsiteGenerationClientError, createWebsiteGenerationIdempotencyKey } from './website_generation_client';
import { isWebsiteGenerationResponse, validateWebsiteGenerationInput, type WebsiteGenerationData } from './website_generation_contract';
import { WebsiteGenerationAuthority, type WebsiteGenerationAuthorityToken } from './website_generation_authority';
import { createBuilderSectionId } from './builder_section_id';
import { createPageSectionRevisionClient, createPageSectionSaveClient } from './page_section_save_client';
import { BuilderSaveStateController, builderSaveStatusLabel } from './builder_save_state';
import { BuilderViewTransitionController } from './builder_view_transition';

declare global {
  interface Window {
    navigateTo: (view: string, id?: string, context?: any) => Promise<void>;
    resolveWebsiteRequest: typeof resolveWebsiteRequest;
    showToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number) => void;
    funnelMode?: 'website' | 'marketing';
    currentUser?: string;
    userSlug?: string;
    [key: string]: any;
  }
}

/**
 * 🌐 FRONTEND API BRIDGE
 * These stubs replace direct backend function calls to prevent credential leakage.
 * These utilize regional mock data (db.ts) to maintain UI functionality without direct DB access.
 */
export const getWebsiteSettings = () => mockWebsiteSettings;
export const getWebsiteLayout = () => mockWebsiteLayouts[0]; // Simplified for now
export const persistWebsiteSettings = async (data: any) => {
    console.log('[API STUB] Saving settings:', data);
    return { success: true }; 
};

function applyPrimaryColor(color?: string): void {
  if (!color || typeof document === 'undefined' || !document.documentElement?.style) return;
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--primary-color', color);
}
const getEvents = () => [] as any[];
const getAllMessagesOrdered = () => [] as any[];
const getCallsForContact = () => [] as any[];
const mockAutomationLogs: string[] = [];

function runAutomations(type: string, data: any) {
  if (type === 'LEAD_CAPTURED') {
    const lead = data;
    const triggerId = `auto_sms_lead_${lead.id}`;
    
    // 🌿 WB.5.2: Idempotency check (Zero Lead Loss / No Spam)
    if (mockAutomationLogs.includes(triggerId)) return;
    mockAutomationLogs.push(triggerId);

    console.log(`[AUTOMATION] Lead auto SMS skipped in browser mock context for ${lead.phone}.`);
  }

  if (type === 'OPPORTUNITY_CREATED') {
    const opp = data;
    console.log(`[AUTOMATION] Opportunity created for contact ${opp.contact_id}`);
  }
}
const checkOverdueInvoices = () => { console.log('[API STUB] Checking overdue invoices'); };
const getLatestActivity = (): any => null;
const createLead = async (data: any) => {
    return fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create lead');
        return json;
    });
};

function upsertById(list: any[], item: any) {
    const index = list.findIndex(existing => existing.id === item.id);
    if (index >= 0) {
        list[index] = item;
    } else {
        list.push(item);
    }
}

function hydrateLocalMockCrm(userId: string = 'system') {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
        const contacts = JSON.parse(window.localStorage.getItem(`mock_crm_contacts_${userId}`) || '[]');
        if (Array.isArray(contacts)) contacts.forEach(contact => upsertById(mockContacts, contact));
    } catch (err) {
        console.warn('[CRM MOCK] Ignoring corrupted local contact cache:', err);
    }

    try {
        const opportunities = JSON.parse(window.localStorage.getItem(`mock_crm_opportunities_${userId}`) || '[]');
        if (Array.isArray(opportunities)) opportunities.forEach(opportunity => upsertById(mockOpportunities, opportunity));
    } catch (err) {
        console.warn('[CRM MOCK] Ignoring corrupted local opportunity cache:', err);
    }
}

function persistLocalMockCrm(userId: string = 'system') {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`mock_crm_contacts_${userId}`, JSON.stringify(mockContacts.filter(contact => contact.user_id === userId)));
    window.localStorage.setItem(`mock_crm_opportunities_${userId}`, JSON.stringify(mockOpportunities.filter(opportunity => opportunity.user_id === userId)));
}

function createLocalMockWebsiteLead(body: any, userId: string, isRepeat: boolean) {
    hydrateLocalMockCrm(userId);
    const timestamp = new Date().toISOString();
    const cleanAttributionBlock = `Lead Attribution:\n` +
        `- Source Page: ${body.source_page || '/'}\n` +
        `- Page Type: ${body.source_page_type || 'unknown'}\n` +
        `- Landing Page: ${body.landing_page || body.source_page || '/'}\n` +
        `- Service: ${body.source_service || body.service_type || 'N/A'}\n` +
        `- City: ${body.source_city || body.city || 'N/A'}\n` +
        `- Referrer: ${body.referrer || ''}`;

    let contact = mockContacts.find(c =>
        c.user_id === userId &&
        ((body.email && c.email === body.email) || (body.phone && c.phone === body.phone))
    );

    if (contact) {
        contact.notes = contact.notes ? `${contact.notes}\n\n${cleanAttributionBlock}` : cleanAttributionBlock;
        contact.source = contact.source || body.source || 'public website';
        contact.service = contact.service || body.source_service || body.service_type;
    } else {
        contact = {
            id: `c-${Date.now()}`,
            user_id: userId,
            name: body.name,
            phone: body.phone || '',
            email: body.email || '',
            address: body.address || 'Public website submission',
            tags: ['web-lead'],
            source: body.source || 'public website',
            service: body.source_service || body.service_type,
            status: 'lead',
            created_at: timestamp,
            notes: cleanAttributionBlock
        };
        mockContacts.push(contact);
    }

    let opportunity = mockOpportunities.find(o =>
        o.user_id === userId &&
        o.contact_id === contact.id &&
        o.status === 'open'
    );

    if (opportunity) {
        opportunity.notes = opportunity.notes ? `${opportunity.notes}\n\n${cleanAttributionBlock}` : cleanAttributionBlock;
        opportunity.source = opportunity.source || body.source || 'public website';
        opportunity.service = opportunity.service || body.source_service || body.service_type;
        opportunity.page_slug = opportunity.page_slug || body.page_slug || body.source_page || '';
    } else {
        opportunity = {
            id: `opp-${Date.now()}`,
            user_id: userId,
            contact_id: contact.id,
            pipeline_stage: 'New Lead',
            value: 0,
            assigned_to: 'Unassigned',
            status: 'open',
            notes: `Service Type: ${body.service_type || 'N/A'}\nAddress: ${body.address || 'N/A'}\nMessage: ${body.message || 'N/A'}\n[Funnel: ${body.funnel_id || 'N/A'}] [Page: ${body.page_id || 'N/A'}]\n\n${cleanAttributionBlock}`,
            funnel_id: body.funnel_id,
            page_slug: body.page_slug || body.source_page || '',
            source: body.source || 'public website',
            service: body.source_service || body.service_type,
            city: body.source_city || body.city,
            created_at: timestamp
        };
        mockOpportunities.push(opportunity);
    }

    persistLocalMockCrm(userId);
    return { contact, opportunity, isRepeat };
}

const handleInboundCall = async (payload: { phone: string }) => {
    return fetch('/api/calls/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to start call');
        return json;
    });
};
const endCall = async (payload: { call_id: string, answered?: boolean, duration?: number }) => {
    return fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to end call');
        return json;
    });
};
const sendMessageToContact = async (id: string, msg: string, source: string = 'manual') => {
    return fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: id, message: msg, source })
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send SMS');
        return json;
    });
};
const retryMessage = async (id: string) => {
    return fetch(`/api/messages/${id}/retry`, { method: 'POST' }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to retry message');
        return json;
    });
};







// Initialize and Validate Configs
// Twilio check removed from frontend for security (Phase 7.5 Migration)

// Globals for Phase testing
(window as any).sendMessageToContact = sendMessageToContact;
(window as any).retryMessage = retryMessage;
(window as any).getAllMessagesOrdered = getAllMessagesOrdered;

/**
 * Mock API Interceptor (Service Layer simulated via fetch)
 * This allows the frontend to call fetch('/api/...') and have it handled
 * by the actual backend controller logic in a unified way.
 */
function actingBuilderPublicationUserId(user: User | string): string | undefined {
    const userId = typeof user === 'string' ? user : user?.id;
    return typeof userId === 'string' && userId.trim() ? userId : undefined;
}

function normalizeBuilderPublicationPath(path: string): string {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
    if (withLeadingSlash === '/home') return '/';
    return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
        ? withLeadingSlash.slice(0, -1)
        : withLeadingSlash;
}

function canAccessBuilderPublicationPage(
    user: User | string,
    websiteId: string,
    pageId: string
): boolean {
    const userId = actingBuilderPublicationUserId(user);
    if (!userId) return false;

    const website = mockWebsites.find(item => item.id === websiteId);
    if (!website || website.user_id !== userId) return false;

    const page = mockPages.find(item => item.id === pageId);
    if (!page || page.user_id !== userId) return false;

    const websiteRoutes = mockWebsiteRoutes.filter(route => route.website_id === website.id);
    const pagePath = normalizeBuilderPublicationPath(
        page.slug === 'home' ? '/' : `/${page.slug}`
    );
    const directlyRouted = websiteRoutes.some(route => {
        const routeWithPage = route as WebsiteRoute & { page_id?: string };
        return routeWithPage.page_id === page.id
            || route.slug === page.slug
            || normalizeBuilderPublicationPath(route.path || '/') === pagePath;
    });
    if (directlyRouted) return true;

    const homepageRoute = websiteRoutes.find(
        route => normalizeBuilderPublicationPath(route.path || '/') === '/'
    );
    const homepagePage = homepageRoute
        ? resolvePageForPreviewPath('/', homepageRoute.funnel_id)
        : website.homepage_funnel_id
            ? mockPages.find(item => item.funnel_id === website.homepage_funnel_id)
            : undefined;
    if (homepagePage?.id === page.id) return true;

    const ownedFunnel = page.funnel_id
        ? mockFunnels.find(funnel => funnel.id === page.funnel_id && funnel.user_id === userId)
        : undefined;
    if (ownedFunnel && website.homepage_funnel_id === ownedFunnel.id) return true;
    if (ownedFunnel && websiteRoutes.some(route => route.funnel_id === ownedFunnel.id)) return true;

    const ownerWebsites = mockWebsites.filter(item => item.user_id === userId);
    return ownerWebsites.length === 1;
}

type BuilderPublicationViteEnvironment = {
    VITE_BUILDER_PUBLICATION_PERSISTENCE?: string;
    VITE_BUILDER_MEDIA_PERSISTENCE?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    VITE_ENABLE_BROWSER_FIXTURES?: string;
    VITE_BROWSER_FIXTURE_ZERO_WEBSITE?: string;
    PROD?: boolean;
};

const builderPublicationEnvironment = (
    import.meta as unknown as { env: BuilderPublicationViteEnvironment }
).env;
const builderPublicationConfiguredMode = builderPublicationEnvironment
    .VITE_BUILDER_PUBLICATION_PERSISTENCE;
const builderPublicationSupabaseUrl = builderPublicationEnvironment.VITE_SUPABASE_URL?.trim() || '';
const builderPublicationSupabaseKey = builderPublicationEnvironment
    .VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || builderPublicationEnvironment.VITE_SUPABASE_ANON_KEY?.trim()
    || '';
const builderPublicationProduction = builderPublicationEnvironment.PROD === true;

function isBrowserSafeBuilderSupabaseKey(value: string): boolean {
    if (value.startsWith('sb_publishable_')) {
        return value.length > 'sb_publishable_'.length;
    }
    if (!value.startsWith('eyJ')) return false;
    try {
        const encodedPayload = value.split('.')[1];
        if (!encodedPayload) return false;
        const payload = JSON.parse(atob(
            encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
                .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')
        )) as { role?: unknown };
        return payload.role === 'anon';
    } catch {
        return false;
    }
}

const builderPublicationSupabaseConfigured = /^https:\/\//i.test(builderPublicationSupabaseUrl)
    && isBrowserSafeBuilderSupabaseKey(builderPublicationSupabaseKey);
const editorRuntime = resolveEditorRuntime({
    production: builderPublicationProduction,
    supabaseConfigured: builderPublicationSupabaseConfigured,
    publicationMode: builderPublicationConfiguredMode,
    mediaMode: builderPublicationEnvironment.VITE_BUILDER_MEDIA_PERSISTENCE
});
const browserFixturesEnabled = !builderPublicationProduction
    && builderPublicationEnvironment.VITE_ENABLE_BROWSER_FIXTURES?.trim().toLowerCase() === 'true';
document.documentElement.dataset.editorRuntime = editorRuntime.success ? editorRuntime.mode : 'unavailable';
if (!builderPublicationProduction) {
    console.info(`Editor runtime: ${document.documentElement.dataset.editorRuntime}; browser fixtures: ${browserFixturesEnabled ? 'enabled' : 'disabled'}`);
}
let builderPublicationSupabaseClientPromise: Promise<SupabaseClient | null> | undefined;

function getBuilderPublicationSupabaseClient(): Promise<SupabaseClient | null> {
    if (!builderPublicationSupabaseConfigured) return Promise.resolve(null);
    if (!builderPublicationSupabaseClientPromise) {
        builderPublicationSupabaseClientPromise = import('@supabase/supabase-js')
            .then(({ createClient }) => createClient(
                builderPublicationSupabaseUrl,
                builderPublicationSupabaseKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            ))
            .catch(() => null);
    }
    return builderPublicationSupabaseClientPromise;
}

function editorUsesSupabase(): boolean {
    return editorRuntime.success && editorRuntime.mode === 'supabase';
}

function editorUsesLocalData(): boolean {
    return editorRuntime.success && editorRuntime.mode === 'local';
}

function blockUnsupportedProductionWebsiteMutation(action: string): boolean {
    if (!editorUsesSupabase()) return false;
    (window as any).showToast(`${action} is temporarily unavailable in production. No changes were made.`, 'error');
    return true;
}

function removeLocalFixtureRows(): void {
    mockContacts.splice(0);
    mockOpportunities.splice(0);
    mockActivities.splice(0);
    mockQuotes.splice(0);
    mockQuoteItems.splice(0);
    mockInvoices.splice(0);
    mockPages.splice(0);
    mockPageSections.splice(0);
    mockFunnels.splice(0);
    mockWebsiteLayouts.splice(0);
    mockWebsites.splice(0);
    mockWebsiteRoutes.splice(0);
}

if (!editorUsesLocalData()) removeLocalFixtureRows();
if (
    browserFixturesEnabled
    && builderPublicationEnvironment.VITE_BROWSER_FIXTURE_ZERO_WEBSITE?.trim().toLowerCase() === 'true'
) {
    mockPages.splice(0);
    mockPageSections.splice(0);
    mockFunnels.splice(0);
    mockWebsiteLayouts.splice(0);
    mockWebsites.splice(0);
    mockWebsiteRoutes.splice(0);
    try {
        const stored = JSON.parse(window.localStorage.getItem('browser_fixture_generated_website') || 'null');
        if (isWebsiteGenerationResponse(stored) && stored.success) {
            mockWebsites.push({ ...stored.data.website });
            mockFunnels.push({ ...stored.data.funnel });
            mockPages.push({ ...stored.data.page });
            mockWebsiteRoutes.push({ ...stored.data.route });
            mockPageSections.push(...stored.data.sections.map(section => ({ ...section })));
            Object.assign(mockWebsiteSettings, stored.data.settings);
        }
    } catch {
        console.warn('Browser fixture website state could not be restored.');
    }
}

const applicationAuthController = new ApplicationAuthController({
    mode: editorRuntime.success ? editorRuntime.mode : 'unavailable',
    getSupabaseClient: async () => await getBuilderPublicationSupabaseClient() as unknown as ApplicationAuthClient | null,
    ...(editorRuntime.success && editorRuntime.mode === 'local' ? { localUserId: 'system' } : {})
});
const crmProductionHydrator = new CrmProductionHydrator(
    async () => await getBuilderPublicationSupabaseClient() as unknown as CrmHydrationClient | null,
    {
      contacts: mockContacts,
      opportunities: mockOpportunities,
      activities: mockActivities,
      quotes: mockQuotes,
      quote_items: mockQuoteItems,
      invoices: mockInvoices
    }
);
const websiteLayoutHydrator = new WebsiteLayoutHydrator(
    async () => await getBuilderPublicationSupabaseClient() as unknown as WebsiteLayoutHydrationClient | null,
    mockWebsiteLayouts
);
const websiteSettingsHydrator = new WebsiteSettingsHydrator(
    async () => await getBuilderPublicationSupabaseClient() as unknown as WebsiteSettingsHydrationClient | null,
    mockWebsiteSettings
);
const protectedAsyncOperationGuard = new ProtectedAsyncOperationGuard();
const websiteGenerationAuthority = new WebsiteGenerationAuthority(protectedAsyncOperationGuard);
if (!editorUsesLocalData()) {
  websiteSettingsHydrator.clear();
  applyPrimaryColor(mockWebsiteSettings.primary_color);
}
let applicationAuthInitialization: Promise<ApplicationAuthState> | null = null;
let applicationAuthHasInitialized = false;
let applicationAuthFormSubmissionInProgress = false;

const builderPublicationRuntimeResolver = createBuilderPublicationRuntimeResolver({
    configuredMode: builderPublicationConfiguredMode,
    production: builderPublicationProduction,
    supabaseConfigured: builderPublicationSupabaseConfigured,
    getStorage: () => window.localStorage,
    getSupabaseClient: getBuilderPublicationSupabaseClient,
    createLocalRepository: storage => new LocalStorageBuilderPublicationRepository({
        storage,
        canAccessPage: canAccessBuilderPublicationPage
    }),
    createSupabaseRepository: (client, options) => new SupabaseBuilderPublicationRepository({
        client: client as SupabaseClient,
        verifyAuthenticatedUser: options.verifyAuthenticatedUser
    })
});
let builderPublicationDiagnosticMode: 'local' | 'supabase' | undefined;

async function resolveBuilderPublicationRuntime(
    user: User | string
): Promise<BuilderPublicationRuntimeResult> {
    const result = await builderPublicationRuntimeResolver.resolve(
        actingBuilderPublicationUserId(user)
    );
    if (
        result.success
        && !builderPublicationProduction
        && builderPublicationDiagnosticMode !== result.persistence.mode
    ) {
        builderPublicationDiagnosticMode = result.persistence.mode;
        console.info(`Builder publication persistence: ${result.persistence.mode}`);
    }
    return result;
}

function builderPublicationInternalErrorResponse(): Response {
    return new Response(JSON.stringify({
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Builder publication request failed'
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
}

function builderSectionsJsonResponse(
    body: Record<string, unknown>,
    status: number
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function safeBrowserDbCall<T>(
    promise: PromiseLike<{ data: T | null; error: { message?: string } | null }>
): Promise<{ data: T | null; error: string | null }> {
    try {
        const result = await promise;
        return { data: result.data, error: result.error?.message ?? null };
    } catch {
        return { data: null, error: 'Database request failed' };
    }
}

function getBuilderSectionsRequestUrl(input: RequestInfo | URL): string | undefined {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

function getBuilderSectionsRequestMethod(
    input: RequestInfo | URL,
    init?: RequestInit
): string {
    if (typeof init?.method === 'string') return init.method;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.method;
    return 'GET';
}

function orderedBuilderPageSections(sections: readonly PageSection[]): PageSection[] {
    return sections
        .map((section, inputIndex) => ({ section, inputIndex }))
        .sort((left, right) => {
            const leftFinite = typeof left.section.order === 'number'
                && Number.isFinite(left.section.order);
            const rightFinite = typeof right.section.order === 'number'
                && Number.isFinite(right.section.order);
            if (leftFinite && rightFinite && left.section.order !== right.section.order) {
                return left.section.order - right.section.order;
            }
            if (leftFinite !== rightFinite) return leftFinite ? -1 : 1;
            return left.inputIndex - right.inputIndex;
        })
        .map(({ section }) => section);
}

async function handleBuilderSectionsBrowserGet(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response | null> {
    let requestUrl: string | undefined;
    try {
        requestUrl = getBuilderSectionsRequestUrl(input);
        if (!requestUrl) return null;

        const parsedUrl = new URL(requestUrl, window.location.origin);
        const routeMatch = /^\/api\/pages\/([^/]+)\/sections\/?$/.exec(parsedUrl.pathname);
        if (!routeMatch) return null;
        if (getBuilderSectionsRequestMethod(input, init).toUpperCase() !== 'GET') return null;

        let pageId: string;
        try {
            pageId = decodeURIComponent(routeMatch[1]);
        } catch {
            return builderSectionsJsonResponse({
                success: false,
                code: 'INVALID_INPUT',
                error: 'Invalid page ID'
            }, 400);
        }
        if (!pageId.trim()) {
            return builderSectionsJsonResponse({
                success: false,
                code: 'INVALID_INPUT',
                error: 'Invalid page ID'
            }, 400);
        }

        const currentUser = (window as any).currentUser;
        const userId = typeof currentUser === 'string' && currentUser.trim()
            ? currentUser
            : undefined;
        if (!userId) {
            return builderSectionsJsonResponse({
                success: false,
                code: 'UNAUTHORIZED',
                error: 'Unauthorized'
            }, 401);
        }

        const page = mockPages.find(item => item.id === pageId);
        if (!page) {
            return builderSectionsJsonResponse({
                success: false,
                code: 'NOT_FOUND',
                error: 'Page not found'
            }, 404);
        }
        if (page.user_id !== userId) {
            return builderSectionsJsonResponse({
                success: false,
                code: 'FORBIDDEN',
                error: 'Forbidden'
            }, 403);
        }

        if (editorUsesSupabase()) {
            const client = await getBuilderPublicationSupabaseClient();
            if (!client) {
                return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Sections are unavailable' }, 503);
            }
            const authResult = await client.auth.getUser();
            if (authResult.error || authResult.data.user?.id !== userId) {
                return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
            }
            const result = await client.from('page_sections')
                .select('id,page_id,type,content,order_index,styles')
                .eq('page_id', pageId)
                .eq('user_id', userId)
                .order('order_index', { ascending: true });
            if (result.error) {
                return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Sections are unavailable' }, 503);
            }
            const sections = (result.data ?? []).map((row: any): PageSection => {
                const content = row.content && typeof row.content === 'object' ? structuredClone(row.content) : {};
                const variant = typeof content.__builder_variant === 'string' ? content.__builder_variant : undefined;
                if ('__builder_variant' in content) delete content.__builder_variant;
                return {
                    id: String(row.id),
                    page_id: String(row.page_id),
                    type: String(row.type),
                    content,
                    order: Number(row.order_index),
                    styles: row.styles && typeof row.styles === 'object' ? structuredClone(row.styles) : {},
                    ...(variant ? { variant } : {})
                };
            });
            return builderSectionsJsonResponse({ success: true, data: orderedBuilderPageSections(sections) }, 200);
        }
        if (!editorUsesLocalData()) {
            return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Sections are unavailable' }, 503);
        }

        const storageKey = `mock_sections_${userId}:${pageId}`;
        let storedValue: string | null;
        try {
            storedValue = window.localStorage.getItem(storageKey);
        } catch {
            return builderSectionsJsonResponse({
                success: false,
                code: 'PERSISTENCE_ERROR',
                error: 'LOCAL_SECTION_STORAGE_READ_FAILED'
            }, 500);
        }

        let pageSections: PageSection[];
        if (storedValue !== null) {
            let parsedSections: unknown;
            try {
                parsedSections = JSON.parse(storedValue);
            } catch {
                return builderSectionsJsonResponse({
                    success: false,
                    code: 'PERSISTENCE_ERROR',
                    error: 'LOCAL_SECTION_STORAGE_CORRUPT'
                }, 500);
            }
            if (!Array.isArray(parsedSections) || parsedSections.some(section => (
                typeof section !== 'object'
                || section === null
                || Array.isArray(section)
                || typeof (section as Record<string, unknown>).page_id !== 'string'
            ))) {
                return builderSectionsJsonResponse({
                    success: false,
                    code: 'PERSISTENCE_ERROR',
                    error: 'LOCAL_SECTION_STORAGE_CORRUPT'
                }, 500);
            }
            pageSections = parsedSections.filter(section => (
                (section as Record<string, unknown>).page_id === pageId
            )) as PageSection[];
        } else {
            pageSections = mockPageSections.filter(section => section.page_id === pageId);
        }

        return builderSectionsJsonResponse({
            success: true,
            data: orderedBuilderPageSections(pageSections)
        }, 200);
    } catch {
        return requestUrl && requestUrl.includes('/api/pages/')
            ? builderSectionsJsonResponse({
                success: false,
                code: 'INTERNAL_ERROR',
                error: 'Failed to load page sections'
            }, 500)
            : null;
    }
}

const BUILDER_PAGE_SETTINGS_FIELDS = new Set([
    'name', 'slug', 'seo_title', 'seo_description'
]);
const hydratedBuilderPageSettingsUsers = new Set<string>();

function builderPageSettingsStorageKey(userId: string): string {
    return `mock_page_settings_${userId}`;
}

function hydrateBuilderPageSettingsPagesFromLocalStorage(userId: string): void {
    if (!editorUsesLocalData() || hydratedBuilderPageSettingsUsers.has(userId)) return;
    hydratedBuilderPageSettingsUsers.add(userId);
    try {
        const raw = window.localStorage.getItem(builderPageSettingsStorageKey(userId));
        if (!raw) return;
        const stored = JSON.parse(raw) as Record<string, BuilderPageSettingsPatch>;
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
        Object.entries(stored).forEach(([pageId, patch]) => {
            const page = mockPages.find(item => item.id === pageId && item.user_id === userId);
            if (!page || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
            const safePatch: BuilderPageSettingsPatch = {};
            Object.entries(patch).forEach(([key, value]) => {
                if (BUILDER_PAGE_SETTINGS_FIELDS.has(key) && typeof value === 'string') {
                    (safePatch as Record<string, string>)[key] = value;
                }
            });
            Object.assign(page, safePatch);
        });
    } catch {
        console.warn('[Page Settings] Local page metadata could not be restored.');
    }
}

async function handleBuilderPageSettingsBrowserPatch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response | null> {
    const requestUrl = getBuilderSectionsRequestUrl(input);
    if (!requestUrl) return null;
    const parsedUrl = new URL(requestUrl, window.location.origin);
    const routeMatch = /^\/api\/pages\/([^/]+)\/?$/.exec(parsedUrl.pathname);
    if (!routeMatch || getBuilderSectionsRequestMethod(input, init).toUpperCase() !== 'PATCH') return null;

    let pageId: string;
    try {
        pageId = decodeURIComponent(routeMatch[1]);
    } catch {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page ID' }, 400);
    }
    const userId = typeof (window as any).currentUser === 'string'
        ? (window as any).currentUser.trim()
        : '';
    if (!userId) return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);

    let candidate: unknown;
    try {
        candidate = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    } catch {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page settings' }, 400);
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page settings' }, 400);
    }
    const entries = Object.entries(candidate as Record<string, unknown>);
    if (!entries.length || entries.some(([key, value]) => !BUILDER_PAGE_SETTINGS_FIELDS.has(key) || typeof value !== 'string')) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page settings' }, 400);
    }
    const requestedPatch = Object.fromEntries(entries) as BuilderPageSettingsPatch;
    const currentPage = mockPages.find(page => page.id === pageId && page.user_id === userId);
    if (!currentPage) {
        return builderSectionsJsonResponse({ success: false, code: 'NOT_FOUND', error: 'Page not found' }, 404);
    }
    const candidateSettings = {
        ...pageToBuilderPageSettings(currentPage),
        ...requestedPatch
    };
    const validationIssues = validateBuilderPageSettings(candidateSettings, {
        isHomepage: getBuilderWebsitePageEntries().some(entry => entry.page.id === pageId && entry.isHomepage),
        originalSlug: currentPage.slug,
        existingSlugs: mockPages
            .filter(page => page.user_id === userId && page.id !== pageId)
            .map(page => page.slug)
    });
    if (validationIssues.length > 0) {
        const conflict = validationIssues.some(issue => issue.code === 'duplicate-slug');
        return builderSectionsJsonResponse({
            success: false,
            code: conflict ? 'CONFLICT' : 'INVALID_INPUT',
            error: conflict ? 'Another page already uses this URL.' : 'Invalid page settings'
        }, conflict ? 409 : 400);
    }
    const normalizedSettings = normalizeBuilderPageSettings(candidateSettings);
    const patch = Object.fromEntries(
        entries.map(([key]) => [key, normalizedSettings[key as BuilderPageSettingsField]])
    ) as BuilderPageSettingsPatch;

    if (editorUsesSupabase()) {
        const client = await getBuilderPublicationSupabaseClient();
        if (!client) return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page settings are unavailable' }, 503);
        const authResult = await client.auth.getUser();
        const authenticatedUserId = authResult.data.user?.id;
        if (authResult.error || !authenticatedUserId || authenticatedUserId !== userId) {
            return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
        }
        const result = await client.from('pages').update(patch)
            .eq('id', pageId).eq('user_id', authenticatedUserId).select('*').single();
        if (result.error) {
            const conflict = result.error.code === '23505';
            return builderSectionsJsonResponse({
                success: false,
                code: conflict ? 'CONFLICT' : 'UNAVAILABLE',
                error: conflict ? 'Another page already uses this URL.' : 'Page settings could not be saved.'
            }, conflict ? 409 : 503);
        }
        return builderSectionsJsonResponse({ success: true, data: result.data }, 200);
    }

    if (!editorUsesLocalData()) {
        return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page settings are unavailable' }, 503);
    }
    const result = await PagesRepo.updatePageSettings(pageId, patch, userId);
    if (!result.success || !result.data) {
        const conflict = result.code === '23505';
        return builderSectionsJsonResponse({
            success: false,
            code: conflict ? 'CONFLICT' : result.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'UNAVAILABLE',
            error: conflict ? 'Another page already uses this URL.' : 'Page settings could not be saved.'
        }, conflict ? 409 : result.code === 'NOT_FOUND' ? 404 : 503);
    }
    return builderSectionsJsonResponse({ success: true, data: result.data }, 200);
}

async function loadBuilderNewPageServerContext(
    userId: string,
    client?: SupabaseClient
): Promise<BuilderNewPageContext | null> {
    const website = getActiveBuilderWebsite();
    if (!website || website.user_id !== userId) return null;
    if (!client) {
        return {
            actingUserId: userId,
            website,
            websiteRoutes: mockWebsiteRoutes,
            funnels: mockFunnels,
            pages: mockPages,
            activePageId: builderPageId
        };
    }
    const [websiteResult, routesResult, funnelsResult, pagesResult] = await Promise.all([
        client.from('websites').select('id,user_id,name,domain,subdomain,homepage_funnel_id,created_at,updated_at')
            .eq('id', website.id).eq('user_id', userId).limit(1).maybeSingle(),
        client.from('website_routes').select('id,website_id,path,funnel_id,created_at')
            .eq('website_id', website.id),
        client.from('funnels').select('id,user_id,name,status,created_at,updated_at,service_type,city')
            .eq('user_id', userId),
        client.from('pages').select('id,user_id,name,slug,status,seo_title,seo_description,seo_keywords,created_at,funnel_id,step_type,step_order')
            .eq('user_id', userId)
    ]);
    if (websiteResult.error || routesResult.error || funnelsResult.error || pagesResult.error || !websiteResult.data) {
        return null;
    }
    return {
        actingUserId: userId,
        website: websiteResult.data as Website,
        websiteRoutes: (routesResult.data ?? []) as WebsiteRoute[],
        funnels: (funnelsResult.data ?? []) as typeof mockFunnels,
        pages: (pagesResult.data ?? []).map(row => ({
            ...row,
            seo_title: typeof row.seo_title === 'string' ? row.seo_title : '',
            seo_description: typeof row.seo_description === 'string' ? row.seo_description : '',
            seo_keywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : []
        })) as Page[],
        activePageId: builderPageId
    };
}

async function handleBuilderNewPageBrowserPost(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response | null> {
    const requestUrl = getBuilderSectionsRequestUrl(input);
    if (!requestUrl) return null;
    const parsedUrl = new URL(requestUrl, window.location.origin);
    if (parsedUrl.pathname !== '/api/pages' || getBuilderSectionsRequestMethod(input, init).toUpperCase() !== 'POST') {
        return null;
    }
    let body: unknown;
    try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    } catch {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page request' }, 400);
    }
    const allowedFields = new Set(['id', 'name', 'slug', 'destinationKey']);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page request' }, 400);
    }
    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length !== 4 || entries.some(([key, value]) => !allowedFields.has(key) || typeof value !== 'string')) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page request' }, 400);
    }
    const request = body as { id: string; name: string; slug: string; destinationKey: string };
    if (!request.id.trim() || !request.destinationKey.trim()) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page request' }, 400);
    }
    const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
    if (!userId) return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);

    let client: SupabaseClient | undefined;
    if (editorUsesSupabase()) {
        client = await getBuilderPublicationSupabaseClient() ?? undefined;
        if (!client) return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page creation is unavailable' }, 503);
        const authResult = await client.auth.getUser();
        if (authResult.error || authResult.data.user?.id !== userId) {
            return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
        }
    } else if (!editorUsesLocalData()) {
        return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page creation is unavailable' }, 503);
    }
    const context = await loadBuilderNewPageServerContext(userId, client);
    if (!context || !context.website) {
        return builderSectionsJsonResponse({ success: false, code: 'DESTINATION_UNAVAILABLE', error: 'This page destination is no longer available.' }, 409);
    }
    const destinations = getEligibleNewPageDestinations({
        website: context.website,
        websiteRoutes: context.websiteRoutes,
        funnels: context.funnels,
        pages: context.pages,
        actingUserId: userId
    });
    const existingById = context.pages.find(page => page.id === request.id);
    if (existingById) {
        const idempotentMatch = existingById.user_id === userId
            && existingById.name === request.name.trim()
            && existingById.slug === normalizeBuilderPageSettings({ name: request.name, slug: request.slug, seo_title: '', seo_description: '' }).slug
            && existingById.status === 'draft'
            && request.destinationKey === `funnel:${existingById.funnel_id ?? ''}`;
        return idempotentMatch
            ? builderSectionsJsonResponse({ success: true, data: existingById }, 200)
            : builderSectionsJsonResponse({ success: false, code: 'INVALID_RESPONSE', error: 'The page could not be created. Please try again.' }, 409);
    }
    const validationIssues = validateBuilderNewPageInput({
        name: request.name,
        slug: request.slug,
        destinationKey: request.destinationKey
    }, { destinations, existingPages: context.pages });
    if (validationIssues.length) {
        const conflict = validationIssues.some(issue => issue.code === 'duplicate-slug');
        const destinationInvalid = validationIssues.some(issue => issue.code === 'invalid-destination');
        return builderSectionsJsonResponse({
            success: false,
            code: conflict ? 'CONFLICT' : destinationInvalid ? 'DESTINATION_UNAVAILABLE' : 'INVALID_INPUT',
            error: conflict
                ? 'Another page in this account already uses this URL.'
                : destinationInvalid ? 'This page destination is no longer available.' : 'Invalid page request'
        }, conflict || destinationInvalid ? 409 : 400);
    }
    const destination = destinations.find(item => item.key === request.destinationKey);
    if (!destination) {
        return builderSectionsJsonResponse({ success: false, code: 'DESTINATION_UNAVAILABLE', error: 'This page destination is no longer available.' }, 409);
    }
    const expected = createBuilderNewPageDefaults({
        input: request,
        destination,
        actingUserId: userId,
        existingPages: context.pages,
        id: request.id
    });
    const result = await PagesRepo.createPage({
        id: expected.id,
        name: expected.name,
        slug: expected.slug,
        funnelId: destination.funnelId,
        ...(expected.step_order !== undefined ? { stepOrder: expected.step_order } : {})
    }, userId, client);
    if (!result.success || !result.data) {
        const conflict = result.code === '23505';
        return builderSectionsJsonResponse({
            success: false,
            code: conflict ? 'CONFLICT' : 'UNAVAILABLE',
            error: conflict
                ? 'Another page in this account already uses this URL.'
                : 'The page could not be created. Please try again.'
        }, conflict ? 409 : 503);
    }
    if (!isExpectedCreatedBuilderPage(result.data, expected)) {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_RESPONSE', error: 'The page could not be created. Please try again.' }, 502);
    }
    return builderSectionsJsonResponse({ success: true, data: result.data }, 201);
}

async function handleBuilderDuplicatePageBrowserPost(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response | null> {
    const requestUrl = getBuilderSectionsRequestUrl(input);
    if (!requestUrl) return null;
    const parsedUrl = new URL(requestUrl, window.location.origin);
    const match = parsedUrl.pathname.match(/^\/api\/pages\/([^/]+)\/duplicate$/);
    if (!match || getBuilderSectionsRequestMethod(input, init).toUpperCase() !== 'POST') {
        return null;
    }
    const sourcePageId = decodeURIComponent(match[1]);
    let body: unknown;
    try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    } catch {
        return builderSectionsJsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid duplicate request' }, 400);
    }
    const request = (typeof body === 'object' && body !== null ? body : {}) as {
        newPageId?: string;
        name?: string;
        slug?: string;
        destinationFunnelId?: string;
    };
    const newPageId = typeof request.newPageId === 'string' && request.newPageId.trim()
        ? request.newPageId.trim()
        : crypto.randomUUID();

    const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
    if (!userId) return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);

    let client: SupabaseClient | undefined;
    if (editorUsesSupabase()) {
        client = await getBuilderPublicationSupabaseClient() ?? undefined;
        if (!client) return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page duplication is unavailable' }, 503);
        const authResult = await client.auth.getUser();
        if (authResult.error || authResult.data.user?.id !== userId) {
            return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
        }
    } else if (!editorUsesLocalData()) {
        return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page duplication is unavailable' }, 503);
    }

    const result = await PagesRepo.duplicatePage({
        sourcePageId,
        newPageId
    }, userId, client);

    if (!result.success || !result.data) {
        const conflict = result.code === '23505' || result.code === 'CONFLICT';
        const notFound = result.code === 'NOT_FOUND' || result.code === 'SOURCE_PAGE_NOT_FOUND';
        return builderSectionsJsonResponse({
            success: false,
            code: conflict ? 'CONFLICT' : notFound ? 'NOT_FOUND' : 'UNAVAILABLE',
            error: conflict
                ? 'A page with that name or URL already exists.'
                : notFound ? 'Source page not found' : 'The page could not be duplicated. Please try again.'
        }, conflict ? 409 : notFound ? 404 : 503);
    }

    return builderSectionsJsonResponse({ success: true, data: result.data }, 201);
}

async function handleBuilderDeletePageBrowserDelete(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
    const requestUrl = getBuilderSectionsRequestUrl(input);
    if (!requestUrl) return null;
    const parsedUrl = new URL(requestUrl, window.location.origin);
    const match = parsedUrl.pathname.match(/^\/api\/pages\/([^/]+)$/);
    if (!match || getBuilderSectionsRequestMethod(input, init).toUpperCase() !== 'DELETE') {
        return null;
    }

    const pageId = decodeURIComponent(match[1]);
    const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
    if (!userId) return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);

    let client: SupabaseClient | undefined;
    if (editorUsesSupabase()) {
        client = await getBuilderPublicationSupabaseClient() ?? undefined;
        if (!client) return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page deletion is unavailable' }, 503);
        const authResult = await client.auth.getUser();
        if (authResult.error || authResult.data.user?.id !== userId) {
            return builderSectionsJsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
        }
    } else if (!editorUsesLocalData()) {
        return builderSectionsJsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page deletion is unavailable' }, 503);
    }

    const result = await PagesRepo.deletePage(pageId, userId, client);

    if (!result.success || !result.data) {
        const lastPage = result.code === 'LAST_PAGE';
        const publishedBlocked = result.code === 'PUBLISHED_BLOCKED';
        const leadBlocked = result.code === 'LEAD_HISTORY_BLOCKED';
        const conflict = result.code === 'CONFLICT';
        const ambiguous = result.code === 'AMBIGUOUS';
        const notFound = result.code === 'NOT_FOUND';
        const forbidden = result.code === 'FORBIDDEN';
        return builderSectionsJsonResponse({
            success: false,
            code: lastPage ? 'LAST_PAGE' : publishedBlocked ? 'PUBLISHED_BLOCKED' : leadBlocked ? 'LEAD_HISTORY_BLOCKED' : conflict ? 'CONFLICT' : ambiguous ? 'AMBIGUOUS' : notFound ? 'NOT_FOUND' : forbidden ? 'FORBIDDEN' : 'UNAVAILABLE',
            error: lastPage
                ? 'Cannot delete the only page in this destination.'
                : publishedBlocked
                  ? 'This page is published. Unpublish it before deleting it.'
                  : leadBlocked
                    ? 'This page has historical lead submissions and cannot be deleted.'
                    : conflict
                      ? 'The page destination changed while deleting. Please try again.'
                      : ambiguous
                        ? 'The deletion result is uncertain. Please reload to check.'
                        : notFound ? 'Page not found' : 'The page could not be deleted. Please try again.'
        }, lastPage ? 422 : publishedBlocked ? 423 : (leadBlocked || conflict || ambiguous) ? 409 : notFound ? 404 : forbidden ? 403 : 503);
    }

    return builderSectionsJsonResponse({ success: true, data: result.data }, 200);
}

export async function handleBuilderReorderPagesBrowserPost(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
    return handleBuilderReorderPagesBrowserPostImpl(input, init, {
        getCurrentUser: () => (typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : ''),
        editorUsesSupabase: () => editorUsesSupabase(),
        editorUsesLocalData: () => editorUsesLocalData(),
        getSupabaseClient: () => getBuilderPublicationSupabaseClient().then(c => c ?? undefined)
    });
}

export async function handleBuilderSetHomepageBrowserPost(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
    return handleBuilderSetHomepageBrowserPostImpl(input, init, {
        getCurrentUser: () => (typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : ''),
        editorUsesSupabase: () => editorUsesSupabase(),
        editorUsesLocalData: () => editorUsesLocalData(),
        getSupabaseClient: () => getBuilderPublicationSupabaseClient().then(c => c ?? undefined)
    });
}

const originalFetch = window.fetch;
const browserCallSimulator = createBrowserCallSimulator();
const browserFixtureFetch: typeof window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getBuilderSectionsRequestUrl(input) ?? '';

    if (isBuilderPublicationBrowserRequest(input)) {
        try {
            // This selector is only for authenticated editor publication operations.
            // Public rendering must use a later trusted backend/Edge Function, never this repository.
            const publicationResponse = await handleBuilderPublicationRuntimeBrowserRequest(
                resolveBuilderPublicationRuntime,
                (window as any).currentUser as User | string,
                input,
                init
            );
            if (publicationResponse) return publicationResponse;
        } catch {
            return builderPublicationInternalErrorResponse();
        }
    }

    const builderSectionsResponse = await handleBuilderSectionsBrowserGet(input, init);
    if (builderSectionsResponse) return builderSectionsResponse;

    const builderPageSettingsResponse = await handleBuilderPageSettingsBrowserPatch(input, init);
    if (builderPageSettingsResponse) return builderPageSettingsResponse;

    const builderNewPageResponse = await handleBuilderNewPageBrowserPost(input, init);
    if (builderNewPageResponse) return builderNewPageResponse;

    const builderDuplicatePageResponse = await handleBuilderDuplicatePageBrowserPost(input, init);
    if (builderDuplicatePageResponse) return builderDuplicatePageResponse;

    const builderDeletePageResponse = await handleBuilderDeletePageBrowserDelete(input, init);
    if (builderDeletePageResponse) return builderDeletePageResponse;

    const builderReorderPagesResponse = await handleBuilderReorderPagesBrowserPost(input, init);
    if (builderReorderPagesResponse) return builderReorderPagesResponse;

    const builderSetHomepageResponse = await handleBuilderSetHomepageBrowserPost(input, init);
    if (builderSetHomepageResponse) return builderSetHomepageResponse;
    
    if (url.startsWith('/api/')) {
        const method = getBuilderSectionsRequestMethod(input, init).toUpperCase();
        const bodyString = init?.body ? (init.body as string) : undefined;
        console.log(`[MOCK INTERCEPTOR] Intercepting ${method} ${url}`);
        
        // Build the simulated request context
        const reqContext: any = { 
            method, 
            url,
            body: bodyString ? JSON.parse(bodyString) : undefined 
        };

        // Simulating the Backend Dispatcher/Router
        if (url === '/api/messages/send' && method === 'POST') {
            console.warn('[SMS MOCK] SMS delivery is server-only and is disabled in the browser mock API.');
            return new Response(JSON.stringify({
                success: false,
                error: 'SMS delivery is server-only in this environment.'
            }), {
                status: 501,
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        if (url.includes('/api/messages/') && url.endsWith('/retry') && init?.method === 'POST') {
            console.warn('[SMS MOCK] SMS retry is server-only and is disabled in the browser mock API.');
            return new Response(JSON.stringify({
                success: false,
                error: 'SMS retry is server-only in this environment.'
            }), {
                status: 501,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url === '/api/leads' && method === 'POST') {
            const body = reqContext.body;
            const userId = getActingUserId();
            const leadOperation = protectedAsyncOperationGuard.begin(`internal-lead:${String(body?.request_key ?? '')}`, userId);
            console.log('[API ROUTER] Inbound Lead Submission:', body);

            try {
                const phoneVal = body.phone ? normalizePhone(body.phone).normalized : '';
                const emailVal = body.email ? normalizeEmail(body.email) : '';
                const isRepeat = mockContacts.some(contact =>
                    contact.user_id === userId &&
                    ((emailVal && contact.email === emailVal) || (phoneVal && contact.phone === phoneVal))
                );

                if (body.website_url) {
                    return new Response(JSON.stringify({ success: true, data: { id: 'spam-blocked' }, is_repeat: false }), {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (editorUsesSupabase()) {
                    const client = await getBuilderPublicationSupabaseClient();
                    if (!client || !userId || typeof body.request_key !== 'string') {
                        throw new Error('Production lead persistence is unavailable.');
                    }
                    const saved = await createProductionLead(client as unknown as CrmMutationClient, {
                        requestKey: body.request_key,
                        name: normalizeName(body.name || ''),
                        phone: phoneVal || body.phone,
                        email: emailVal || undefined,
                        address: body.address,
                        serviceType: body.service_type,
                        message: body.message,
                        source: body.source,
                        funnelId: body.funnel_id
                    });
                    if (saved.contact.user_id !== userId || saved.opportunity.user_id !== userId
                        || saved.opportunity.contact_id !== saved.contact.id) {
                        throw new Error('Production lead persistence returned an invalid owner.');
                    }
                    protectedAsyncOperationGuard.requireCurrent(leadOperation, getActingUserId());
                    const contactIndex = mockContacts.findIndex(contact => contact.id === saved.contact.id);
                    if (contactIndex >= 0) mockContacts[contactIndex] = saved.contact;
                    else mockContacts.push(saved.contact);
                    const opportunityIndex = mockOpportunities.findIndex(opportunity => opportunity.id === saved.opportunity.id);
                    if (opportunityIndex >= 0) mockOpportunities[opportunityIndex] = saved.opportunity;
                    else mockOpportunities.push(saved.opportunity);
                    return new Response(JSON.stringify({
                        success: true,
                        data: saved.contact,
                        opportunity: saved.opportunity,
                        is_repeat: saved.isRepeat,
                        replayed: saved.replayed
                    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
                }

                const fallback = createLocalMockWebsiteLead({
                    ...body,
                    phone: phoneVal || body.phone,
                    email: emailVal || body.email,
                    name: normalizeName(body.name || '')
                }, userId, isRepeat);

                runAutomations('LEAD_CAPTURED', fallback.contact);

                if (body.is_test && fallback.contact) {
                    (window as any).showToast(!fallback.isRepeat ? 'Test lead received! Redirecting to CRM...' : 'Repeat test lead received!', 'success');
                    setTimeout(() => window.navigateTo('contact-detail', fallback.contact.id), 2000);
                }

                return new Response(JSON.stringify({
                    success: true,
                    data: fallback.contact,
                    opportunity: fallback.opportunity,
                    is_repeat: fallback.isRepeat
                }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error: any) {
                if (isSupersededOperationError(error)) throw error;
                console.error('[API ROUTER] Lead Ingestion Error:', error);
                if (editorUsesSupabase()) {
                    return new Response(JSON.stringify({ success: false, error: 'Lead creation is temporarily unavailable. Please try again.' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                const fallback = createLocalMockWebsiteLead(body, userId, false);
                runAutomations('LEAD_CAPTURED', fallback.contact);
                return new Response(JSON.stringify({
                    success: true,
                    data: fallback.contact,
                    opportunity: fallback.opportunity,
                    is_repeat: fallback.isRepeat,
                    fallback: 'local-mock'
                }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url === '/api/quotes' && method === 'POST') {
            if (!editorUsesSupabase()) {
                return new Response(JSON.stringify({ success: false, error: 'Use the local quote workflow.' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const body = reqContext.body;
            const userId = getActingUserId();
            const quoteOperation = protectedAsyncOperationGuard.begin(`quote-api:${String(body?.request_key ?? '')}`, userId);
            try {
                const client = await getBuilderPublicationSupabaseClient();
                if (!client || !userId) throw new Error('UNAVAILABLE');
                const saved = await saveProductionQuote(client as unknown as CrmMutationClient, {
                    requestKey: body.request_key,
                    contactId: body.contact_id,
                    opportunityId: body.opportunity_id || undefined,
                    selectedTier: body.selected_tier,
                    notes: body.notes,
                    items: body.items
                });
                if (saved.quote.user_id !== userId || saved.items.some(item => item.user_id !== userId)) throw new Error('UNAVAILABLE');
                protectedAsyncOperationGuard.requireCurrent(quoteOperation, getActingUserId());
                return new Response(JSON.stringify({ success: true, data: saved }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                if (isSupersededOperationError(error)) throw error;
                return new Response(JSON.stringify({ success: false, error: 'Quote creation is temporarily unavailable. Please try again.' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url === '/api/contacts' && method === 'GET') {
            const userId = getActingUserId();
            const userContacts = mockContacts.filter(c => c.user_id === userId);
            return new Response(JSON.stringify({ success: true, data: userContacts }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.startsWith('/api/contacts/') && url.endsWith('/timeline') && method === 'GET') {
            const id = url.split('/')[3];
            console.log(`[MOCK] Fetching timeline for contact ${id}`);
            return new Response(JSON.stringify({ success: true, data: [] }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url.startsWith('/api/contacts/') && method === 'GET') {
            const id = url.split('/')[3];
            const contact = mockContacts.find(c => c.id === id);
            if (!contact) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
            return new Response(JSON.stringify({ success: true, data: contact }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url === '/api/calls/inbound' && method === 'POST') {
            try {
                return new Response(JSON.stringify(browserCallSimulator.receive(reqContext.body || {})), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid call request' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        if (url === '/api/calls/end' && method === 'POST') {
            try {
                return new Response(JSON.stringify(browserCallSimulator.end(reqContext.body || {})), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid call request' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Funnels API (WB.1.4 Integration — Browser-safe simulation)
        if (url.startsWith('/api/funnels')) {
            if (editorUsesSupabase() && method !== 'GET') {
                return builderSectionsJsonResponse({ success: false, error: 'Website page changes are temporarily unavailable in production.' }, 501);
            }
            let response: any;

            if (url === '/api/funnels' && method === 'GET') {
                const data = mockFunnels.map(f => ({
                    ...f,
                    step_count: mockPages.filter(p => (p as any).funnel_id === f.id).length
                }));
                response = { success: true, data };
            } else if (url === '/api/funnels' && method === 'POST') {
                const { name } = reqContext.body || {};
                const newFunnel = {
                    id: `fnl-${Date.now()}`,
                    user_id: 'system',
                    name: name || 'Untitled Page',
                    status: 'draft',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                mockFunnels.push(newFunnel as any);
                response = { success: true, data: newFunnel };
            } else if (url === '/api/funnels/from-template' && method === 'POST') {
                // Mock implementation of WB.2.3 for browser preview
                const { name } = reqContext.body || {};
                const newFnl = { id: `fnl-${Date.now()}`, user_id: 'system', name: name || 'Template Funnel', status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                mockFunnels.push(newFnl as any);
                response = { success: true, data: { funnel_id: newFnl.id, funnel: newFnl } };
            } else if (url.startsWith('/api/funnels/') && method === 'GET') {
                const id = url.split('/')[3];
                const funnel = mockFunnels.find(f => f.id === id);
                if (funnel) {
                    const steps = mockPages.filter(p => (p as any).funnel_id === id);
                    response = { success: true, data: { ...funnel, steps } };
                } else {
                    response = { success: false, error: 'Page not found' };
                }
            } else if (url.startsWith('/api/funnels/') && method === 'PATCH') {
                const id = url.split('/')[3];
                const funnel = mockFunnels.find(f => f.id === id);
                if (funnel) {
                    const { name, status } = reqContext.body || {};
                    if (name) funnel.name = name;
                    if (status) funnel.status = status;
                    response = { success: true, data: funnel };
                } else {
                    response = { success: false, error: 'Page not found' };
                }
            }
            
            if (response) {
                return new Response(JSON.stringify(response), { status: response.success ? 200 : (response.error === 'Page not found' ? 404 : 500) });
            }
        }

        // Websites API (WB.2.2 Integration)
        if (url.startsWith('/api/websites/generate') && method === 'POST') {
            return originalFetch(input, init);
        }

        // ── WB.3.5 Page Sections Auto-Save ──────────────────────────────────
        const literalSectionRoute = resolveBuilderFixtureSectionRoute(url, method, window.location.origin);
        const historicalSectionRoute = /^\/api\/pages\/([^/?]+)\/(sections|section-save-revision)(?:\?.*)?$/.exec(url);
        if (literalSectionRoute || (historicalSectionRoute && (method === 'PUT' || method === 'GET'))) {
            const pageId = literalSectionRoute?.pageId ?? historicalSectionRoute?.[1] ?? null;
            if (!pageId) {
                return builderSectionsJsonResponse({ success: false, error: { code: 'INVALID_INPUT', message: 'Page ID is required', request_id: 'fixture', status: 400 } }, 400);
            }
            let body: any = {};
            try {
                body = typeof reqContext.body === 'string'
                    ? JSON.parse(reqContext.body)
                    : (reqContext.body || {});
            } catch {}
            const sections: any[] = body.sections || [];

            if (literalSectionRoute?.kind === 'revision' || (!literalSectionRoute && method === 'GET')) {
                const savedSections = mockPageSections.filter(section => section.page_id === pageId);
                return builderSectionsJsonResponse({ success: true, data: { page_id: pageId, saved_count: savedSections.length, generation: 0, revision: builderPageRevisionAuthority.get(pageId) ?? 0, document_hash: 'fixture-current', request_id: 'fixture' } }, 200);
            }

            const requestedFixtureFailures = Number((window as any).__builderFixtureSaveFailureCount ?? 0);
            if (requestedFixtureFailures > 0) {
                (window as any).__builderFixtureSaveFailureCount = requestedFixtureFailures - 1;
                return builderSectionsJsonResponse({ success: false, error: { code: 'SUPABASE_UNAVAILABLE', message: 'Fixture save outage', request_id: 'fixture-failure', status: 503 } }, 503);
            }

            const hasSupabase = editorUsesSupabase();
            const reqUser = getActingUserId() || reqContext.user?.id || '';

            if (!hasSupabase) {
                if (!editorUsesLocalData()) {
                    return builderSectionsJsonResponse({ success: false, error: { code: 'SUPABASE_UNAVAILABLE', message: 'Section persistence unavailable', request_id: 'fixture', status: 503 } }, 503);
                }
                const page = mockPages.find(item => item.id === pageId && item.user_id === reqUser);
                if (!page || sections.some(section => section.page_id !== pageId)) {
                    return builderSectionsJsonResponse({ success: false, error: { code: 'PAGE_NOT_FOUND', message: 'Page not found', request_id: 'fixture', status: 404 } }, 404);
                }
                const replacement = orderedBuilderPageSections(sections).map(section => structuredClone(section));
                try {
                    window.localStorage.setItem(`mock_sections_${reqUser}:${pageId}`, JSON.stringify(replacement));
                } catch {
                    return builderSectionsJsonResponse({ success: false, error: { code: 'TRANSACTION_FAILED', message: 'Local fixture write failed', request_id: 'fixture', status: 500 } }, 500);
                }
                for (let index = mockPageSections.length - 1; index >= 0; index -= 1) {
                    if (mockPageSections[index].page_id === pageId) mockPageSections.splice(index, 1);
                }
                mockPageSections.push(...replacement);
                const revision = (Number.isSafeInteger(body.expected_revision) ? body.expected_revision : 0) + 1;
                return builderSectionsJsonResponse({ success: true, data: { page_id: pageId, saved_count: replacement.length, generation: body.generation, revision, document_hash: `fixture-${revision}`, request_id: 'fixture' } }, 200);
            }

            // Upsert sections to Supabase
            const supabase = await getBuilderPublicationSupabaseClient();
            if (!supabase) {
                return builderSectionsJsonResponse({ success: false, error: 'Section persistence unavailable' }, 503);
            }
            const auth = await supabase.auth.getUser();
            const authenticatedUserId = auth.data.user?.id;
            if (auth.error || !authenticatedUserId || authenticatedUserId !== reqUser) {
                return builderSectionsJsonResponse({ success: false, error: 'Unauthorized' }, 401);
            }
            const existingResult = await safeBrowserDbCall(
                supabase.from('page_sections')
                    .select('id')
                    .eq('page_id', pageId)
                    .eq('user_id', authenticatedUserId)
            );
            if (existingResult.error) {
                return new Response(JSON.stringify({
                    success: false,
                    error: existingResult.error
                }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            const submittedIds = new Set(sections.map(section => String(section.id)));
            const removedIds = ((existingResult.data || []) as Array<{ id: string }>)
                .map(section => section.id)
                .filter(id => !submittedIds.has(id));
            if (removedIds.length > 0) {
                const deleteResult = await safeBrowserDbCall(
                    supabase.from('page_sections')
                        .delete()
                        .eq('page_id', pageId)
                        .eq('user_id', authenticatedUserId)
                        .in('id', removedIds)
                );
                if (deleteResult.error) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: deleteResult.error
                    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
            }
            if (sections.length === 0) {
                return new Response(JSON.stringify({
                    success: true,
                    error: null,
                    saved: 0
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            const persistedUserId = authenticatedUserId;
            const result = await safeBrowserDbCall(
                supabase.from('page_sections').upsert(
                    sections.map((section: any) => ({
                        id: section.id,
                        user_id: persistedUserId,
                        page_id: pageId,
                        type: section.type,
                        content: {
                            ...(section.content && typeof section.content === 'object' ? section.content : {}),
                            ...(typeof section.variant === 'string' && section.variant.trim()
                                ? { __builder_variant: section.variant }
                                : {})
                        },
                        order_index: section.order,
                        styles: section.styles && typeof section.styles === 'object' ? section.styles : {}
                    })),
                    { onConflict: 'id' }
                )
            );

            return new Response(JSON.stringify({
                success: !result.error,
                error: result.error ?? null,
                saved: sections.length
            }), {
                status: result.error ? 500 : 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ── WB.3.4 Bulk SEO Generation ──────────────────────────────────
        if (url === '/api/settings') {
            const reqUser = getActingUserId();
            const userSite = getActiveSettingsWebsite();
            if (!userSite || userSite.user_id !== reqUser) {
                return builderSectionsJsonResponse({ success: false, error: 'Website not found' }, 404);
            }
            const websiteId = userSite.id;
            const settingsFields = new Set([
                'business_name', 'phone', 'sms_number', 'email', 'logo_url', 'primary_color',
                'facebook_pixel_id', 'gtm_id', 'ga4_measurement_id', 'auto_lead_sms_enabled',
                'auto_lead_sms_template', 'missed_call_sms_enabled', 'missed_call_sms_template',
                'cities_served', 'services_offered', 'publish_status', 'website_preset', 'build_brief',
                'google_business_link', 'google_rating', 'google_reviews_count'
            ]);
            const client = await getBuilderPublicationSupabaseClient();

            if (editorUsesSupabase()) {
                if (!client) return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                const auth = await client.auth.getUser();
                if (auth.error || auth.data.user?.id !== reqUser) {
                    return builderSectionsJsonResponse({ success: false, error: 'Unauthorized' }, 401);
                }
                if (method === 'GET') {
                    const state = await websiteSettingsHydrator.hydrate(reqUser, userSite, true);
                    if (state.status === 'error') return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                    applyPrimaryColor(mockWebsiteSettings.primary_color);
                    return builderSectionsJsonResponse({ success: true, data: structuredClone(mockWebsiteSettings), missing: state.status === 'empty' }, 200);
                }
                if (method === 'POST') {
                    const state = await websiteSettingsHydrator.hydrate(reqUser, userSite);
                    if (state.status === 'error') return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                    const patch = Object.fromEntries(Object.entries(reqContext.body || {})
                        .filter(([key]) => settingsFields.has(key)));
                    const existing = await client.from('website_settings').select('id')
                        .eq('user_id', reqUser).eq('website_id', websiteId).limit(1).maybeSingle();
                    if (existing.error) return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                    const result = await client.from('website_settings').upsert({
                        ...patch,
                        id: existing.data?.id || crypto.randomUUID(),
                        user_id: reqUser,
                        website_id: websiteId
                    }, { onConflict: 'user_id,website_id' }).select('*').single();
                    if (result.error || !result.data) return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                    if (!websiteSettingsHydrator.acceptConfirmed(reqUser, websiteId, result.data)) {
                        return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
                    }
                    applyPrimaryColor(mockWebsiteSettings.primary_color);
                    return builderSectionsJsonResponse({ success: true, data: result.data }, 200);
                }
            }

            if (!editorUsesLocalData()) {
                return builderSectionsJsonResponse({ success: false, error: 'Settings unavailable' }, 503);
            }
            if (method === 'GET') {
                return builderSectionsJsonResponse({ success: true, data: structuredClone(mockWebsiteSettings) }, 200);
            } else if (method === 'POST') {
                const patch = Object.fromEntries(Object.entries(reqContext.body || {})
                    .filter(([key]) => settingsFields.has(key)));
                Object.assign(mockWebsiteSettings, patch);
                applyPrimaryColor(mockWebsiteSettings.primary_color);
                try {
                    window.localStorage.setItem(
                        `mock_settings_${reqUser}:${websiteId}`,
                        JSON.stringify({ ...mockWebsiteSettings, user_id: reqUser, website_id: websiteId })
                    );
                } catch {
                    return builderSectionsJsonResponse({ success: false, error: 'Settings could not be saved' }, 500);
                }
                return builderSectionsJsonResponse({ success: true, data: structuredClone(mockWebsiteSettings) }, 200);
            }
        }

        if (url === '/api/websites/bulk-seo' && method === 'POST') {
            if (!editorUsesLocalData()) return builderSectionsJsonResponse({ success: false, error: 'SEO route generation is temporarily unavailable.' }, 501);
            const { services, cities } = reqContext.body || {};
            console.log(`[MOCK] Bulk SEO Generation for ${services.length} services in ${cities.length} cities`);
            
            // Simulation of generation
            const website = getActiveSettingsWebsite();
            if (!website || website.user_id !== getActingUserId()) {
                return builderSectionsJsonResponse({ success: false, error: 'Website not found' }, 404);
            }
            const timestamp = new Date().toISOString();
            
            services.forEach((s: string) => {
                cities.forEach((c: string) => {
                    const slug = (s + '-' + c).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                    const existing = mockWebsiteRoutes.find(r => r.website_id === website.id && r.slug === slug);
                    if (!existing) {
                        mockWebsiteRoutes.push({
                            id: `r-seo-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                            website_id: website.id,
                            path: `/${slug}`,
                            slug,
                            funnel_id: 'fnl-1',
                            is_seo_page: true,
                            city: c,
                            service: s,
                            created_at: timestamp
                        });
                    }
                });
            });

            return new Response(JSON.stringify({ success: true, count: services.length * cities.length }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.startsWith('/api/websites/routes/') && method === 'DELETE') {
            if (!editorUsesLocalData()) return builderSectionsJsonResponse({ success: false, error: 'Route deletion is temporarily unavailable.' }, 501);
            const routeId = url.split('/')[4];
            const idx = mockWebsiteRoutes.findIndex(r => r.id === routeId);
            if (idx > -1) {
                mockWebsiteRoutes.splice(idx, 1);
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
            return new Response(JSON.stringify({ success: false, error: 'Route not found' }), { status: 404 });
        }
    }
    
    return originalFetch(input, init);
};

if (browserFixturesEnabled) window.fetch = browserFixtureFetch;

(window as any).EventLogs = getEvents();

const app = document.querySelector<HTMLDivElement>('#app')!;


// Simulated API exposed to window (Phase 1.8.1)
(window as any).handleInboundCall = handleInboundCall;
(window as any).endCall = endCall;


// Normalize existing mock data
mockContacts.forEach(c => {
  if (c.phone !== null) {
    const norm = normalizePhone(c.phone);
    c.phone = norm.normalized;
    if (norm.invalid) c.invalid_phone = true;
  }
  c.name = normalizeName(c.name);
  c.email = normalizeEmail(c.email);
});

// State Management
let currentView: string = 'dashboard';
(window as any).currentUser = undefined;

// Filter & Selection State
let clientSearchQuery: string = '';
let clientStatusFilter: string = 'all';
let selectedContactId: string | null = null;
let invoiceStatusFilter: string = 'all';

// Page Builder State
let builderPageId: string = mockPages[0]?.id || '';
let activeBuilderWebsiteId: string | null = null;
let builderRouteUnavailableReason: string | null = null;
let consumedBuilderInitialAction: string | null = null;
let builderSelectedSectionId: string | null = null;
let builderInsertOrder: number | null = null;
let builderInspectorTab: BuilderInspectorTab = 'content';
type BuilderLeftPanelTab = 'add' | 'pages' | 'navigation' | 'layers';
type BuilderMediaLeftPanelTab = BuilderLeftPanelTab | 'assets';
let builderLeftPanelTab: BuilderMediaLeftPanelTab = 'add';
let builderPagesPanelView: 'list' | 'settings' = 'list';
type BuilderViewport = 'desktop' | 'tablet' | 'mobile';
let builderViewport: BuilderViewport = 'mobile'; // WB.3.4 — mobile-first default
let builderHistoryController: BuilderHistoryController | null = null;
let builderPageSettingsController: BuilderPageSettingsController | null = null;
let builderNewPageController: BuilderNewPageController | null = null;
let builderNewPageControllerIdentity = '';
let builderDuplicatePageController: BuilderDuplicatePageController | null = null;
let builderDuplicatePageControllerIdentity = '';
let builderMediaController: BuilderMediaController | null = null;
let builderMediaControllerIdentity = '';
let builderMediaSelectedAssetIds = new Set<string>();
let builderMediaInitializing = false;
let builderMediaInitializationError: string | null = null;
let activeDashboardWebsiteId: string | null = null;
let activeSettingsWebsiteId: string | null = null;
let websiteDashboardController: WebsiteDashboardController | null = null;
type BuilderSetupWizardDraft = {
  identity: string;
  step: 1 | 2 | 3 | 4;
  templateId: BuilderSetupTemplateId;
  businessName: string;
  serviceArea: string;
  publicPhone: string;
  publicEmail: string;
  customerType: BuilderSetupBriefV1['customerType'];
  primaryGoal: BuilderSetupBriefV1['primaryGoal'];
  positioningStatement: string;
  services: BuilderSetupService[];
  primaryServiceId: string;
  trustSignals: BuilderSetupBriefV1['trustSignals'];
  yearsInBusiness: string;
  reviewRating: string;
  reviewCount: string;
  customTrustStatement: string;
  stylePreset: BuilderSetupBriefV1['stylePreset'];
  primaryColor: string;
  accentColor: string;
  heroAssetId: string;
  galleryAssetIds: string[];
  assetAltText: Record<string, string>;
  mode: BuilderSetupApplyMode | null;
  applySeoMetadata: boolean;
  replaceConfirmed: boolean;
};
let builderSetupWizardOpen = false;
let builderSetupDraft: BuilderSetupWizardDraft | null = null;
let builderSetupController: BuilderSetupController | null = null;
let builderSetupTriggerSelector = '.pb-guided-setup-button';
const builderSaveQueue = new BuilderSerializedSaveQueue();
let builderReturnTo: string = 'pages'; // WB.3.6 — context-aware Back button
let builderReturnFunnelId: string | null = null; // set when opened from funnel detail
let builderPublishModalOpen = false;
let builderPublicationLoading = false;
let builderPublishing = false;
let builderPublicationTarget: BuilderPublicationTarget | null = null;
let builderPublishedRevision: BuilderPublishedRevision | null = null;
let builderPublicationError: string | null = null;
let builderPublicationSuccess: string | null = null;
let builderPublicationLoadedPageId: string | null = null;
let builderPublicationStatusLoadFailed = false;
let builderPublicationRequestSequence = 0;
let builderPublicationHistoryOpen = false;
let builderPublicationHistoryLoading = false;
let builderPublicationHistoryItems: BuilderPublishedRevision[] = [];
let builderPublicationHistoryNextCursor: string | undefined;
let builderPublicationHistoryError: string | null = null;
let builderPublicationHistoryLoadingMore = false;
let builderPublicationRollbackRevisionId: string | null = null;
let builderPublicationRollbackConfirmationId: string | null = null;
let builderPublicationRollbackSuccess: string | null = null;
let builderPublicationHistoryPageId: string | null = null;
let builderPublicationHistoryRequestSequence = 0;
let builderPublicationHistoryLoadingCursor: string | null = null;
let publicSiteRenderSequence = 0;
let publicSiteAbortController: AbortController | null = null;
let publicSitePendingKey: string | null = null;
let publicSitePendingRequest: Promise<void> | null = null;
type PublicSiteViteEnvironment = {
  VITE_PUBLIC_SITE_DATA_SOURCE?: string;
  VITE_PUBLIC_SITE_ENDPOINT?: string;
  VITE_PUBLIC_SITE_HOST_OVERRIDE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_PUBLIC_LEAD_SUBMISSION?: string;
  VITE_PUBLIC_LEAD_ENDPOINT?: string;
  PROD?: boolean;
};
const publicSiteEnvironment = (
  import.meta as unknown as { env: PublicSiteViteEnvironment }
).env;
const publicSiteRuntime: PublicSiteRuntimeResult = resolvePublicSiteRuntime({
  configuredMode: publicSiteEnvironment.VITE_PUBLIC_SITE_DATA_SOURCE,
  production: publicSiteEnvironment.PROD === true,
  supabaseUrl: publicSiteEnvironment.VITE_SUPABASE_URL,
  explicitEndpoint: publicSiteEnvironment.VITE_PUBLIC_SITE_ENDPOINT,
  allowLocalhostEndpoint: publicSiteEnvironment.PROD !== true
});
const publicSiteHostOverride = publicSiteEnvironment.VITE_PUBLIC_SITE_HOST_OVERRIDE;
const publicLeadRuntime = resolvePublicLeadRuntime({
  configuredMode: publicSiteEnvironment.VITE_PUBLIC_LEAD_SUBMISSION,
  production: publicSiteEnvironment.PROD === true,
  supabaseUrl: publicSiteEnvironment.VITE_SUPABASE_URL,
  explicitEndpoint: publicSiteEnvironment.VITE_PUBLIC_LEAD_ENDPOINT
});
let activeRenderedPublicSections: PageSection[] = [];
let activeRenderedPublicPreview = false;
const publicLeadAttempts = new Map<string, { key: string; signature: string; accepted: boolean }>();
const authenticatedFormAttempts = new FormSubmissionIdempotency();
type BuilderContext = {
  websiteId?: string;
  pageId: string;
  action?: BuilderNavigationAction;
  sectionId?: string | null;
  path?: string;
  label?: string;
  returnTo?: string;
  funnelId?: string | null;
  updatedAt?: string;
};
let compSearchQuery: string = '';
let compCategoryFilter: string = 'all';
let contactTimelineState: any[] = [];
let lastContactCount = mockContacts.length;

function getActingUserId(): string {
  const value = (window as any).currentUser;
  return typeof value === 'string' ? value.trim() : '';
}

function clearProtectedRuntimeData(): void {
  protectedAsyncOperationGuard.invalidateRuntime();
  websiteGenerationInFlight = false;
  lastGeneratedWebsiteData = null;
  crmProductionHydrator.clear();
  websiteLayoutHydrator.clear();
  websiteSettingsHydrator.clear();
  applyPrimaryColor(mockWebsiteSettings.primary_color);
  removeLocalFixtureRows();
  mockAutomationLogs.splice(0);
  contactTimelineState = [];
  selectedContactId = null;
  activeBuilderWebsiteId = null;
  activeDashboardWebsiteId = null;
  activeSettingsWebsiteId = null;
  activeWebsiteContext = null;
  builderPageId = '';
  builderHistoryController = null;
  builderPageSettingsController?.cancelPending();
  builderPageSettingsController = null;
  builderNewPageController = null;
  builderNewPageControllerIdentity = '';
  builderMediaController?.dispose();
  builderMediaController = null;
  builderMediaControllerIdentity = '';
  websiteDashboardController?.invalidate();
  websiteDashboardController = null;
  currentShellController?.destroy();
  currentShellController = null;
  lastContactCount = 0;
}

const CRM_DATA_VIEWS = new Set([
  'dashboard', 'clients', 'contact-detail', 'opportunities', 'quotes', 'new-quote',
  'quote-preview', 'invoices'
]);

function renderCrmDataLoading(view: string): void {
  if (view === 'dashboard') {
    renderAppWithShell({
      ...createDashboardLoadingShellOptions(),
      user: getCurrentShellUser()
    });
    return;
  }
  renderAppWithShell({
    activeView: view,
    title: 'Loading CRM data…',
    contentVariant: 'standard',
    contentHtml: `<section class="card" aria-busy="true"><p>Loading your account data.</p></section>`
  });
}

function renderCrmHydrationNotice(): void {
  if (!editorUsesSupabase() || crmProductionHydrator.state.status !== 'error') return;
  const failed = Object.entries(crmProductionHydrator.state.entities)
    .filter(([, status]) => status === 'error')
    .map(([name]) => name.replace('_', ' '));
  const main = app.querySelector<HTMLElement>('main.wo-shell-main') || app.querySelector<HTMLElement>('main.main-content');
  if (!main || main.querySelector('[data-crm-hydration-error]')) return;
  const notice = document.createElement('section');
  notice.className = 'card';
  notice.dataset.crmHydrationError = 'true';
  notice.setAttribute('role', 'alert');
  notice.innerHTML = `<strong>Some CRM data could not be loaded.</strong><p>${failed.join(', ')} are temporarily unavailable. Loaded account data remains visible; retry before relying on empty results.</p><button type="button" class="btn-outline" onclick="window.retryCrmDataLoad()">Retry</button>`;
  main.insertBefore(notice, main.children[1] ?? null);
}

async function ensureProductionCrmData(userId: string, view: string, force = false): Promise<void> {
  if (!editorUsesSupabase() || !CRM_DATA_VIEWS.has(view)) return;
  if (force || crmProductionHydrator.state.userId !== userId || crmProductionHydrator.state.status === 'idle') {
    renderCrmDataLoading(view);
    await crmProductionHydrator.hydrateAuthenticatedUser(userId, force);
  }
}

(window as any).retryCrmDataLoad = async () => {
  const userId = getActingUserId();
  if (!userId) return;
  await ensureProductionCrmData(userId, currentView, true);
  await (window as any).navigateTo(currentView, selectedContactId || undefined);
};

function applyApplicationAuthState(state: ApplicationAuthState): void {
  const previousUserId = getActingUserId();
  if (state.status !== 'authenticated') {
    (window as any).currentUser = undefined;
    if (previousUserId || editorUsesSupabase()) clearProtectedRuntimeData();
    return;
  }
  if (previousUserId && previousUserId !== state.user.id) clearProtectedRuntimeData();
  (window as any).currentUser = state.user.id;
  if (state.source === 'supabase' && previousUserId !== state.user.id) {
    clearProtectedRuntimeData();
    (window as any).currentUser = state.user.id;
  }
  if (state.source === 'local' && previousUserId !== state.user.id) {
    hydrateLocalMockCrm(state.user.id);
    PagesRepo.hydrateLocalPages(state.user.id);
    hydrateBuilderPageSettingsPagesFromLocalStorage(state.user.id);
    lastContactCount = mockContacts.length;
  }
}

async function ensureApplicationAuth(): Promise<ApplicationAuthState> {
  if (!applicationAuthInitialization) {
    applicationAuthController.onChange(state => {
      applicationAuthInitialization = Promise.resolve(state);
      const previousUserId = getActingUserId();
      applyApplicationAuthState(state);
      if (
        applicationAuthHasInitialized
        && !applicationAuthFormSubmissionInProgress
        && (
          (state.status === 'authenticated' && previousUserId !== state.user.id)
          || (state.status !== 'authenticated' && Boolean(previousUserId))
        )
        && isCrmApplicationHost(window.location.hostname)
      ) {
        void bootRouter();
      }
    });
    applicationAuthInitialization = applicationAuthController.initialize().then(state => {
      applicationAuthHasInitialized = true;
      return state;
    });
  }
  const state = await applicationAuthInitialization;
  applyApplicationAuthState(state);
  return state;
}

(window as any).switchUser = async (userId: string) => {
  if (!editorUsesLocalData()) return;
  if (builderSetupController?.status === 'applying') return;
  builderSetupWizardOpen = false;
  builderSetupDraft = null;
  builderSetupController = null;
  document.body.classList.remove('pb-setup-modal-open');
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = undefined;
    await (window as any).savePageSections();
  }
  await builderSaveQueue.whenIdle();
  builderHistoryController = null;
  activeBuilderWebsiteId = null;
  activeDashboardWebsiteId = null;
  activeSettingsWebsiteId = null;
  protectedAsyncOperationGuard.invalidateRuntime();
  websiteDashboardController?.invalidate();
  websiteDashboardController = null;
  (window as any).currentUser = userId;
  console.log(`[QA] Switched UI context to User: ${userId}`);
  (window as any).navigateTo(currentView, selectedContactId || undefined);
};

// QA Simulation State (Phase 3.3)
let pendingSimulationCallId: string | null = null;
let lastSimulationResult: any = null;
let isProcessingSimulation: boolean = false;

let mockGlobalSettings = {
  businessName: 'PressurePro Cleaning',
  logoUrl: '',
  phone: '1-800-CLEAN-IT',
  seoTitleFormat: '{page_name} | {business_name}',
  seoDescriptionFallback: 'Professional pressure washing and exterior cleaning services.',
  fbPixelId: '',
  gtmId: ''
};

(window as any).updateGlobalSettings = (key: string, value: string) => {
  (mockGlobalSettings as any)[key] = value;
};

(window as any).saveGlobalSettings = async () => {
  const s = getWebsiteSettings();
  const readInput = (selector: string): string | undefined => {
    const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    return el ? el.value : undefined;
  };

  const formValues: Partial<WebsiteSettings> = {
    business_name: readInput('[data-settings-field="business_name"]') ?? s.business_name,
    phone: readInput('#settings-phone-input') ?? s.phone,
    sms_number: readInput('#settings-sms-number-input') ?? s.sms_number,
    email: readInput('#settings-email-input') ?? s.email,
    logo_url: readInput('#settings-logo-url-input') ?? s.logo_url,
    primary_color: readInput('#settings-primary-color-input') ?? s.primary_color,
    facebook_pixel_id: readInput('[data-settings-field="facebook_pixel_id"]') ?? s.facebook_pixel_id,
    gtm_id: readInput('[data-settings-field="gtm_id"]') ?? s.gtm_id
  };
  const candidate = { ...s, ...formValues };

  // Basic validation before save
  if (!candidate.business_name || candidate.business_name.trim() === '') {
    (window as any).showToast?.('Business name cannot be empty.', 'error');
    return;
  }
  if (candidate.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate.email)) {
    (window as any).showToast?.('Please enter a valid email address.', 'error');
    return;
  }

  const saveBtn = document.querySelector('[onclick="window.saveGlobalSettings()"]') as HTMLButtonElement | null;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate)
    }).then(r => r.json());

    if (res.success) {
      if (res.data) Object.assign(s, res.data);
      applyPrimaryColor(s.primary_color);
      (window as any).showToast?.('Settings saved successfully!', 'success');
      renderWebsiteSettings();
    } else {
      (window as any).showToast?.(`Settings could not be saved: ${res.error || 'Unknown error'}`, 'error');
    }
  } catch (err: any) {
    (window as any).showToast?.(`Save failed: ${err.message}`, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Settings'; }
  }
};

(window as any).setCompCategory = (cat: string) => {
  compCategoryFilter = cat;
  renderComponents();
};

(window as any).setCompSearch = (val: string) => {
  compSearchQuery = val.toLowerCase();
  renderComponents();
};

(window as any).cancelComponentPicker = () => {
  builderInsertOrder = null;
  (window as any).navigateTo('builder');
};

// New Quote State
let newQuoteLineItems: { service: string, description: string, quantity: number, price: number, tier: 'basic' | 'standard' | 'premium' }[] = [
  { service: '', description: '', quantity: 1, price: 0, tier: 'basic' }
];

(window as any).newQuoteLineItems = newQuoteLineItems;
let newQuoteContactId: string = '';
(window as any).newQuoteContactId = newQuoteContactId;
let newQuoteOpportunityId: string = '';
(window as any).newQuoteOpportunityId = newQuoteOpportunityId;

/**
 * Standardized "New" badge logic (Phase 5.1)
 * Returns true if the provided date string is within the last 24 hours.
 */
function isNew(dateStr: string): boolean {
  if (!dateStr) return false;
  const now = new Date().getTime();
  const createdAt = new Date(dateStr).getTime();
  return (now - createdAt) < (24 * 60 * 60 * 1000);
}

/**
 * Standardized "Needs Attention" badge logic (Phase 5.2)
 * Triggers on operational blockers like failed SMS, manual follow-up flags, 
 * or recent unresolved missed calls.
 */
function needsAttention(contact: any): boolean {
  if (contact.follow_up_required) return true;
  
  // Real-time check for failed SMS
  const hasFailedSMS = (getAllMessagesOrdered() || []).some(m => m.contact_id === contact.id && m.status === 'failed');
  if (hasFailedSMS) return true;
  
  // Recent missed call (last 2 hours) implies urgency
  const now = new Date().getTime();
  const recentMissedCall = getCallsForContact().find(c => c.status === 'missed' &&
    (now - new Date(c.created_at).getTime()) < (2 * 60 * 60 * 1000)
  );
  
  return !!recentMissedCall;
}

let currentShellController: ShellController | null = null;

function getCurrentShellUser(): ShellUser {
  const userId = getActingUserId();
  const businessName = mockWebsiteSettings?.business_name || 'WashOps Pressure Washing';
  const userName = 'Account User';
  return {
    name: userName,
    businessName
  };
}

function handleShellNavigation(target: ShellNavigationTarget): void {
  if (target.kind === 'website-settings') {
    (window as any).openWebsiteSettings();
  } else if (target.kind === 'website-management') {
    (window as any).openWebsiteManagementView(target.view);
  } else {
    (window as any).navigateTo(target.view, target.id);
  }
}

function renderAppWithShell(options: ApplicationShellOptions): void {
  currentShellController?.destroy();
  const userId = getActingUserId();
  const newCount = mockContacts.filter(c => c.user_id === userId && isNew(c.created_at)).length;
  const navGroups = options.navGroups ?? getDefaultNavGroups(options.activeView, { clients: newCount });

  app.innerHTML = renderApplicationShell({
    ...options,
    navGroups,
    user: options.user ?? getCurrentShellUser()
  });

  currentShellController = initApplicationShell(app, {
    onNavigate: handleShellNavigation
  });
}

function renderDashboard() {
  const userId = getActingUserId();

  const fixtureState = browserFixturesEnabled
    ? new URLSearchParams(window.location.search).get('dashboardState')
    : null;
  if (fixtureState === 'loading') {
    renderAppWithShell({
      ...createDashboardLoadingShellOptions(),
      user: getCurrentShellUser()
    });
    return;
  }

  // 🏁 WB.6.1: Check for Onboarding
  const alreadySeenOnboarding = !!window.localStorage.getItem('onboarding_seen');
  if (editorUsesSupabase()) {
    void loadWebsiteDashboardCore({ actingUserId: userId }).then(core => {
      if (core.websites.length > 0) {
        document.getElementById('website-onboarding-modal')?.remove();
        return;
      }
      if (currentView !== 'dashboard') return;
      const shouldShow = shouldShowWebsiteOnboarding({
        alreadySeen: alreadySeenOnboarding,
        usesSupabase: true,
        durableWebsiteCount: core.websites.length
      });
      if (shouldShow) (window as any).showOnboardingModal();
      else document.getElementById('website-onboarding-modal')?.remove();
    }).catch(() => {
      // Repository failure must not be mistaken for a brand-new account.
      document.getElementById('website-onboarding-modal')?.remove();
    });
  } else if (!alreadySeenOnboarding) {
    fetch('/api/funnels').then(r => r.json()).then(res => {
      if (currentView === 'dashboard' && res.success && shouldShowWebsiteOnboarding({
        alreadySeen: false,
        usesSupabase: false,
        localFunnelCount: Array.isArray(res.data) ? res.data.length : undefined
      })) {
        (window as any).showOnboardingModal();
      }
    });
  }

  const fixtureEmpty = fixtureState === 'empty';
  const availability: DashboardDataAvailability = editorUsesSupabase()
    ? {
      contacts: crmProductionHydrator.state.entities.contacts === 'ready',
      opportunities: crmProductionHydrator.state.entities.opportunities === 'ready',
      activities: crmProductionHydrator.state.entities.activities === 'ready',
      quotes: crmProductionHydrator.state.entities.quotes === 'ready'
    }
    : { contacts: true, opportunities: true, activities: true, quotes: true };
  const model = createDashboardViewModel({
    userId,
    now: new Date(),
    contacts: fixtureEmpty ? [] : mockContacts,
    opportunities: fixtureEmpty ? [] : mockOpportunities,
    activities: fixtureEmpty ? [] : mockActivities,
    quotes: fixtureEmpty ? [] : mockQuotes,
    pipelineStages: mockPipelines[0]?.stages ?? [],
    availability
  });

  renderAppWithShell({
    ...createDashboardShellOptions(model),
    user: getCurrentShellUser()
  });
}

async function renderClients() {
  renderAppWithShell({
    activeView: 'clients',
    title: 'Clients & Leads',
    headerActionsHtml: '<button class="btn-primary" onclick="window.navigateTo(\'lead-capture\')">+ Add Lead</button>',
    contentVariant: 'wide',
    user: getCurrentShellUser(),
    contentHtml: renderClientsLoading()
  });

  try {
    const response = await fetch('/api/contacts');
    const result = await response.json();
    const contacts: Contact[] = result.data || result;
    const userId = getActingUserId();

    renderAppWithShell({
      activeView: 'clients', title: 'Clients & Leads', contentVariant: 'wide', user: getCurrentShellUser(),
      headerActionsHtml: '<button class="btn-primary" onclick="window.navigateTo(\'lead-capture\')">+ Add Lead</button>',
      contentHtml: renderClientsContent({ userId, contacts, activities: mockActivities, query: clientSearchQuery, filter: clientStatusFilter as ContactFilter, now: new Date() })
    });
  } catch {
    renderAppWithShell({ activeView: 'clients', title: 'Clients & Leads', contentVariant: 'wide', user: getCurrentShellUser(), headerActionsHtml: '<button class="btn-primary" onclick="window.navigateTo(\'lead-capture\')">+ Add Lead</button>', contentHtml: '<section class="wo-contacts"><div class="wo-error-state" role="alert"><h2 class="wo-error-state-title">Contacts could not be loaded</h2><p class="wo-error-state-description">Try refreshing this screen.</p></div></section>' });
    return;
  }

  const searchInput = document.getElementById('client-search') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    clientSearchQuery = (e.target as HTMLInputElement).value;
    renderClients();
  });
  // Keep focus and cursor at the end
  if (clientSearchQuery) {
    searchInput.focus();
    searchInput.setSelectionRange(clientSearchQuery.length, clientSearchQuery.length);
  }
}

(window as any).closeSmsComposer = () => {
  document.getElementById('sms-composer-modal')?.remove();
};

(window as any).sendSmsFromComposer = async (contactId: string) => {
  const textarea = document.getElementById('sms-composer-text') as HTMLTextAreaElement;
  const content = textarea?.value?.trim();
  
  if (!content) {
    alert('Please enter a message.');
    return;
  }

  try {
    (window as any).showToast('Sending SMS...', 2000);
    const sendResult = await sendMessageToContact(contactId, content);
    if (!sendResult.success) {
      (window as any).showToast(sendResult.error || 'Error: Could not send SMS', 5000);
      return;
    }
    (window as any).showToast('Message sent! Timeline updated.');
    (window as any).closeSmsComposer();
    
    // Refresh context if visible (Phase 2.5)
    if (currentView === 'clients') {
      renderClients();
    } else if (currentView === 'contact-detail') {
      (window as any).loadTimeline(contactId);
    }
  } catch (err) {
    console.error('Text Back Error:', err);
    (window as any).showToast('Error: Could not send SMS', 5000);
  }
};

(window as any).openSmsComposer = async (contactId: string) => {
  const response = await fetch(`/api/contacts/${contactId}`);
  const contact: Contact | null = await response.json();
  
  const userId = getActingUserId();
  if (!contact || response.status === 404 || contact.user_id !== userId) {
    (window as any).showToast('Contact not found.', 3000);
    return;
  }
  
  // Check for valid phone (Phase 2.6)
  const hasPhone = hasContactPhone(contact.phone);

  // Pre-fill with a default follow-up message (Phase 2.3)
  const defaultMessage = "Hey, I saw your request—how can I help?";
  
  // Render lightweight modal UI
  const modal = document.createElement('div');
  modal.id = 'sms-composer-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 12px; width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); color: #333;">
      <h3 style="margin-top: 0; margin-bottom: 5px;">Texting ${escapeHtmlText(contact.name)}</h3>
      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 20px;">
        ${hasPhone 
          ? `Recieving at: <span style="font-weight: 600;">${escapeHtmlText(contact.phone)}</span>`
          : `<span style="color: #dc2626; font-weight: 600;">🛑 No phone number available</span>`}
      </p>
      
      <textarea id="sms-composer-text" 
                style="width: 100%; height: 120px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; resize: none; margin-bottom: 20px; ${!hasPhone ? 'background: #f8fafc; cursor: not-allowed;' : ''}" 
                placeholder="${hasPhone ? 'Type your message here...' : 'Add a phone number to send messages.'}" 
                ${!hasPhone ? 'disabled' : ''}>${hasPhone ? defaultMessage : ''}</textarea>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="window.closeSmsComposer()" style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #64748b;">Cancel</button>
        <button onclick="${hasPhone ? `window.sendSmsFromComposer('${contact.id}')` : ''}" 
                class="btn-primary" 
                style="padding: 10px 25px; font-weight: 700; ${!hasPhone ? 'opacity: 0.4; cursor: not-allowed;' : ''}"
                ${!hasPhone ? 'disabled' : ''}>Send SMS</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const textarea = document.getElementById('sms-composer-text') as HTMLTextAreaElement;
  if (textarea && hasPhone) {
    textarea.focus();
    // Select all text for easy replacement
    textarea.setSelectionRange(0, textarea.value.length);
  }
};

(window as any).textContact = (contactId: string) => {
  (window as any).openSmsComposer(contactId);
};

(window as any).filterClients = (status: string) => {
  clientStatusFilter = status;
  renderClients();
};

(window as any).updatePageName = (id: string, name: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Page renaming')) return;
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.name = name;
    (page as any).updated_at = new Date().toISOString();
  }
};

(window as any).togglePublishFromBuilder = (id: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Legacy page publishing')) return;
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.status = page.status === 'published' ? 'draft' : 'published';
    (page as any).updated_at = new Date().toISOString();
    renderBuilder();
    if (page.status === 'published') {
      (window as any).showToast('Page published');
    } else {
      (window as any).showToast('Page unpublished');
    }
  }
};

let autoSaveTimeout: any;
const builderSaveState = new BuilderSaveStateController();
const builderPageRevisionAuthority = new BuilderPageRevisionAuthority();
const builderViewTransitions = new BuilderViewTransitionController();

function renderBuilderAutosaveIndicator(): void {
  const indicator = document.getElementById('pb-autosave-indicator');
  if (!indicator) return;
  const status = builderSaveState.status;
  const color = status === 'saved' ? '#10b981'
    : status === 'saving' ? '#fbbf24'
      : status === 'dirty' ? '#f97316'
        : '#ef4444';
  const recovery = status === 'failed'
    ? ` <button type="button" class="pb-autosave-retry" onclick="window.retryBuilderAutosave()">Retry</button>`
    : status === 'conflict'
      ? ` <button type="button" class="pb-autosave-retry" onclick="window.reloadBuilderAfterConflict()">Reload page</button>`
      : '';
  indicator.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></span> ${builderSaveStatusLabel(status)}${recovery}`;
}

(window as any).reloadBuilderAfterConflict = () => window.location.reload();

(window as any).retryBuilderAutosave = () => {
  if (builderPageRevisionAuthority.requiresReload(builderPageId)) {
    (window as any).reloadBuilderAfterConflict();
    return;
  }
  builderSaveState.markDirty();
  (window as any).triggerAutoSave();
};

type BuilderPublicationDisplayStatus = {
  label: 'Never published' | 'Published' | 'Unpublished changes' | 'Checking…' | 'Status unavailable';
  className: 'never' | 'published' | 'changes' | 'checking' | 'unavailable';
  state: 'never-published' | 'published' | 'changes-pending' | 'checking' | 'unavailable';
};

function getBuilderPublicationWebsite(page: Page): Website | undefined {
  const currentUser = (window as any).currentUser as User | string;
  const activeWebsite = getActiveBuilderWebsite();
  if (
    activeWebsite
    && canAccessBuilderPublicationPage(currentUser, activeWebsite.id, page.id)
  ) {
    return activeWebsite;
  }
  return mockWebsites.find(website => (
    canAccessBuilderPublicationPage(currentUser, website.id, page.id)
  ));
}

function syncBuilderDocumentToPageSections(document: BuilderDocument): void {
  const pageId = document.page.id;
  for (let index = mockPageSections.length - 1; index >= 0; index -= 1) {
    if (mockPageSections[index].page_id === pageId) {
      mockPageSections.splice(index, 1);
    }
  }
  mockPageSections.push(...builderDocumentToPageSections(document));
}

function initializeBuilderHistory(pageId: string): BuilderHistoryController | null {
  const page = mockPages.find(item => item.id === pageId);
  if (!page) return null;
  const sections = mockPageSections.filter(section => section.page_id === pageId);
  const document = createBuilderDocument(page, sections);
  const issues = validateBuilderDocument(document);
  if (issues.length > 0) {
    console.error('[Builder] Current page data could not initialize undo history.');
    return null;
  }

  try {
    builderHistoryController = new BuilderHistoryController(document, {
      selectedSectionId: builderSelectedSectionId,
      viewport: builderViewport
    });
    if (builderPageRevisionAuthority.requiresReload(pageId)) {
      builderSaveState.requireReloadForConflict();
    } else {
      builderSaveState.resetSaved();
    }
    return builderHistoryController;
  } catch {
    console.error('[Builder] Current page data could not initialize undo history.');
    return null;
  }
}

function getBuilderHistoryController(): BuilderHistoryController | null {
  if (builderHistoryController?.pageId === builderPageId) {
    return builderHistoryController;
  }
  return initializeBuilderHistory(builderPageId);
}

function getCurrentBuilderDocument(pageId = builderPageId): BuilderDocument | null {
  if (pageId === builderPageId) {
    const history = getBuilderHistoryController();
    if (history) return history.document;
  }
  const page = mockPages.find(item => item.id === pageId);
  if (!page) return null;
  const sections = mockPageSections.filter(section => section.page_id === pageId);
  return createBuilderDocument(page, sections);
}

function getCurrentBuilderSections(): PageSection[] {
  const document = getCurrentBuilderDocument();
  return document ? builderDocumentToPageSections(document) : [];
}

function normalizeBuilderDocumentOrders(document: BuilderDocument): BuilderDocument {
  const orderedSections = document.sections
    .map((section, inputIndex) => ({ section, inputIndex }))
    .sort((left, right) => left.section.order - right.section.order || left.inputIndex - right.inputIndex)
    .map(item => item.section);
  return {
    ...document,
    sections: orderedSections.map((section, index) => ({
      ...section,
      order: index
    }))
  };
}

function updateBuilderHistoryControls(): void {
  const history = builderHistoryController?.pageId === builderPageId
    ? builderHistoryController
    : null;
  const undo = document.getElementById('pb-history-undo') as HTMLButtonElement | null;
  const redo = document.getElementById('pb-history-redo') as HTMLButtonElement | null;
  if (undo) undo.disabled = history?.canUndo !== true;
  if (redo) redo.disabled = history?.canRedo !== true;
}

function applyLiveBuilderMutation(
  mutator: (document: BuilderDocument) => BuilderDocument,
  metadata: Parameters<BuilderHistoryController['applyMutation']>[1],
  options: { render?: boolean; autosave?: boolean } = {}
): boolean {
  const history = getBuilderHistoryController();
  if (!history) return false;
  const result = history.applyMutation(mutator, metadata);
  if (!result.changed) {
    if (result.issues.length > 0) {
      (window as any).showToast?.('That change could not be applied.', 'error');
    }
    return false;
  }

  syncBuilderDocumentToPageSections(history.document);
  builderSaveState.markDirty();
  builderSelectedSectionId = history.selectedSectionId;
  builderViewport = history.viewport;
  if (options.autosave !== false) (window as any).triggerAutoSave();
  updateBuilderPublicationStatusBadge();
  updateBuilderHistoryControls();
  if (options.render !== false) renderBuilder();
  return true;
}

function applyBuilderHistoryTransition(command: 'undo' | 'redo'): boolean {
  const history = getBuilderHistoryController();
  if (!history) return false;
  const changed = command === 'undo' ? history.undo() : history.redo();
  if (!changed) return false;
  syncBuilderDocumentToPageSections(history.document);
  builderSelectedSectionId = history.selectedSectionId;
  builderViewport = history.viewport;
  (window as any).triggerAutoSave();
  renderBuilder();
  return true;
}

function getBuilderPublicationDisplayStatus(): BuilderPublicationDisplayStatus {
  if (
    builderPublicationLoadedPageId !== builderPageId
    || builderPublicationLoading
  ) {
    return { label: 'Checking…', className: 'checking', state: 'checking' };
  }
  if (builderPublicationStatusLoadFailed) {
    return { label: 'Status unavailable', className: 'unavailable', state: 'unavailable' };
  }
  if (!builderPublicationTarget || !builderPublishedRevision) {
    return { label: 'Never published', className: 'never', state: 'never-published' };
  }

  const document = getCurrentBuilderDocument();
  if (!document) {
    return { label: 'Status unavailable', className: 'unavailable', state: 'unavailable' };
  }
  try {
    const publicationState = getBuilderPublicationState(document, builderPublishedRevision);
    const hasChanges = hasBuilderUnpublishedChanges(document, builderPublishedRevision);
    return publicationState === 'published' && !hasChanges
      ? { label: 'Published', className: 'published', state: 'published' }
      : { label: 'Unpublished changes', className: 'changes', state: 'changes-pending' };
  } catch {
    return { label: 'Status unavailable', className: 'unavailable', state: 'unavailable' };
  }
}

function updateBuilderPublicationStatusBadge(): void {
  const badge = document.getElementById('pb-publication-status');
  if (!badge) return;
  const status = getBuilderPublicationDisplayStatus();
  badge.className = `pb-publication-status ${status.className}`;
  badge.textContent = status.label;
}

async function loadBuilderPublicationState(
  pageId: string,
  preserveMessages = false
): Promise<void> {
  const page = mockPages.find(item => item.id === pageId);
  if (!page) return;
  const website = getBuilderPublicationWebsite(page);
  const requestSequence = ++builderPublicationRequestSequence;
  builderPublicationLoadedPageId = pageId;
  builderPublicationLoading = true;
  builderPublicationStatusLoadFailed = false;
  builderPublicationTarget = null;
  builderPublishedRevision = null;
  if (!preserveMessages) {
    builderPublicationError = null;
    builderPublicationSuccess = null;
  }

  if (!website) {
    builderPublicationLoading = false;
    builderPublicationStatusLoadFailed = true;
    if (!preserveMessages) {
      builderPublicationError = 'We couldn’t load the publication status.';
    }
    if (builderPageId === pageId && currentView === 'builder') renderBuilder();
    return;
  }

  const result = await getBuilderPagePublication(
    (input, init) => window.fetch(input, init),
    website.id,
    pageId
  );
  if (
    requestSequence !== builderPublicationRequestSequence
    || builderPageId !== pageId
    || builderPublicationLoadedPageId !== pageId
  ) {
    return;
  }

  builderPublicationLoading = false;
  if (!result.success || !result.data || typeof result.data !== 'object') {
    builderPublicationStatusLoadFailed = true;
    if (!preserveMessages) {
      builderPublicationError = 'We couldn’t load the publication status.';
    }
  } else {
    builderPublicationStatusLoadFailed = false;
    builderPublicationTarget = result.data.target ?? null;
    builderPublishedRevision = result.data.publishedRevision ?? null;
  }
  if (currentView === 'builder') renderBuilder();
}

function ensureBuilderPublicationState(pageId: string): void {
  if (builderPublicationLoadedPageId === pageId) return;
  void loadBuilderPublicationState(pageId);
}

function resetBuilderPublicationHistory(): void {
  builderPublicationHistoryRequestSequence += 1;
  builderPublicationHistoryOpen = false;
  builderPublicationHistoryLoading = false;
  builderPublicationHistoryItems = [];
  builderPublicationHistoryNextCursor = undefined;
  builderPublicationHistoryError = null;
  builderPublicationHistoryLoadingMore = false;
  builderPublicationRollbackRevisionId = null;
  builderPublicationRollbackConfirmationId = null;
  builderPublicationRollbackSuccess = null;
  builderPublicationHistoryPageId = null;
  builderPublicationHistoryLoadingCursor = null;
}

function appendBuilderPublicationHistoryPage(
  page: BuilderPublicationHistoryPage,
  append: boolean
): void {
  if (!append) {
    builderPublicationHistoryItems = [...page.items];
  } else {
    const knownIds = new Set(builderPublicationHistoryItems.map(revision => revision.id));
    builderPublicationHistoryItems = [
      ...builderPublicationHistoryItems,
      ...page.items.filter(revision => !knownIds.has(revision.id))
    ];
  }
  builderPublicationHistoryNextCursor = page.nextCursor;
}

async function loadBuilderPublicationHistory(
  pageId: string,
  options: { cursor?: string; preserveMessages?: boolean; force?: boolean } = {}
): Promise<void> {
  const append = options.cursor !== undefined;
  if (append) {
    if (
      builderPublicationHistoryLoadingMore
      || builderPublicationHistoryLoadingCursor === options.cursor
    ) return;
  } else if (builderPublicationHistoryLoading && !options.force) {
    return;
  }

  const page = mockPages.find(item => item.id === pageId);
  const website = page ? getBuilderPublicationWebsite(page) : undefined;
  const requestSequence = ++builderPublicationHistoryRequestSequence;
  builderPublicationHistoryPageId = pageId;
  builderPublicationHistoryLoadingCursor = options.cursor ?? null;
  if (append) {
    builderPublicationHistoryLoadingMore = true;
  } else {
    builderPublicationHistoryLoading = true;
    builderPublicationHistoryLoadingMore = false;
    builderPublicationHistoryItems = [];
    builderPublicationHistoryNextCursor = undefined;
  }
  if (!options.preserveMessages) {
    builderPublicationHistoryError = null;
    builderPublicationRollbackSuccess = null;
  }

  if (!page || !website) {
    builderPublicationHistoryLoading = false;
    builderPublicationHistoryLoadingMore = false;
    builderPublicationHistoryLoadingCursor = null;
    builderPublicationHistoryError = 'We couldn’t load version history.';
    if (currentView === 'builder') renderBuilder();
    return;
  }

  const result = await listBuilderPageRevisions(
    (input, init) => window.fetch(input, init),
    {
      websiteId: website.id,
      pageId,
      limit: 25,
      ...(options.cursor === undefined ? {} : { cursor: options.cursor })
    }
  );
  if (
    requestSequence !== builderPublicationHistoryRequestSequence
    || builderPageId !== pageId
    || builderPublicationHistoryPageId !== pageId
  ) return;

  builderPublicationHistoryLoading = false;
  builderPublicationHistoryLoadingMore = false;
  builderPublicationHistoryLoadingCursor = null;
  if (!result.success) {
    builderPublicationHistoryError = 'We couldn’t load version history.';
  } else {
    appendBuilderPublicationHistoryPage(result.data, append);
    if (!options.preserveMessages) builderPublicationHistoryError = null;
  }
  if (currentView === 'builder') renderBuilder();
}

(window as any).openBuilderVersionHistory = () => {
  if (!builderPublishModalOpen || builderMode !== 'edit') return;
  const shouldLoad = builderPublicationHistoryPageId !== builderPageId
    || builderPublicationHistoryError !== null;
  builderPublicationHistoryOpen = true;
  builderPublicationRollbackConfirmationId = null;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = null;
  renderBuilder();
  if (shouldLoad && !builderPublicationHistoryLoading) {
    void loadBuilderPublicationHistory(builderPageId);
  }
};

(window as any).closeBuilderVersionHistory = () => {
  if (builderPublicationRollbackRevisionId) return;
  builderPublicationHistoryOpen = false;
  builderPublicationRollbackConfirmationId = null;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = null;
  renderBuilder();
};

(window as any).loadMoreBuilderPublicationHistory = () => {
  if (!builderPublicationHistoryNextCursor) return;
  void loadBuilderPublicationHistory(builderPageId, {
    cursor: builderPublicationHistoryNextCursor,
    preserveMessages: true
  });
  renderBuilder();
};

(window as any).confirmBuilderPublicationRollback = (revisionId: string) => {
  const revision = builderPublicationHistoryItems.find(item => item.id === revisionId);
  if (!revision || revision.id === builderPublicationTarget?.publishedRevisionId) return;
  builderPublicationRollbackConfirmationId = revisionId;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = null;
  renderBuilder();
};

(window as any).cancelBuilderPublicationRollback = () => {
  if (builderPublicationRollbackRevisionId) return;
  builderPublicationRollbackConfirmationId = null;
  renderBuilder();
};

(window as any).restoreBuilderPublishedRevision = async () => {
  if (builderPublicationRollbackRevisionId) return;
  const pageId = builderPageId;
  const revisionId = builderPublicationRollbackConfirmationId;
  const page = mockPages.find(item => item.id === pageId);
  const website = page ? getBuilderPublicationWebsite(page) : undefined;
  const revision = revisionId
    ? builderPublicationHistoryItems.find(item => item.id === revisionId)
    : undefined;
  if (
    !page
    || !website
    || !revision
    || builderPublicationHistoryPageId !== pageId
    || revision.pageId !== pageId
    || revision.websiteId !== website.id
  ) {
    builderPublicationHistoryError = revisionId
      ? 'This version is no longer available.'
      : 'We couldn’t restore this version.';
    builderPublicationRollbackConfirmationId = null;
    renderBuilder();
    return;
  }
  if (
    builderPublicationLoadedPageId !== pageId
    || builderPublicationLoading
    || builderPublicationStatusLoadFailed
  ) {
    builderPublicationHistoryError = 'We couldn’t restore this version.';
    renderBuilder();
    return;
  }
  if (revision.id === builderPublicationTarget?.publishedRevisionId) {
    builderPublicationRollbackConfirmationId = null;
    renderBuilder();
    return;
  }

  builderPublicationRollbackRevisionId = revision.id;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = null;
  renderBuilder();

  const result = await rollbackBuilderPageRevision(
    (input, init) => window.fetch(input, init),
    {
      websiteId: website.id,
      pageId,
      revisionId: revision.id,
      expectedPublishedRevisionId: builderPublicationTarget?.publishedRevisionId ?? null,
      publishedAt: new Date().toISOString()
    }
  );
  if (
    builderPageId !== pageId
    || builderPublicationHistoryPageId !== pageId
    || builderPublicationRollbackRevisionId !== revision.id
  ) return;

  builderPublicationRollbackRevisionId = null;
  builderPublicationRollbackConfirmationId = null;
  if (!result.success) {
    if (result.status === 409 || result.code === 'CONFLICT') {
      await Promise.all([
        loadBuilderPublicationState(pageId, true),
        loadBuilderPublicationHistory(pageId, { force: true, preserveMessages: true })
      ]);
      if (builderPageId === pageId) {
        builderPublicationHistoryError = 'The published version changed elsewhere. Refresh and try again.';
        renderBuilder();
      }
    } else {
      builderPublicationHistoryError = result.status === 404
        ? 'This version is no longer available.'
        : 'We couldn’t restore this version.';
      renderBuilder();
    }
    return;
  }

  builderPublicationTarget = result.data.target;
  builderPublishedRevision = result.data.revision;
  builderPublicationLoadedPageId = pageId;
  builderPublicationStatusLoadFailed = false;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = 'Selected published revision updated. Your current draft was not changed.';
  renderBuilder();
  (window as any).showToast('Published version restored', 'success');
  await loadBuilderPublicationHistory(pageId, { force: true, preserveMessages: true });
};

function getBuilderPublicationPagePath(page: Page): string {
  return getBuilderWebsitePageEntries().find(entry => entry.page.id === page.id)?.path
    || (page.slug === 'home' ? '/' : `/${page.slug}`);
}

function createBuilderRevisionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('Secure revision ID generation is unavailable.');
}

async function flushBuilderAutosaveForPublication(): Promise<boolean> {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = undefined;
  }
  const indicator = document.getElementById('pb-autosave-indicator');
  if (indicator) indicator.textContent = 'Saving…';
  const saved = await (window as any).savePageSections();
  if (indicator) indicator.textContent = saved ? 'Saved' : 'Save failed';
  updateBuilderPublicationStatusBadge();
  return saved === true;
}

function closeBuilderPublishModal(): void {
  if (builderPublishing || builderPublicationRollbackRevisionId) return;
  builderPublishModalOpen = false;
  builderPublicationHistoryOpen = false;
  builderPublicationRollbackConfirmationId = null;
  builderPublicationError = null;
  builderPublicationSuccess = null;
  builderPublicationHistoryError = null;
  builderPublicationRollbackSuccess = null;
  document.body.classList.remove('pb-publish-modal-open');
  renderBuilder();
}

(window as any).openBuilderPublishModal = async () => {
  if (builderMode !== 'edit') return;
  const website = getActiveBuilderWebsite();
  if (editorUsesSupabase() && website?.id) {
    (window as any).openBuilderUnifiedPublishModal(website.id);
    return;
  }
  const pageSettings = builderPageSettingsController?.pageId === builderPageId
    ? builderPageSettingsController
    : null;
  if (pageSettings?.status === 'saving') {
    (window as any).showToast('Wait for Page Settings to finish saving.', 'info');
    return;
  }
  if (pageSettings?.isDirty) {
    const saved = await pageSettings.save();
    if (!saved) {
      builderLeftPanelTab = 'pages';
      builderPagesPanelView = 'settings';
      renderBuilder();
      (window as any).showToast('Save valid Page Settings before publishing.', 'error');
      return;
    }
  }
  getBuilderHistoryController()?.breakCoalescing();
  builderPublishModalOpen = true;
  builderPublicationHistoryOpen = false;
  builderPublicationRollbackConfirmationId = null;
  builderPublicationError = builderPublicationStatusLoadFailed
    ? 'We couldn’t load the publication status.'
    : null;
  builderPublicationSuccess = null;
  document.body.classList.add('pb-publish-modal-open');
  renderBuilder();
  setTimeout(() => document.getElementById('pb-publish-close')?.focus(), 0);
};

(window as any).closeBuilderPublishModal = closeBuilderPublishModal;

window.addEventListener('keydown', event => {
  if (
    event.key === 'Escape'
    && builderPublishModalOpen
    && !builderPublishing
    && !builderPublicationRollbackRevisionId
  ) {
    event.preventDefault();
    closeBuilderPublishModal();
  }
});

window.addEventListener('keydown', event => {
  const controller = builderNewPageController;
  if (!controller || controller.status === 'closed') return;
  if (event.key === 'Escape' && !controller.isCreating) {
    event.preventDefault();
    (window as any).closeBuilderNewPageDialog();
    return;
  }
  if (event.key !== 'Tab') return;
  const dialog = document.querySelector<HTMLElement>('.pb-new-page-dialog');
  const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )) : [];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.addEventListener('keydown', event => {
  const target = event.target instanceof Element ? event.target : null;
  const editableTarget = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.getAttribute('contenteditable') === 'true';
  const history = builderHistoryController?.pageId === builderPageId
    ? builderHistoryController
    : null;

  handleBuilderHistoryKeyboardShortcut(event, {
    isBuilderActive: currentView === 'builder' && builderMode === 'edit',
    publicationModalOpen: builderPublishModalOpen || builderSetupWizardOpen,
    targetIsEditable: editableTarget,
    targetIsBuilderDocumentControl: Boolean(target?.closest('.pb-inspector-panel, .pb-canvas-inner')),
    canUndo: history?.canUndo === true,
    canRedo: history?.canRedo === true
  }, {
    undo: () => applyBuilderHistoryTransition('undo'),
    redo: () => applyBuilderHistoryTransition('redo')
  });
});

(window as any).publishCurrentBuilderPage = async () => {
  if (builderPublishing) return;
  const initialStatus = getBuilderPublicationDisplayStatus();
  if (initialStatus.state === 'published') return;

  const pageId = builderPageId;
  const page = mockPages.find(item => item.id === pageId);
  if (!page) {
    builderPublicationError = 'We couldn’t publish this page.';
    renderBuilder();
    return;
  }
  const website = getBuilderPublicationWebsite(page);
  const actingUserId = actingBuilderPublicationUserId(
    (window as any).currentUser as User | string
  );
  if (!website || !actingUserId) {
    builderPublicationError = 'We couldn’t publish this page.';
    renderBuilder();
    return;
  }

  builderPublishing = true;
  builderPublicationError = null;
  builderPublicationSuccess = null;
  renderBuilder();

  try {
    const saved = await flushBuilderAutosaveForPublication();
    if (!saved) {
      builderPublishing = false;
      builderPublicationError = 'Save the page before publishing.';
      renderBuilder();
      return;
    }

    const builderDocument = getCurrentBuilderDocument(pageId);
    if (!builderDocument) {
      builderPublishing = false;
      builderPublicationError = 'We couldn’t publish this page.';
      renderBuilder();
      return;
    }
    const validationIssues = validateBuilderDocument(builderDocument);
    if (validationIssues.length > 0) {
      builderPublishing = false;
      builderPublicationError = 'This page contains invalid section data.';
      renderBuilder();
      return;
    }

    const createdAt = new Date().toISOString();
    const revision = createBuilderPublishedRevision(builderDocument, {
      id: createBuilderRevisionId(),
      websiteId: website.id,
      createdAt,
      createdBy: actingUserId
    });
    const createResult = await createBuilderPageRevision(
      (input, init) => window.fetch(input, init),
      website.id,
      pageId,
      revision
    );
    if (!createResult.success) {
      builderPublishing = false;
      builderPublicationError = 'We couldn’t publish this page.';
      renderBuilder();
      return;
    }

    const publishResult = await publishBuilderPageRevision(
      (input, init) => window.fetch(input, init),
      website.id,
      pageId,
      {
        revisionId: createResult.data.id,
        publishedAt: new Date().toISOString(),
        expectedPublishedRevisionId: builderPublicationTarget?.publishedRevisionId ?? null
      }
    );
    if (!publishResult.success) {
      builderPublishing = false;
      if (publishResult.status === 409 || publishResult.code === 'CONFLICT') {
        builderPublicationError = 'This page was published elsewhere. Refresh the status and try again.';
        await loadBuilderPublicationState(pageId, true);
      } else {
        builderPublicationError = 'We couldn’t publish this page.';
        renderBuilder();
      }
      return;
    }

    if (builderPageId !== pageId) {
      builderPublishing = false;
      return;
    }
    builderPublicationTarget = publishResult.data.target;
    builderPublishedRevision = publishResult.data.revision;
    builderPublicationLoadedPageId = pageId;
    builderPublicationStatusLoadFailed = false;
    builderPublishing = false;
    builderPublicationError = null;
    builderPublicationSuccess = 'Page published successfully.';
    resetBuilderPublicationHistory();
    renderBuilder();
    (window as any).showToast('Page published', 'success');
    void loadBuilderPublicationState(pageId, true);
  } catch {
    builderPublishing = false;
    builderPublicationError = 'We couldn’t publish this page.';
    renderBuilder();
  }
};

function formatBuilderRevisionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function renderBuilderVersionHistoryContent(page: Page): string {
  const confirmation = builderPublicationRollbackConfirmationId
    ? builderPublicationHistoryItems.find(
      revision => revision.id === builderPublicationRollbackConfirmationId
    )
    : undefined;

  if (confirmation) {
    const confirmationPageName = confirmation.document.page.name || page.name || 'Untitled page';
    const isRestoring = builderPublicationRollbackRevisionId === confirmation.id;
    return `
      <div class="pb-history-confirmation" aria-labelledby="pb-history-confirmation-title">
        <span>Confirm restore</span>
        <h3 id="pb-history-confirmation-title">Restore this published version?</h3>
        <dl>
          <div><dt>Version date</dt><dd>${escapeBuilderInspectorHtml(formatBuilderRevisionDate(confirmation.createdAt))}</dd></div>
          <div><dt>Page</dt><dd>${escapeBuilderInspectorHtml(confirmationPageName)}</dd></div>
          <div><dt>Sections</dt><dd>${confirmation.document.sections.length}</dd></div>
        </dl>
        <p>The selected published revision will change. Your current draft page and sections will not be changed.</p>
        ${builderPublicationHistoryError ? `<div class="pb-history-error" role="alert" aria-live="assertive">${escapeBuilderInspectorHtml(builderPublicationHistoryError)}</div>` : ''}
        <div class="pb-history-confirmation-actions">
          <button type="button" class="pb-history-secondary" onclick="window.cancelBuilderPublicationRollback()" ${isRestoring ? 'disabled' : ''}>Cancel</button>
          <button type="button" class="pb-history-restore-confirm" onclick="window.restoreBuilderPublishedRevision()" ${isRestoring ? 'disabled' : ''}>${isRestoring ? 'Restoring…' : 'Restore published version'}</button>
        </div>
      </div>
    `;
  }

  const revisionCards = builderPublicationHistoryItems.map(revision => {
    const isCurrent = revision.id === builderPublicationTarget?.publishedRevisionId;
    const displayedDate = isCurrent && builderPublicationTarget
      ? builderPublicationTarget.publishedAt
      : revision.createdAt;
    const pageName = revision.document.page.name || 'Untitled page';
    return `
      <article class="pb-history-revision ${isCurrent ? 'current' : ''}">
        <div class="pb-history-revision-heading">
          <div>
            <span>${isCurrent ? 'Published' : 'Version created'}</span>
            <strong>${escapeBuilderInspectorHtml(formatBuilderRevisionDate(displayedDate))}</strong>
          </div>
          <span class="pb-history-version-label ${isCurrent ? 'current' : 'unpublished'}">${isCurrent ? 'Current version' : 'Unpublished revision'}</span>
        </div>
        <div class="pb-history-revision-meta">
          <span>${escapeBuilderInspectorHtml(pageName)}</span>
          <span>${revision.document.sections.length} ${revision.document.sections.length === 1 ? 'section' : 'sections'}</span>
          ${revision.createdBy ? `<span>Creator ${escapeBuilderInspectorHtml(revision.createdBy)}</span>` : ''}
        </div>
        <code>${escapeBuilderInspectorHtml(revision.id)}</code>
        ${isCurrent ? '' : `<button type="button" class="pb-history-restore" aria-label="Restore revision ${escapeBuilderInspectorHtml(revision.id)}" onclick='window.confirmBuilderPublicationRollback(${builderInspectorJsArgument(revision.id)})'>Restore this version</button>`}
      </article>
    `;
  }).join('');

  return `
    <div class="pb-history-intro">
      <strong>${escapeBuilderInspectorHtml(page.name || 'Untitled page')}</strong>
      <p>Selecting a version changes the publication target. It does not change the current draft or the legacy public-site renderer.</p>
    </div>
    ${builderPublicationHistoryError ? `<div class="pb-history-error" role="alert" aria-live="assertive">${escapeBuilderInspectorHtml(builderPublicationHistoryError)}</div>` : ''}
    ${builderPublicationRollbackSuccess ? `<div class="pb-history-success" role="status" aria-live="polite">${escapeBuilderInspectorHtml(builderPublicationRollbackSuccess)}</div>` : ''}
    ${builderPublicationHistoryLoading ? '<div class="pb-history-loading" role="status" aria-live="polite">Loading version history…</div>' : ''}
    ${!builderPublicationHistoryLoading && builderPublicationHistoryItems.length === 0 ? '<div class="pb-history-empty">No published versions yet.</div>' : ''}
    ${revisionCards ? `<div class="pb-history-list">${revisionCards}</div>` : ''}
    ${builderPublicationHistoryNextCursor ? `<button type="button" class="pb-history-load-more" onclick="window.loadMoreBuilderPublicationHistory()" ${builderPublicationHistoryLoadingMore ? 'disabled' : ''}>${builderPublicationHistoryLoadingMore ? 'Loading…' : 'Load more'}</button>` : ''}
  `;
}

function renderBuilderPublishModal(
  page: Page,
  sections: readonly PageSection[],
  status: BuilderPublicationDisplayStatus
): string {
  if (!builderPublishModalOpen || builderMode !== 'edit') return '';
  const pageName = escapeBuilderInspectorHtml(page.name || 'Untitled page');
  const pagePath = escapeBuilderInspectorHtml(getBuilderPublicationPagePath(page));
  const lastPublished = builderPublicationTarget?.publishedAt
    ? new Date(builderPublicationTarget.publishedAt).toLocaleString()
    : null;
  const alreadyPublished = status.state === 'published';
  const primaryDisabled = builderPublishing
    || alreadyPublished
    || status.state === 'checking'
    || status.state === 'unavailable';
  const busy = builderPublishing || builderPublicationRollbackRevisionId !== null;

  return `
    <div class="pb-publish-overlay" role="presentation">
      <section class="pb-publish-modal ${builderPublicationHistoryOpen ? 'history' : ''}" role="dialog" aria-modal="true" aria-labelledby="pb-publish-title">
        <header class="pb-publish-modal-header">
          ${builderPublicationHistoryOpen ? `
          <div class="pb-history-header-title">
            <button type="button" class="pb-history-back" aria-label="Back to Publish page" onclick="window.closeBuilderVersionHistory()" ${busy ? 'disabled' : ''}>←</button>
            <div><span>Website publication</span><h2 id="pb-publish-title">Version history</h2></div>
          </div>
          ` : `
          <div><span>Website publication</span><h2 id="pb-publish-title">Publish page</h2></div>
          `}
          <button id="pb-publish-close" type="button" class="pb-publish-close" aria-label="Close publish dialog" onclick="window.closeBuilderPublishModal()" ${busy ? 'disabled' : ''}>×</button>
        </header>
        ${builderPublicationHistoryOpen ? `
        <div class="pb-publish-modal-body pb-history-body">${renderBuilderVersionHistoryContent(page)}</div>
        <footer class="pb-publish-modal-actions">
          <button type="button" class="pb-publish-cancel" onclick="window.closeBuilderPublishModal()" ${busy ? 'disabled' : ''}>Close</button>
        </footer>
        ` : `
        <div class="pb-publish-modal-body">
          <div class="pb-publish-page-summary">
            <div><strong>${pageName}</strong><code>${pagePath}</code></div>
            <span class="pb-publication-status ${status.className}">${status.label}</span>
          </div>
          <div class="pb-publish-summary-grid">
            <div><span>Sections</span><strong>${sections.length}</strong></div>
            <div><span>Current version</span><strong>${status.label}</strong></div>
          </div>
          <p class="pb-publish-explanation">Publishing saves the current page and its sections as an immutable website version.</p>
          ${lastPublished ? `<div class="pb-publish-metadata"><span>Last published</span><strong>${escapeBuilderInspectorHtml(lastPublished)}</strong>${builderPublicationTarget ? `<code>${escapeBuilderInspectorHtml(builderPublicationTarget.publishedRevisionId)}</code>` : ''}</div>` : ''}
          ${alreadyPublished && !builderPublicationSuccess ? '<div class="pb-publish-success">This page is already published.</div>' : ''}
          ${builderPublicationError ? `<div class="pb-publish-error" role="alert">${escapeBuilderInspectorHtml(builderPublicationError)}</div>` : ''}
          ${builderPublicationSuccess ? `<div class="pb-publish-success" role="status">${escapeBuilderInspectorHtml(builderPublicationSuccess)}</div>` : ''}
          ${builderPublishing ? '<div class="pb-publish-loading" role="status">Saving and publishing this page…</div>' : ''}
        </div>
        <footer class="pb-publish-modal-actions pb-publish-modal-actions-split">
          <button type="button" class="pb-history-entry" onclick="window.openBuilderVersionHistory()" ${builderPublishing ? 'disabled' : ''}>Version history</button>
          <div>
            <button type="button" class="pb-publish-cancel" onclick="window.closeBuilderPublishModal()" ${builderPublishing ? 'disabled' : ''}>${alreadyPublished || builderPublicationSuccess ? 'Close' : 'Cancel'}</button>
            ${alreadyPublished || builderPublicationSuccess ? '' : `<button type="button" class="pb-publish-confirm" onclick="window.publishCurrentBuilderPage()" ${primaryDisabled ? 'disabled' : ''}>${builderPublishing ? 'Publishing…' : 'Publish page'}</button>`}
          </div>
        </footer>
        `}
      </section>
    </div>
  `;
}

// WB.3.5 — Auto-save: debounced 600ms, then persists via API
(window as any).triggerAutoSave = () => {
  builderSaveState.markDirty();
  renderBuilderAutosaveIndicator();

  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    autoSaveTimeout = undefined;
    // Persist to Supabase via internal API
    try {
      await (window as any).savePageSections();
    } catch {
      console.warn(`[AutoSave] SECTION_SAVE_FAILED code=NETWORK_FAILURE status=0 pageId=${builderPageId} requestId=client`);
    }
    const page = mockPages.find((p: any) => p.id === builderPageId);
    if (page) (page as any).updated_at = new Date().toISOString();
    renderBuilderAutosaveIndicator();
    updateBuilderPublicationStatusBadge();
  }, 600); // 600ms debounce — within the 300–800ms WB.3.5 spec
};


// Builder Rendering Logic

let builderMode: 'edit' | 'preview' = 'edit';

// WB.3.4 — Viewport toggle handler
(window as any).setBuilderViewport = (viewport: unknown) => {
  if (viewport !== 'desktop' && viewport !== 'tablet' && viewport !== 'mobile') return;
  if (builderViewport === viewport) return;

  const currentCanvas = document.querySelector<HTMLElement>('.pb-canvas-area');
  const scrollLeft = currentCanvas?.scrollLeft ?? 0;
  const scrollTop = currentCanvas?.scrollTop ?? 0;

  builderViewport = viewport;
  getBuilderHistoryController()?.setViewport(viewport);
  renderBuilder();

  setTimeout(() => {
    const nextCanvas = document.querySelector<HTMLElement>('.pb-canvas-area');
    if (!nextCanvas) return;
    nextCanvas.scrollLeft = scrollLeft;
    nextCanvas.scrollTop = scrollTop;
  }, 80);
};

(window as any).setBuilderMode = (mode: 'edit' | 'preview') => {
  builderMode = mode;
  getBuilderHistoryController()?.breakCoalescing();
  renderBuilder();
  const storedPage = getBuilderHistoryController()?.document.page
    ?? mockPages.find(item => item.id === builderPageId);
  const settingsController = builderPageSettingsController?.pageId === storedPage?.id
    ? builderPageSettingsController
    : null;
  const page = storedPage && settingsController && settingsController.issues.length === 0
    ? applyBuilderPageSettings(storedPage, settingsController.draft)
    : storedPage;
  if (mode === 'preview' && page) {
    document.title = page.seo_title || page.name;
    updateMetaTag('description', page.seo_description || '');
  } else {
    document.title = 'Hansveer CRM';
    updateMetaTag('description', 'Professional CRM for Handyman Businesses');
  }
};

(window as any).undoBuilder = () => applyBuilderHistoryTransition('undo');
(window as any).redoBuilder = () => applyBuilderHistoryTransition('redo');

function renderBuilder() {
  builderViewTransitions.render(document as any, _renderBuilder);
}

const hydratedBuilderSectionPageIds = new Set<string>();

function hydrateBuilderSectionsFromLocalStorage(pageId: string): void {
  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : false;
  if (!isBrowser || hasSupabase || hydratedBuilderSectionPageIds.has(pageId)) return;
  hydratedBuilderSectionPageIds.add(pageId);

  const userId = getActingUserId();
  const storageKey = `mock_sections_${userId}:${pageId}`;
  const cached = window.localStorage.getItem(storageKey);
  if (!cached) return;

  try {
    const sections = JSON.parse(cached);
    if (!Array.isArray(sections)) throw new Error('Cached sections is not an array');
    for (const section of sections) {
      const idx = mockPageSections.findIndex((s: any) => s.id === section.id);
      if (idx >= 0) {
        mockPageSections[idx] = section;
      } else {
        mockPageSections.push(section);
      }
    }
  } catch (err) {
    console.error('[Builder] Failed to hydrate cached sections; clearing corrupted cache:', err);
    window.localStorage.removeItem(storageKey);
  }
}

function getBuilderContextStorageKey(): string {
  const userId = getActingUserId();
  return `mock_builder_context_${userId}`;
}

function getPrimarySectionForPage(pageId: string): any | null {
  return mockPageSections
    .filter((section: any) => section.page_id === pageId)
    .sort((a: any, b: any) => a.order - b.order)[0] || null;
}

function getBuilderContextFromHash(): BuilderContext | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const hashContent = hash.startsWith('#/')
    ? hash.slice(2)
    : hash.replace(/^#/, '');
  const [view, query = ''] = hashContent.split('?');
  if (view !== 'builder' || !query) return null;

  const params = new URLSearchParams(query);
  const pageId = params.get('pageId');
  if (!pageId) return null;

  const typedTarget = parseBuilderNavigationTarget(hash);

  return {
    websiteId: typedTarget.status === 'valid' ? typedTarget.target.websiteId : params.get('websiteId') || undefined,
    pageId,
    action: typedTarget.status === 'valid' ? typedTarget.target.action : undefined,
    sectionId: params.get('sectionId'),
    path: params.get('path') || undefined,
    label: params.get('label') || undefined,
    returnTo: params.get('returnTo') || undefined,
    funnelId: params.get('funnelId')
  };
}

function getStoredBuilderContext(): BuilderContext | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getBuilderContextStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.pageId ? parsed : null;
  } catch (err) {
    console.warn('[Builder] Failed to parse stored builder context; clearing it:', err);
    window.localStorage.removeItem(getBuilderContextStorageKey());
    return null;
  }
}

function persistBuilderContext(context: BuilderContext): void {
  if (typeof window === 'undefined' || !window.localStorage || !context.pageId) return;

  const page = mockPages.find((p: any) => p.id === context.pageId);
  const section = context.sectionId
    ? mockPageSections.find((s: any) => s.id === context.sectionId)
    : getPrimarySectionForPage(context.pageId);

  const storedContext: BuilderContext = {
    websiteId: context.websiteId ?? activeBuilderWebsiteId ?? undefined,
    pageId: context.pageId,
    sectionId: context.sectionId ?? section?.id ?? null,
    path: context.path ?? (page?.slug ? `/${page.slug === 'home' ? '' : page.slug}` : undefined),
    label: context.label ?? page?.name ?? section?.content?.heading,
    returnTo: context.returnTo ?? builderReturnTo,
    funnelId: context.funnelId ?? builderReturnFunnelId,
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(getBuilderContextStorageKey(), JSON.stringify(storedContext));
}

function applyBuilderContext(context: BuilderContext | null): boolean {
  if (!context?.pageId) return false;

  if (context.websiteId) activeBuilderWebsiteId = context.websiteId;

  const pageChanged = builderPageId !== context.pageId;
  if (pageChanged) builderHistoryController = null;
  builderPageId = context.pageId;
  builderReturnTo = context.returnTo || builderReturnTo;
  builderReturnFunnelId = context.funnelId || builderReturnFunnelId;

  const sectionExists = context.sectionId
    ? mockPageSections.some((section: any) => section.id === context.sectionId && section.page_id === context.pageId)
    : false;
  if (context.sectionId !== undefined && context.sectionId !== null) {
    builderSelectedSectionId = sectionExists ? context.sectionId : null;
  } else if (pageChanged) {
    builderSelectedSectionId = null;
  }
  builderInsertOrder = null;

  return mockPages.some((page: any) => page.id === context.pageId);
}

function hydrateBuilderContext(): void {
  const context = getBuilderContextFromHash() || getStoredBuilderContext();
  if (context) applyBuilderContext(context);
}

function escapeBuilderInspectorHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function builderInspectorJsArgument(value: string): string {
  return JSON.stringify(value)
    .replace(/'/g, '\\u0027')
    .replace(/</g, '\\u003c');
}

function renderBuilderInspectorControl(
  section: PageSection,
  field: BuilderInspectorFieldDefinition
): string {
  const value = getBuilderInspectorFieldValue(section, field);
  const stringValue = value === undefined || value === null ? '' : String(value);
  const safeValue = escapeBuilderInspectorHtml(stringValue);
  const sectionArg = builderInspectorJsArgument(section.id);
  const fieldArg = builderInspectorJsArgument(field.id);
  const commit = `window.updateBuilderInspectorField(${sectionArg}, ${fieldArg}, this.value)`;

  switch (field.control) {
    case 'text':
      return `<input class="pb-inspector-input" type="text" value="${safeValue}" placeholder="${escapeBuilderInspectorHtml(field.placeholder ?? '')}" onblur='${commit}'>`;
    case 'textarea':
      return `<textarea class="pb-inspector-textarea" placeholder="${escapeBuilderInspectorHtml(field.placeholder ?? '')}" onblur='${commit}'>${safeValue}</textarea>`;
    case 'select':
      return `
        <select class="pb-inspector-select" onchange='${commit}'>
          ${(field.options ?? []).map(option => `
            <option value="${escapeBuilderInspectorHtml(option.value)}" ${String(value ?? '') === option.value ? 'selected' : ''}>${escapeBuilderInspectorHtml(option.label)}</option>
          `).join('')}
        </select>
      `;
    case 'toggle':
      const isChecked = field.id === 'visibility' ? value !== false : value === true;
      return `
        <label class="pb-inspector-toggle">
          <input type="checkbox" ${isChecked ? 'checked' : ''} aria-label="${escapeBuilderInspectorHtml(field.label)}" onchange='window.updateBuilderInspectorField(${sectionArg}, ${fieldArg}, this.checked)'>
          <span class="pb-inspector-toggle-track"><span class="pb-inspector-toggle-thumb"></span></span>
          <span class="pb-inspector-toggle-value">${isChecked ? 'On' : 'Off'}</span>
        </label>
      `;
    case 'number':
      return `<input class="pb-inspector-input" type="number" value="${safeValue}" ${field.min === undefined ? '' : `min="${field.min}"`} ${field.max === undefined ? '' : `max="${field.max}"`} ${field.step === undefined ? '' : `step="${field.step}"`} onblur='${commit}'>`;
    case 'color': {
      const canUseColorInput = /^#[0-9a-fA-F]{6}$/.test(stringValue);
      return `
        <div class="pb-inspector-color-control">
          ${canUseColorInput ? `<input class="pb-inspector-color-swatch" type="color" value="${safeValue}" aria-label="${escapeBuilderInspectorHtml(field.label)} colour" onchange='${commit}'>` : ''}
          <input class="pb-inspector-input" type="text" value="${safeValue}" placeholder="#000000 or CSS value" onblur='${commit}'>
        </div>
      `;
    }
    case 'image':
      return `
        <div class="pb-inspector-image-control">
          <input class="pb-inspector-input" type="text" value="${safeValue}" placeholder="Image URL" onblur='${commit}'>
          <button class="pb-inspector-secondary-btn" type="button" onclick='window.openImagePicker(${sectionArg}, ${builderInspectorJsArgument(field.path.join('.'))})'>Choose from assets</button>
          ${stringValue ? `<img class="pb-inspector-image-preview" src="${safeValue}" alt="">` : ''}
        </div>
      `;
    case 'collection': {
      const itemCount = Array.isArray(value) ? value.length : 0;
      return `
        <div class="pb-inspector-collection">
          <strong>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</strong>
          <span>Edit these items using the existing controls on the page.</span>
        </div>
      `;
    }
    default:
      return '';
  }
}

function renderBuilderInspectorPanel(sections: PageSection[]): string {
  const section = builderSelectedSectionId
    ? sections.find(item => item.id === builderSelectedSectionId)
    : undefined;

  if (!section) {
    return `
      <aside class="pb-inspector-panel">
        <div class="pb-inspector-empty">
          <h3>Select a section</h3>
          <p>Choose a section on the page to edit its content and design.</p>
        </div>
      </aside>
    `;
  }

  const schema = getBuilderInspectorSchema(section.type);
  const registryDefinition = getBuilderSectionDefinition(section.type);
  if (!schema || !registryDefinition) {
    return `
      <aside class="pb-inspector-panel">
        <div class="pb-inspector-empty">
          <h3>Legacy section</h3>
          <p>This section is preserved losslessly and is read-only in the current Builder.</p>
        </div>
      </aside>
    `;
  }

  const availableTabs = Array.from(
    new Set(schema.groups.map(group => group.tab))
  );
  const activeTab = availableTabs.includes(builderInspectorTab)
    ? builderInspectorTab
    : availableTabs[0];
  const groups = schema.groups.filter(group => group.tab === activeTab);

  return `
    <aside class="pb-inspector-panel">
      <div class="pb-inspector-header">
        <span class="pb-inspector-eyebrow">Properties</span>
        <h3>${escapeBuilderInspectorHtml(registryDefinition.label)}</h3>
        <div class="pb-inspector-meta">
          <span>${escapeBuilderInspectorHtml(section.type)}</span>
          <span>${escapeBuilderInspectorHtml(section.variant ?? registryDefinition.defaultVariant ?? 'default')}</span>
        </div>
      </div>
      <div class="pb-inspector-tabs" role="tablist" aria-label="Section properties">
        ${availableTabs.map(tab => `
          <button type="button" role="tab" aria-selected="${tab === activeTab}" class="pb-inspector-tab ${tab === activeTab ? 'active' : ''}" onclick="window.setBuilderInspectorTab('${tab}')">${escapeBuilderInspectorHtml(tab === 'content' ? 'Content' : 'Design')}</button>
        `).join('')}
      </div>
      <div class="pb-inspector-scroll">
        ${groups.map(group => `
          <section class="pb-inspector-group">
            <div class="pb-inspector-group-header">
              <h4>${escapeBuilderInspectorHtml(group.label)}</h4>
              ${group.description ? `<p>${escapeBuilderInspectorHtml(group.description)}</p>` : ''}
            </div>
            ${group.fields.map(field => `
              <div class="pb-inspector-field">
                <label>${escapeBuilderInspectorHtml(field.label)}</label>
                ${field.description ? `<p>${escapeBuilderInspectorHtml(field.description)}</p>` : ''}
                ${renderBuilderInspectorControl(section, field)}
              </div>
            `).join('')}
          </section>
        `).join('')}
      </div>
    </aside>
  `;
}

(window as any).setBuilderLeftPanelTab = (tab: BuilderMediaLeftPanelTab) => {
  if (builderLeftPanelTab === tab) return;
  builderLeftPanelTab = tab;
  if (tab === 'assets') void ensureBuilderMediaController();
  if (tab === 'navigation') {
    const manager = getBuilderSiteNavigationManager();
    const website = getActiveBuilderWebsite();
    if (website?.id && builderSiteNavigationController) {
      const context = getNavUiContext();
      if (context) {
        void builderSiteNavigationController.hydrate(website.id, {
          effectiveRoutes: context.effectiveRoutes,
          homepageFunnelId: website.homepage_funnel_id
        }, manager.getActiveScope());
      }
    }
  }
  renderBuilder();
};

async function ensureBuilderMediaController(): Promise<BuilderMediaController | null> {
  const website = getActiveBuilderWebsite();
  const userId = typeof (window as any).currentUser === 'string'
    ? (window as any).currentUser.trim()
    : '';
  if (!website || !userId) {
    builderMediaInitializationError = 'A website and signed-in user are required.';
    return null;
  }
  const identity = `${userId}:${website.id}`;
  if (builderMediaController && builderMediaControllerIdentity === identity) return builderMediaController;
  if (builderMediaInitializing) return null;

  builderMediaInitializing = true;
  builderMediaInitializationError = null;
  try {
    builderMediaController?.dispose();
    const runtime = await createBuilderMediaRuntime({
      configuredMode: builderPublicationEnvironment.VITE_BUILDER_MEDIA_PERSISTENCE,
      production: builderPublicationProduction,
      userId,
      supabaseConfigured: builderPublicationSupabaseConfigured,
      getLocalDatabase: () => new IndexedDbBuilderMediaDatabase(),
      getSupabaseClient: getBuilderPublicationSupabaseClient,
      createLocalRepository: (database, actingUserId) => new LocalBuilderMediaRepository({
        database,
        userId: actingUserId
      }),
      createSupabaseRepository: client => new SupabaseBuilderMediaRepository({ client })
    });
    if (!runtime.success) {
      builderMediaInitializationError = runtime.message;
      return null;
    }
    builderMediaController = new BuilderMediaController(runtime.repository, website.id);
    builderMediaControllerIdentity = identity;
    builderMediaController.onChange = () => {
      if (currentView === 'builder' && builderLeftPanelTab === 'assets') renderBuilder();
    };
    await builderMediaController.load();
    return builderMediaController;
  } catch (error) {
    builderMediaInitializationError = error instanceof Error ? error.message : 'Media library unavailable.';
    return null;
  } finally {
    builderMediaInitializing = false;
    if (currentView === 'builder' && builderLeftPanelTab === 'assets') renderBuilder();
  }
}

function builderMediaAssetSize(asset: BuilderMediaAsset): string {
  return asset.sizeBytes >= 1024 * 1024
    ? `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(Math.round(asset.sizeBytes / 1024), 1)} KB`;
}

function renderBuilderAssetsPanel(sections: PageSection[]): string {
  const state = builderMediaController?.state;
  const selectedSection = sections.find(section => section.id === builderSelectedSectionId);
  if (builderMediaInitializing || (!state && !builderMediaInitializationError)) {
    void ensureBuilderMediaController();
    return '<div class="pb-assets-status">Loading media library…</div>';
  }
  if (builderMediaInitializationError) {
    return `<div class="pb-assets-status error"><strong>Media unavailable</strong><span>${escapeBuilderInspectorHtml(builderMediaInitializationError)}</span><button type="button" onclick="window.retryBuilderMedia()">Retry</button></div>`;
  }
  if (!state) return '<div class="pb-assets-status error">Media library unavailable.</div>';

  const picker = state.pickerTarget;
  const canAddGallery = selectedSection?.type === 'gallery' && builderMediaSelectedAssetIds.size > 0;
  return `
    <div class="pb-assets-panel">
      <div class="pb-assets-heading">
        <div><span>${picker ? 'Choose image' : 'Assets'}</span><strong>${state.assets.length}</strong></div>
        ${picker ? '<button type="button" onclick="window.closeBuilderMediaPicker()">Cancel</button>' : ''}
      </div>
      <div class="pb-assets-actions">
        <label class="pb-assets-upload ${state.uploading > 0 ? 'disabled' : ''}">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="window.uploadBuilderMedia(this)" ${state.uploading > 0 ? 'disabled' : ''}>
          ${state.uploading > 0 ? `Uploading ${state.uploading}…` : 'Upload images'}
        </label>
        <input type="search" value="${escapeBuilderInspectorHtml(state.search)}" placeholder="Search assets" aria-label="Search assets" oninput="window.searchBuilderMedia(this.value)">
      </div>
      ${state.error ? `<div class="pb-assets-error">${escapeBuilderInspectorHtml(state.error)} <button type="button" onclick="window.reloadBuilderMedia()">Retry</button></div>` : ''}
      ${state.assets.length === 0 && state.status !== 'loading' ? `
        <div class="pb-assets-empty"><strong>No images yet</strong><span>Upload JPEG, PNG, or WebP images up to 8 MB.</span></div>
      ` : `
        <div class="pb-assets-grid">
          ${state.assets.map(asset => {
            const selected = builderMediaSelectedAssetIds.has(asset.id);
            return `<button type="button" class="pb-asset-card ${selected ? 'selected' : ''}" onclick="window.chooseBuilderMediaAsset('${escapeBuilderInspectorHtml(asset.id)}')" title="${escapeBuilderInspectorHtml(asset.displayName)}">
              <img src="${escapeBuilderInspectorHtml(asset.publicUrl)}" alt="">
              <span>${escapeBuilderInspectorHtml(asset.displayName)}</span>
              <small>${asset.width}×${asset.height} · ${builderMediaAssetSize(asset)}</small>
            </button>`;
          }).join('')}
        </div>
      `}
      ${state.nextCursor ? '<button type="button" class="pb-assets-more" onclick="window.loadMoreBuilderMedia()">Load more</button>' : ''}
      ${!picker && selectedSection?.type === 'gallery' ? `
        <button type="button" class="pb-assets-gallery-add" onclick="window.addSelectedAssetsToGallery()" ${canAddGallery ? '' : 'disabled'}>Add selected to gallery</button>
      ` : ''}
    </div>
  `;
}

(window as any).retryBuilderMedia = () => {
  builderMediaInitializationError = null;
  builderMediaControllerIdentity = '';
  void ensureBuilderMediaController();
  renderBuilder();
};
(window as any).reloadBuilderMedia = () => void builderMediaController?.load();
(window as any).loadMoreBuilderMedia = () => void builderMediaController?.load({ append: true });
(window as any).searchBuilderMedia = (value: string) => builderMediaController?.setSearch(value);
(window as any).closeBuilderMediaPicker = () => {
  builderMediaController?.closePicker();
  builderMediaSelectedAssetIds.clear();
  renderBuilder();
};
(window as any).uploadBuilderMedia = async (input: HTMLInputElement) => {
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length) return;
  const controller = await ensureBuilderMediaController();
  if (!controller) return;
  const outcomes = await controller.upload(files);
  const failures = outcomes.filter(outcome => outcome.error);
  if (failures.length) {
    (window as any).showToast?.(`${outcomes.length - failures.length} uploaded; ${failures.length} failed.`, 'error');
  } else {
    (window as any).showToast?.(`${outcomes.length} image${outcomes.length === 1 ? '' : 's'} uploaded.`, 'success');
  }
};
(window as any).chooseBuilderMediaAsset = (assetId: string) => {
  const controller = builderMediaController;
  const asset = controller?.state.assets.find(item => item.id === assetId);
  if (!controller || !asset) return;
  const target = controller.state.pickerTarget;
  if (!target) {
    if (builderMediaSelectedAssetIds.has(assetId)) builderMediaSelectedAssetIds.delete(assetId);
    else builderMediaSelectedAssetIds.add(assetId);
    renderBuilder();
    return;
  }
  if (target.pageId !== builderPageId) {
    controller.closePicker();
    (window as any).showToast?.('The image target is no longer available.', 'error');
    renderBuilder();
    return;
  }
  const targetExists = getBuilderHistoryController()?.document.sections.some(
    section => section.id === target.sectionId
  ) === true;
  if (!targetExists) {
    controller.closePicker();
    (window as any).showToast?.('The image target is no longer available.', 'error');
    renderBuilder();
    return;
  }
  const changed = applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(section => {
      if (section.id !== target.sectionId) return section;
      const content = structuredClone(section.content);
      setNestedValue(content, target.field, asset.publicUrl);
      return { ...section, content };
    })
  }), {
    category: 'content', sectionId: target.sectionId, fieldId: target.field,
    coalesce: false, selectSectionId: target.sectionId
  });
  if (changed) controller.closePicker();
};
(window as any).addSelectedAssetsToGallery = () => {
  const assets = builderMediaController?.state.assets.filter(asset => builderMediaSelectedAssetIds.has(asset.id)) ?? [];
  const sectionId = builderSelectedSectionId;
  if (!sectionId || !assets.length) return;
  const changed = applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(section => section.id === sectionId && section.type === 'gallery'
      ? {
          ...section,
          content: {
            ...section.content,
            items: [
              ...(Array.isArray(section.content.items) ? section.content.items : []),
              ...assets.map(asset => ({ id: crypto.randomUUID(), before: asset.publicUrl, after: asset.publicUrl }))
            ]
          }
        }
      : section)
  }), {
    category: 'structural', sectionId, fieldId: 'gallery-items', coalesce: false, selectSectionId: sectionId
  });
  if (changed) builderMediaSelectedAssetIds.clear();
};

function renderBuilderLayersPanel(sections: PageSection[]): string {
  const orderedSections = sections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.section.order) ? left.section.order : Number.POSITIVE_INFINITY;
      const rightOrder = Number.isFinite(right.section.order) ? right.section.order : Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder || left.originalIndex - right.originalIndex;
    })
    .map(item => item.section);

  if (orderedSections.length === 0) {
    return `
      <div class="pb-layers-empty">
        <h4>No sections yet</h4>
        <p>Use the Add tab to add the first section.</p>
        <button type="button" onclick="window.setBuilderLeftPanelTab('add')">Go to Add</button>
      </div>
    `;
  }

  return `
    <div class="pb-layers-panel">
      <div class="pb-layers-heading">
        <div>
          <span>Page sections</span>
          <strong>${orderedSections.length}</strong>
        </div>
      </div>
      <div class="pb-layer-list">
        ${orderedSections.map((section, index) => {
          const definition = getBuilderSectionDefinition(section.type);
          const component = definition
            ? undefined
            : mockComponents.find(item => item.type === section.type);
          const label = definition?.label || component?.name || 'Custom section';
          const safeLabel = escapeBuilderInspectorHtml(label);
          const accessibleSectionLabel = /section$/i.test(label) ? label : `${label} section`;
          const safeAccessibleSectionLabel = escapeBuilderInspectorHtml(accessibleSectionLabel);
          const safeType = escapeBuilderInspectorHtml(section.type);
          const safeVariant = escapeBuilderInspectorHtml(section.variant ?? '');
          const sectionArg = builderInspectorJsArgument(section.id);
          const isSelected = builderSelectedSectionId === section.id;
          const isHidden = section.styles?.visible === false;

          return `
            <article class="pb-layer-row ${isSelected ? 'active' : ''} ${isHidden ? 'hidden' : ''}">
              <button
                type="button"
                class="pb-layer-main"
                data-builder-section-id="${escapeBuilderInspectorHtml(section.id)}"
                onclick='window.selectSectionForBuilder(${sectionArg}, true)'
                ${isSelected ? 'aria-current="true"' : ''}
                aria-label="Select ${safeAccessibleSectionLabel}"
              >
                <span class="pb-layer-title">${safeLabel}</span>
                <span class="pb-layer-meta">
                  <span>${safeType}</span>
                  ${section.variant ? `<span class="pb-layer-variant">${safeVariant}</span>` : ''}
                  <span class="pb-layer-visibility">${isHidden ? 'Hidden' : 'Visible'}</span>
                </span>
              </button>
              <div class="pb-layer-actions" aria-label="${safeAccessibleSectionLabel} actions">
                <button type="button" aria-label="Move ${safeLabel} up" title="Move up" onclick='event.stopPropagation(); window.moveSection(${sectionArg}, -1)' ${index === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" aria-label="Move ${safeLabel} down" title="Move down" onclick='event.stopPropagation(); window.moveSection(${sectionArg}, 1)' ${index === orderedSections.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" aria-label="${isHidden ? 'Show' : 'Hide'} ${safeLabel}" title="${isHidden ? 'Show section' : 'Hide section'}" onclick='event.stopPropagation(); window.toggleSectionVisibility(${sectionArg})'>${isHidden ? 'Show' : 'Hide'}</button>
                <button type="button" aria-label="Duplicate ${safeLabel}" title="Duplicate section" onclick='event.stopPropagation(); window.duplicateBuilderSection(${sectionArg})'>Duplicate</button>
                <button type="button" class="pb-layer-delete" aria-label="Delete ${safeLabel}" title="Delete section" onclick='event.stopPropagation(); window.removeSection(${sectionArg})'>Delete</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

type BuilderWebsitePageEntry = {
  page: Page;
  path: string;
  isHomepage: boolean;
  isLiveHomepage?: boolean;
  isDraftHomepage?: boolean;
  routeOrder?: number;
  stepOrder?: number;
  originalIndex: number;
};

function getActiveBuilderWebsite(): Website | undefined {
  const userId = getActingUserId();
  if (activeBuilderWebsiteId) {
    return mockWebsites.find(website => website.id === activeBuilderWebsiteId && website.user_id === userId);
  }
  const owned = mockWebsites.filter(website => website.user_id === userId);
  return owned.length === 1 ? owned[0] : undefined;
}

function getActiveSettingsWebsite(): Website | undefined {
  const userId = getActingUserId();
  const explicitWebsiteId = currentView === 'website-settings'
    ? activeSettingsWebsiteId
    : currentView === 'builder'
      ? activeBuilderWebsiteId
      : activeDashboardWebsiteId || activeBuilderWebsiteId;
  if (explicitWebsiteId) {
    return mockWebsites.find(website => website.id === explicitWebsiteId && website.user_id === userId);
  }
  const owned = mockWebsites.filter(website => website.user_id === userId);
  return owned.length === 1 ? owned[0] : undefined;
}

function getBuilderNewPageContext(): BuilderNewPageContext {
  const actingUserId = typeof (window as any).currentUser === 'string'
    ? (window as any).currentUser.trim()
    : '';
  return {
    actingUserId,
    website: getActiveBuilderWebsite(),
    websiteRoutes: mockWebsiteRoutes,
    funnels: mockFunnels,
    pages: mockPages,
    activePageId: builderPageId
  };
}

async function flushActiveBuilderBeforeNewPage(): Promise<boolean> {
  const pageSettings = builderPageSettingsController?.pageId === builderPageId
    ? builderPageSettingsController
    : null;
  if (pageSettings?.status === 'saving') return false;
  if (pageSettings?.isDirty && !(await pageSettings.save())) return false;
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = undefined;
    await (window as any).savePageSections();
  }
  await builderSaveQueue.whenIdle();
  return true;
}

function getBuilderNewPageController(): BuilderNewPageController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderNewPageController && builderNewPageControllerIdentity === identity) {
    return builderNewPageController;
  }
  builderNewPageControllerIdentity = identity;
  builderNewPageController = new BuilderNewPageController({
    getContext: getBuilderNewPageContext,
    persist: async request => {
      if (!(await flushActiveBuilderBeforeNewPage())) {
        return { success: false, code: 'UNAVAILABLE' };
      }
      try {
        const response = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
        const payload = await response.json() as {
          success?: boolean;
          data?: Page;
          code?: BuilderNewPagePersistResult['code'];
        };
        return response.ok && payload.success && payload.data
          ? { success: true, page: payload.data }
          : { success: false, code: payload.code ?? 'INVALID_RESPONSE' };
      } catch {
        return { success: false, code: 'AMBIGUOUS' };
      }
    },
    onCreated: async page => {
      const existingIndex = mockPages.findIndex(item => item.id === page.id);
      if (existingIndex >= 0) mockPages[existingIndex] = page;
      else mockPages.push(page);
      document.body.classList.remove('pb-new-page-modal-open');
      builderPagesPanelView = 'list';
      await (window as any).switchBuilderPage(page.id);
    }
  });
  return builderNewPageController;
}

function getBuilderDuplicatePageController(): BuilderDuplicatePageController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderDuplicatePageController && builderDuplicatePageControllerIdentity === identity) {
    return builderDuplicatePageController;
  }
  builderDuplicatePageControllerIdentity = identity;
  builderDuplicatePageController = new BuilderDuplicatePageController({
    getContext: getBuilderNewPageContext,
    persist: async request => {
      if (!(await flushActiveBuilderBeforeNewPage())) {
        return { success: false, code: 'UNAVAILABLE' };
      }
      try {
        const response = await fetch(`/api/pages/${encodeURIComponent(request.sourcePageId)}/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
        const payload = await response.json() as {
          success?: boolean;
          data?: { page: Page; sections: PageSection[] };
          code?: BuilderDuplicatePagePersistResult['code'];
          error?: string;
        };
        return response.ok && payload.success && payload.data
          ? { success: true, data: payload.data }
          : { success: false, code: payload.code ?? 'INVALID_RESPONSE', error: payload.error };
      } catch {
        return { success: false, code: 'AMBIGUOUS' };
      }
    },
    onDuplicated: async (page, sections, meta) => {
      const existingIndex = mockPages.findIndex(item => item.id === page.id);
      if (existingIndex >= 0) mockPages[existingIndex] = page;
      else mockPages.push(page);

      for (const section of sections) {
        const sIndex = mockPageSections.findIndex(s => s.id === section.id);
        if (sIndex >= 0) mockPageSections[sIndex] = section;
        else mockPageSections.push(section as any);
      }

      builderPagesPanelView = 'list';
      if (meta?.shouldNavigate) {
        await (window as any).switchBuilderPage(page.id);
      } else {
        renderBuilderPagesPanel();
      }
    }
  });
  return builderDuplicatePageController;
}

let builderDeletePageController: BuilderDeletePageController | null = null;
let builderDeletePageControllerIdentity = '';

function getBuilderDeletePageController(): BuilderDeletePageController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderDeletePageController && builderDeletePageControllerIdentity === identity) {
    return builderDeletePageController;
  }
  builderDeletePageControllerIdentity = identity;
  builderDeletePageController = new BuilderDeletePageController({
    getContext: getBuilderNewPageContext,
    persist: async request => {
      if (!(await flushActiveBuilderBeforeNewPage())) {
        return { success: false, code: 'UNAVAILABLE' };
      }
      try {
        const response = await fetch(`/api/pages/${encodeURIComponent(request.pageId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const payload = await response.json() as {
          success?: boolean;
          data?: { id: string; funnel_id?: string };
          code?: BuilderDeletePagePersistResult['code'];
          error?: string;
        };
        return response.ok && payload.success && payload.data
          ? { success: true, data: payload.data }
          : { success: false, code: payload.code ?? 'INVALID_RESPONSE', error: payload.error };
      } catch {
        return { success: false, code: 'AMBIGUOUS' };
      }
    },
    onDeleted: async (deletedPageId, meta) => {
      const pageIndex = mockPages.findIndex(item => item.id === deletedPageId);
      if (pageIndex >= 0) mockPages.splice(pageIndex, 1);

      const remainingSections = mockPageSections.filter(s => s.page_id !== deletedPageId);
      mockPageSections.splice(0, mockPageSections.length, ...remainingSections);

      builderPagesPanelView = 'list';
      if (meta?.shouldNavigate && meta.replacementPageId) {
        await (window as any).switchBuilderPage(meta.replacementPageId);
      } else {
        renderBuilderPagesPanel();
      }
    }
  });
  return builderDeletePageController;
}

(window as any).promptDeleteBuilderPage = (pageId: string) => {
  const controller = getBuilderDeletePageController();
  if (controller.promptDelete(pageId)) {
    renderBuilderPagesPanel();
  } else if (controller.status === 'error') {
    renderBuilderPagesPanel();
  }
};

(window as any).cancelDeleteBuilderPage = () => {
  const controller = getBuilderDeletePageController();
  controller.cancelDelete();
  renderBuilderPagesPanel();
};

(window as any).confirmDeleteBuilderPage = async () => {
  const controller = getBuilderDeletePageController();
  await controller.confirmDelete();
  renderBuilderPagesPanel();
};

let builderReorderPagesController: BuilderReorderPagesController | null = null;
let builderReorderPagesControllerIdentity = '';

export function getBuilderReorderPagesController(): BuilderReorderPagesController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderReorderPagesController && builderReorderPagesControllerIdentity === identity) {
    return builderReorderPagesController;
  }
  builderReorderPagesControllerIdentity = identity;
  builderReorderPagesController = new BuilderReorderPagesController(() => {
    const current = getBuilderNewPageContext();

    return {
      actingUserId: current.actingUserId,
      websiteId: current.website?.id,
      pages: mockPages,
      client: (window as any).supabaseClient ?? undefined,
      onPagesReordered: (updatedPages) => {
        updatedPages.forEach(up => {
          const idx = mockPages.findIndex(p => p.id === up.id);
          if (idx >= 0) {
            mockPages[idx].step_order = up.step_order;
          }
        });
        renderBuilderPagesPanel();
      },
      onConflict: () => {
        renderBuilderPagesPanel();
      }
    };
  });
  return builderReorderPagesController;
}

(window as any).moveBuilderPageUp = async (pageId: string) => {
  const controller = getBuilderReorderPagesController();
  await controller.movePageUp(pageId);
  renderBuilderPagesPanel();
};

(window as any).moveBuilderPageDown = async (pageId: string) => {
  const controller = getBuilderReorderPagesController();
  await controller.movePageDown(pageId);
  renderBuilderPagesPanel();
};

let builderSetHomepageController: BuilderSetHomepageController | null = null;
let builderSetHomepageControllerIdentity = '';

export function getBuilderSetHomepageController(): BuilderSetHomepageController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderSetHomepageController && builderSetHomepageControllerIdentity === identity) {
    return builderSetHomepageController;
  }
  builderSetHomepageControllerIdentity = identity;
  builderSetHomepageController = new BuilderSetHomepageController(() => {
    const current = getBuilderNewPageContext();
    return {
      actingUserId: current.actingUserId,
      website: current.website,
      funnels: mockFunnels,
      websiteRoutes: mockWebsiteRoutes,
      client: (window as any).supabaseClient ?? undefined,
      onHomepageSet: (updatedWebsite) => {
        const idx = mockWebsites.findIndex(w => w.id === updatedWebsite.id);
        if (idx >= 0) {
          mockWebsites[idx] = updatedWebsite;
        }
        const activeSite = getActiveBuilderWebsite();
        if (activeSite && activeSite.id === updatedWebsite.id) {
          activeSite.homepage_funnel_id = updatedWebsite.homepage_funnel_id;
          activeSite.draft_homepage_funnel_id = updatedWebsite.draft_homepage_funnel_id;
        }
        renderBuilder();
      },
      onConflict: () => {
        renderBuilder();
      }
    };
  });
  return builderSetHomepageController;
}

(window as any).setBuilderHomepage = async (funnelId: string) => {
  const controller = getBuilderSetHomepageController();
  const success = await controller.setHomepage(funnelId);
  renderBuilder();
  if (success) {
    (window as any).showToast('Draft homepage updated', 'success');
  } else if (controller.error) {
    (window as any).showToast(controller.error, 'error');
  }
};

let builderPageRouteController: BuilderPageRouteController | null = null;
let builderPageRouteControllerIdentity = '';

export function getBuilderPageRouteController(): BuilderPageRouteController {
  const context = getBuilderNewPageContext();
  const identity = `${context.actingUserId}:${context.website?.id ?? ''}`;
  if (builderPageRouteController && builderPageRouteControllerIdentity === identity) {
    return builderPageRouteController;
  }
  builderPageRouteControllerIdentity = identity;
  builderPageRouteController = new BuilderPageRouteController({
    actingUserId: context.actingUserId,
    client: (window as any).supabaseClient ?? undefined
  });
  if (context.website?.id) {
    builderPageRouteController.hydrate(context.website.id).then(() => {
      renderBuilder();
    });
  }
  return builderPageRouteController;
}

(window as any).openBuilderPageRouteEditor = (pageId: string) => {
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(p => p.id === pageId);
  if (!website || !page) return;
  const entries = getBuilderWebsitePageEntries();
  const isHomepage = entries.find(e => e.page.id === pageId)?.isHomepage === true;
  const controller = getBuilderPageRouteController();
  if (controller.openEditor(page, website, isHomepage)) {
    renderBuilder();
    setTimeout(() => document.getElementById('pb-page-route-input')?.focus(), 0);
  }
};

(window as any).closeBuilderPageRouteEditor = () => {
  const controller = getBuilderPageRouteController();
  controller.closeEditor();
  renderBuilder();
};

(window as any).updateBuilderPageRouteInput = (value: string) => {
  const website = getActiveBuilderWebsite();
  if (!website) return;
  const controller = getBuilderPageRouteController();
  controller.updateEditorInput(value, website);
  renderBuilder();
};

(window as any).submitBuilderPageRoute = async () => {
  const website = getActiveBuilderWebsite();
  const controller = getBuilderPageRouteController();
  const pageId = controller.getState().editingPageId;
  const page = mockPages.find(p => p.id === pageId);
  if (!website || !page) return;

  const success = await controller.saveEditorRoute(page, website);
  renderBuilder();
  if (success) {
    (window as any).showToast('Page URL draft saved', 'success');
  }
};

(window as any).promptDeleteBuilderPageRoute = (pageId: string) => {
  const controller = getBuilderPageRouteController();
  controller.promptDeleteRoute(pageId);
  renderBuilder();
};

(window as any).cancelDeleteBuilderPageRoute = () => {
  const controller = getBuilderPageRouteController();
  controller.cancelDeleteRoute();
  renderBuilder();
};

(window as any).confirmDeleteBuilderPageRoute = async (pageId: string) => {
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(p => p.id === pageId);
  if (!website || !page) return;
  const controller = getBuilderPageRouteController();
  const success = await controller.confirmDeleteRoute(page, website);
  renderBuilder();
  if (success) {
    (window as any).showToast('URL removal staged', 'success');
  } else if (controller.getState().stagingError) {
    (window as any).showToast(controller.getState().stagingError, 'error');
  }
};

(window as any).revertBuilderPageRoute = async (pageId: string) => {
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(p => p.id === pageId);
  if (!website || !page) return;
  const controller = getBuilderPageRouteController();
  const success = await controller.revertRoute(page, website);
  renderBuilder();
  if (success) {
    (window as any).showToast('Route draft reverted', 'success');
  } else if (controller.getState().stagingError) {
    (window as any).showToast(controller.getState().stagingError, 'error');
  }
};

(window as any).openBuilderRoutePublishModal = () => {
  const controller = getBuilderPageRouteController();
  controller.openPublishModal();
  renderBuilder();
};

(window as any).closeBuilderRoutePublishModal = () => {
  const controller = getBuilderPageRouteController();
  controller.closePublishModal();
  renderBuilder();
};

(window as any).confirmBuilderRoutePublish = async () => {
  const website = getActiveBuilderWebsite();
  if (!website) return;
  const controller = getBuilderPageRouteController();
  const success = await controller.publishPendingRoutes(website.id);
  renderBuilder();
  if (success) {
    (window as any).showToast('URL changes published to live site', 'success');
  } else if (controller.getState().publicationState.errorMessage) {
    (window as any).showToast(controller.getState().publicationState.errorMessage, 'error');
  }
};

let builderSiteNavigationController: BuilderSiteNavigationController | null = null;
let builderSiteNavigationPublishController: BuilderSiteNavigationPublishController | null = null;
let builderNavigationUiManager: BuilderNavigationUiManager | null = null;
let builderSiteNavigationIdentity = '';

function getNavUiContext(): NavigationUiContext | null {
  const website = getActiveBuilderWebsite();
  if (!website) return null;

  const routeController = getBuilderPageRouteController();
  const effectiveRoutes = routeController.getState().effectiveRoutes;
  const websiteRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
  const associatedFunnelIds = new Set<string>();
  if (website.homepage_funnel_id) associatedFunnelIds.add(website.homepage_funnel_id);
  if (website.draft_homepage_funnel_id) associatedFunnelIds.add(website.draft_homepage_funnel_id);
  for (const r of websiteRoutes) {
    if (r.funnel_id) associatedFunnelIds.add(r.funnel_id);
  }
  for (const er of effectiveRoutes) {
    if (er.funnel_id) associatedFunnelIds.add(er.funnel_id);
  }

  const siteFunnels = mockFunnels.filter(f => f.user_id === website.user_id && associatedFunnelIds.has(f.id));
  const sitePages = mockPages.filter(p => p.user_id === website.user_id && !!p.funnel_id && associatedFunnelIds.has(p.funnel_id));
  const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || null;

  return {
    website,
    pages: sitePages,
    funnels: siteFunnels,
    effectiveRoutes,
    layout,
    actingUserId: getActingUserId()
  };
}

export function getBuilderSiteNavigationManager(): BuilderNavigationUiManager {
  const website = getActiveBuilderWebsite();
  const userId = getActingUserId();
  const identity = `${userId}:${website?.id ?? ''}`;
  if (builderNavigationUiManager && builderSiteNavigationIdentity === identity && builderSiteNavigationController) {
    return builderNavigationUiManager;
  }
  builderSiteNavigationIdentity = identity;

  const repo: BuilderSiteNavigationRepository = editorUsesSupabase()
    ? new SupabaseBuilderSiteNavigationRepository(getBuilderPublicationSupabaseClient)
    : new MockBuilderSiteNavigationRepository();

  builderSiteNavigationController = new BuilderSiteNavigationController(repo);
  builderSiteNavigationPublishController = new BuilderSiteNavigationPublishController(repo);
  builderNavigationUiManager = new BuilderNavigationUiManager(
    builderSiteNavigationController,
    builderSiteNavigationPublishController
  );

  builderNavigationUiManager.subscribe(() => {
    if (currentView === 'builder' && builderLeftPanelTab === 'navigation') {
      renderBuilder();
    }
  });

  builderSiteNavigationController.subscribe(() => {
    if (currentView === 'builder' && builderLeftPanelTab === 'navigation') {
      renderBuilder();
    }
  });

  builderSiteNavigationPublishController.subscribe(() => {
    if (currentView === 'builder' && builderLeftPanelTab === 'navigation') {
      renderBuilder();
    }
  });

  if (website?.id) {
    const routeController = getBuilderPageRouteController();
    const effectiveRoutes = routeController.getState().effectiveRoutes;
    builderSiteNavigationController.hydrate(website.id, {
      effectiveRoutes,
      homepageFunnelId: website.homepage_funnel_id
    }, builderNavigationUiManager.getActiveScope());
  }

  return builderNavigationUiManager;
}

function renderBuilderSiteNavigationPanel(): string {
  const manager = getBuilderSiteNavigationManager();
  const state = builderSiteNavigationController?.getState() ?? { status: 'uninitialized' as const };
  const context = getNavUiContext();
  if (!context) {
    return `<div style="padding: 24px; color: #94a3b8; text-align: center;">Website not loaded.</div>`;
  }
  return renderBuilderNavigationPanel(state, manager, context);
}

function renderBuilderNavigationDialogs(): string {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  const itemModalHtml = renderNavigationItemModal(manager.getItemModalState(), context);
  const publishModalHtml = renderNavigationPublishModal(manager.getPublishModalState());
  return `${itemModalHtml}\n${publishModalHtml}`;
}

(window as any).setBuilderNavScope = (scope: NavigationMenuScope) => {
  const manager = getBuilderSiteNavigationManager();
  manager.setActiveScope(scope);
  const website = getActiveBuilderWebsite();
  if (website?.id && builderSiteNavigationController) {
    const context = getNavUiContext();
    if (context) {
      builderSiteNavigationController.hydrate(website.id, {
        effectiveRoutes: context.effectiveRoutes,
        homepageFunnelId: website.homepage_funnel_id
      }, scope);
    }
  }
  renderBuilder();
};

(window as any).openAddBuilderNavItemModal = () => {
  const manager = getBuilderSiteNavigationManager();
  manager.openAddItemModal();
  renderBuilder();
};

(window as any).openEditBuilderNavItemModal = (itemId: string) => {
  const manager = getBuilderSiteNavigationManager();
  const state = builderSiteNavigationController?.getState();
  if (state?.status === 'ready') {
    const item = state.rawItems.find(i => i.id === itemId);
    if (item) {
      manager.openEditItemModal(item);
      renderBuilder();
    }
  }
};

(window as any).closeBuilderNavItemModal = () => {
  const manager = getBuilderSiteNavigationManager();
  manager.closeItemModal();
  renderBuilder();
};

(window as any).setBuilderNavItemModalField = (field: string, value: any) => {
  const manager = getBuilderSiteNavigationManager();
  manager.setItemModalField(field as any, value);
};

(window as any).saveBuilderNavItemModal = async () => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  const success = await manager.saveItemModal({
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (success) {
    (window as any).showToast('Navigation item saved', 'success');
  }
  renderBuilder();
};

(window as any).removeBuilderNavItem = async (itemId: string) => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  const success = await manager.removeItem(itemId, {
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (success) {
    (window as any).showToast('Navigation item removed', 'success');
  }
  renderBuilder();
};

(window as any).toggleBuilderNavItemVisibility = async (itemId: string) => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  const success = await manager.toggleItemVisibility(itemId, {
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (success) {
    (window as any).showToast('Visibility updated', 'success');
  }
  renderBuilder();
};

(window as any).moveBuilderNavItem = async (itemId: string, direction: 'up' | 'down') => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  await manager.moveItem(itemId, direction, {
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  renderBuilder();
};

(window as any).startBuilderLegacyAdoption = () => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (context) {
    manager.startLegacyAdoptionReview(context.layout, {
      effectiveRoutes: context.effectiveRoutes,
      funnels: context.funnels,
      pages: context.pages
    });
  }
  renderBuilder();
};

(window as any).closeBuilderLegacyAdoptionReview = () => {
  const manager = getBuilderSiteNavigationManager();
  manager.closeLegacyAdoptionReview();
  renderBuilder();
};

(window as any).openResolveCandidateModal = (candidateId: string) => {
  const manager = getBuilderSiteNavigationManager();
  manager.openResolveCandidateModal(candidateId);
  renderBuilder();
};

(window as any).removeAdoptionCandidate = (candidateId: string) => {
  const manager = getBuilderSiteNavigationManager();
  manager.removeAdoptionCandidate(candidateId);
  renderBuilder();
};

(window as any).commitBuilderLegacyAdoption = async () => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  const success = await manager.commitLegacyAdoption({
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (success) {
    (window as any).showToast('Converted legacy layout to editable navigation draft', 'success');
  }
  renderBuilder();
};

(window as any).revertBuilderNavDraft = async () => {
  if (!builderSiteNavigationController) return;
  const context = getNavUiContext();
  if (!context) return;
  const state = builderSiteNavigationController.getState();
  if (state.status !== 'ready' || !state.isDraft) return;

  const res = await builderSiteNavigationController.revertDraft({
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (res.success) {
    (window as any).showToast('Navigation draft reverted', 'success');
  } else {
    (window as any).showToast(res.error || 'Failed to revert navigation draft', 'error');
  }
  renderBuilder();
};

(window as any).previewBuilderNavChanges = () => {
  (window as any).setBuilderMode('preview');
};

(window as any).openPublishBuilderNavModal = () => {
  const manager = getBuilderSiteNavigationManager();
  manager.openPublishModal();
  renderBuilder();
};

(window as any).closePublishBuilderNavModal = () => {
  const manager = getBuilderSiteNavigationManager();
  manager.closePublishModal();
  renderBuilder();
};

(window as any).confirmPublishBuilderNav = async () => {
  const manager = getBuilderSiteNavigationManager();
  const context = getNavUiContext();
  if (!context) return;
  const success = await manager.confirmPublish({
    effectiveRoutes: context.effectiveRoutes,
    homepageFunnelId: context.website.homepage_funnel_id
  });
  if (success) {
    (window as any).showToast('Navigation published successfully', 'success');
  }
  renderBuilder();
};

(window as any).reloadBuilderNavigation = async () => {
  const manager = getBuilderSiteNavigationManager();
  const website = getActiveBuilderWebsite();
  if (website?.id && builderSiteNavigationController) {
    const context = getNavUiContext();
    if (context) {
      await builderSiteNavigationController.hydrate(website.id, {
        effectiveRoutes: context.effectiveRoutes,
        homepageFunnelId: website.homepage_funnel_id
      }, manager.getActiveScope());
    }
  }
  renderBuilder();
};

let builderUnifiedPublicationController: BuilderUnifiedPublicationController | null = null;
let builderUnifiedPublicationIdentity = '';

function getBuilderUnifiedPublicationController(): BuilderUnifiedPublicationController {
  const website = getActiveBuilderWebsite();
  const userId = getActingUserId();
  const identity = `${userId}:${website?.id ?? ''}`;
  if (builderUnifiedPublicationController && builderUnifiedPublicationIdentity === identity) {
    return builderUnifiedPublicationController;
  }
  builderUnifiedPublicationIdentity = identity;

  const repo = new SupabaseBuilderUnifiedPublicationRepository(getBuilderPublicationSupabaseClient);
  builderUnifiedPublicationController = new BuilderUnifiedPublicationController(repo);
  builderUnifiedPublicationController.subscribe(() => {
    if (currentView === 'builder') {
      renderBuilder();
    }
  });

  return builderUnifiedPublicationController;
}

function renderBuilderUnifiedPublishModalHtml(): string {
  const controller = getBuilderUnifiedPublicationController();
  return renderUnifiedPublishModal(controller.getState());
}

(window as any).openBuilderUnifiedPublishModal = (websiteId?: string) => {
  const targetWebsiteId = websiteId || getActiveBuilderWebsite()?.id;
  if (!targetWebsiteId) {
    (window as any).showToast('No active website to publish.', 'error');
    return;
  }
  const controller = getBuilderUnifiedPublicationController();
  controller.openModal(targetWebsiteId);
};

(window as any).closeBuilderUnifiedPublishModal = () => {
  const controller = getBuilderUnifiedPublicationController();
  controller.closeModal();
};

(window as any).confirmBuilderUnifiedPublish = async () => {
  const controller = getBuilderUnifiedPublicationController();
  const res = await controller.publish();
  if (res?.success) {
    (window as any).showToast(
      res.status === 'NO_CHANGES'
        ? 'Everything is already published.'
        : `Website published successfully (Revision ${res.publication_revision}).`,
      'success'
    );
    // Re-hydrate navigation and route controllers
    const website = getActiveBuilderWebsite();
    if (website?.id && builderSiteNavigationController) {
      const context = getNavUiContext();
      if (context) {
        await builderSiteNavigationController.hydrate(website.id, {
          effectiveRoutes: context.effectiveRoutes,
          homepageFunnelId: website.homepage_funnel_id
        }, getBuilderSiteNavigationManager().getActiveScope());
      }
    }
  }
};

window.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (target.closest('#pb-unified-publish-confirm-btn')) {
    event.preventDefault();
    void (window as any).confirmBuilderUnifiedPublish();
  } else if (
    target.closest('#pb-unified-publish-cancel-btn') ||
    target.closest('#pb-unified-publish-close-btn') ||
    target.closest('#pb-unified-publish-close-icon')
  ) {
    event.preventDefault();
    (window as any).closeBuilderUnifiedPublishModal();
  } else if (target.closest('#pb-unified-publish-reload-btn')) {
    event.preventDefault();
    const websiteId = getActiveBuilderWebsite()?.id;
    if (websiteId) {
      void getBuilderUnifiedPublicationController().loadPlan(websiteId);
    }
  }
});

function getBuilderWebsitePageEntries(): BuilderWebsitePageEntry[] {
  const website = getActiveBuilderWebsite();
  if (!website) return [];

  const websiteRoutes = mockWebsiteRoutes.filter(route => route.website_id === website.id);
  const homepageRoute = websiteRoutes.find(route => normalizePreviewPath(route.path) === '/');
  const homepageResolution = resolveWebsiteHomepage({ actingUserId: website.user_id, website, routes: websiteRoutes, funnels: mockFunnels, pages: mockPages });
  const homepagePage = homepageResolution.status === 'resolved' ? homepageResolution.page : undefined;
  const scopedPages = new Set(getWebsiteScopedPages({ actingUserId: website.user_id, website, routes: websiteRoutes, funnels: mockFunnels, pages: mockPages }).map(page => page.id));

  const entries = mockPages
    .map((page, originalIndex) => ({ page, originalIndex }))
    .filter(({ page }) => {
      return page.user_id === website.user_id && scopedPages.has(page.id);
    })
    .map(({ page, originalIndex }): BuilderWebsitePageEntry => {
      const isHomepage = page.id === homepagePage?.id;
      const isLiveHomepage = page.funnel_id === website.homepage_funnel_id;
      const isDraftHomepage = !!website.draft_homepage_funnel_id && page.funnel_id === website.draft_homepage_funnel_id;
      const slugPath = page.slug ? normalizePreviewPath(`/${page.slug}`) : '/';
      const exactRoute = websiteRoutes.find(route =>
        route.slug === page.slug
        || normalizePreviewPath(route.path) === slugPath
      ) || (() => {
        const funnelRoutes = page.funnel_id
          ? websiteRoutes.filter(route => route.funnel_id === page.funnel_id)
          : [];
        return funnelRoutes.length === 1 ? funnelRoutes[0] : undefined;
      })();
      const route = isHomepage ? homepageRoute : exactRoute;
      const rawRouteOrder = route
        ? (route as WebsiteRoute & { order?: number; sort_order?: number }).order
          ?? (route as WebsiteRoute & { sort_order?: number }).sort_order
        : undefined;

      return {
        page,
        path: isHomepage ? '/' : route?.path || slugPath,
        isHomepage,
        isLiveHomepage,
        isDraftHomepage,
        routeOrder: typeof rawRouteOrder === 'number' && Number.isFinite(rawRouteOrder)
          ? rawRouteOrder
          : undefined,
        stepOrder: typeof page.step_order === 'number' && Number.isFinite(page.step_order)
          ? page.step_order
          : undefined,
        originalIndex
      };
    });

  const hasRouteOrder = entries.some(entry => entry.routeOrder !== undefined);
  const hasStepOrder = entries.some(entry => entry.stepOrder !== undefined);

  return entries.slice().sort((left, right) => {
    if (hasRouteOrder) {
      const routeDifference = (left.routeOrder ?? Number.POSITIVE_INFINITY)
        - (right.routeOrder ?? Number.POSITIVE_INFINITY);
      if (routeDifference !== 0) return routeDifference;
    } else if (hasStepOrder) {
      const stepDifference = (left.stepOrder ?? Number.POSITIVE_INFINITY)
        - (right.stepOrder ?? Number.POSITIVE_INFINITY);
      if (stepDifference !== 0) return stepDifference;
    }
    return left.originalIndex - right.originalIndex;
  });
}

function updateBuilderPageInMemory(page: Page): void {
  const index = mockPages.findIndex(item => item.id === page.id);
  if (index < 0) return;
  mockPages[index] = page;
  if (builderHistoryController?.pageId === page.id) {
    builderHistoryController.synchronizePageMetadata(page);
  }
  if (builderMode === 'preview' && page.id === builderPageId) {
    document.title = page.seo_title || page.name;
    updateMetaTag('description', page.seo_description || '');
  }
}

function getBuilderPageSettingsController(): BuilderPageSettingsController | null {
  const page = mockPages.find(item => item.id === builderPageId);
  if (!page) return null;
  if (builderPageSettingsController?.pageId === page.id) {
    return builderPageSettingsController;
  }
  builderPageSettingsController?.cancelPending();
  const entry = getBuilderWebsitePageEntries().find(item => item.page.id === page.id);
  builderPageSettingsController = new BuilderPageSettingsController({
    page,
    validationContext: {
      isHomepage: entry?.isHomepage === true,
      originalSlug: page.slug,
      existingSlugs: mockPages
        .filter(item => item.user_id === page.user_id && item.id !== page.id)
        .map(item => item.slug)
    },
    persist: async (pageId, patch): Promise<BuilderPageSettingsPersistResult> => {
      try {
        const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const payload = await response.json() as {
          success?: boolean;
          data?: Page;
          code?: BuilderPageSettingsPersistResult['code'];
        };
        return response.ok && payload.success === true && payload.data
          ? { success: true, page: payload.data }
          : { success: false, code: payload.code ?? 'INVALID_RESPONSE' };
      } catch {
        return { success: false, code: 'UNAVAILABLE' };
      }
    },
    onOptimisticPage: updateBuilderPageInMemory,
    onSettledPage: updateBuilderPageInMemory
  });
  return builderPageSettingsController;
}

function builderPageSettingsIssue(field: BuilderPageSettingsField): string {
  return getBuilderPageSettingsController()?.issues.find(issue => issue.field === field)?.message ?? '';
}

function renderBuilderPageSettingsPanel(): string {
  const page = mockPages.find(item => item.id === builderPageId);
  const controller = getBuilderPageSettingsController();
  if (!page || !controller) {
    return '<div class="pb-pages-empty"><h4>No active page</h4><p>Select a page before editing its settings.</p></div>';
  }
  const draft = controller.draft;
  const entry = getBuilderWebsitePageEntries().find(item => item.page.id === page.id);
  const isHomepage = entry?.isHomepage === true;
  const issue = (field: BuilderPageSettingsField) => builderPageSettingsIssue(field);
  const invalid = (field: BuilderPageSettingsField) => issue(field) ? 'true' : 'false';
  const website = getActiveBuilderWebsite();
  const routeVM = website ? getBuilderPageRouteController().getPageRoute(page, website, { isHomepage }) : null;
  const host = website?.domain || (website?.subdomain ? `${website.subdomain}.pressurepro.io` : 'your-site.example');
  const previewPath = entry?.path || (isHomepage ? '/' : `/${draft.slug || 'page-url'}`);
  const statusLabel = controller.status === 'saving' ? 'Saving…'
    : controller.status === 'saved' ? 'Saved'
      : controller.status === 'error' ? 'Could not save'
        : controller.isDirty ? 'Unsaved changes' : 'No changes';

  return `
    <div class="pb-page-settings" data-page-id="${escapeBuilderInspectorHtml(page.id)}">
      <div class="pb-page-settings-header">
        <span>Page Settings</span>
        <strong title="Draft page metadata status">${escapeBuilderInspectorHtml(page.status)}</strong>
        <h3>${escapeBuilderInspectorHtml(page.name || 'Untitled page')}</h3>
        <p>Publication is controlled separately through the Publish workflow.</p>
      </div>
      <div class="pb-page-settings-scroll">
        <section class="pb-page-settings-group" aria-labelledby="pb-page-general-heading">
          <h4 id="pb-page-general-heading">General</h4>
          <div class="pb-page-settings-field">
            <label for="pb-page-name">Page name</label>
            <input id="pb-page-name" type="text" maxlength="${BUILDER_PAGE_NAME_MAX_LENGTH}" value="${escapeBuilderInspectorHtml(draft.name)}" aria-invalid="${invalid('name')}" aria-describedby="pb-page-name-help pb-page-name-error" oninput="window.updateBuilderPageSettingsField('name', this.value)">
            <div id="pb-page-name-help" class="pb-page-settings-help">Used in the Builder and page list. Changing it does not change the URL.</div>
            <div id="pb-page-name-error" class="pb-page-settings-error" role="alert">${escapeBuilderInspectorHtml(issue('name'))}</div>
          </div>
          <div class="pb-page-settings-field">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label>Public Route URL</label>
              ${routeVM?.isEditable ? `
                <button type="button" class="pb-page-settings-edit-route" onclick="window.openBuilderPageRouteEditor('${escapeBuilderInspectorHtml(page.id)}')" style="background: transparent; border: none; color: #60a5fa; cursor: pointer; font-size: 0.75rem; font-weight: 600; text-decoration: underline;">
                  Edit URL
                </button>
              ` : ''}
            </div>
            <div style="padding: 8px 12px; background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; font-family: monospace; font-size: 0.8rem; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
              <span>${escapeBuilderInspectorHtml(routeVM?.effectivePath || previewPath)}</span>
              <span class="pb-page-route-badge ${routeVM?.routeStatus || 'unrouted'}">${escapeBuilderInspectorHtml(routeVM?.statusLabel || 'No public URL')}</span>
            </div>
            ${routeVM?.hasUnpublishedChanges && routeVM.currentLivePath ? `
              <small style="color: #9ca3af; font-size: 0.72rem; margin-top: 4px; display: block;">Live URL: https://${escapeBuilderInspectorHtml(host)}${escapeBuilderInspectorHtml(routeVM.currentLivePath)}</small>
            ` : ''}
          </div>
          <div class="pb-page-settings-field">
            <label for="pb-page-slug">URL slug</label>
            <div class="pb-page-slug-control"><span>/</span><input id="pb-page-slug" type="text" maxlength="${BUILDER_PAGE_SLUG_MAX_LENGTH}" value="${escapeBuilderInspectorHtml(draft.slug)}" ${isHomepage ? 'disabled' : ''} aria-invalid="${invalid('slug')}" aria-describedby="pb-page-slug-help pb-page-slug-error" oninput="window.updateBuilderPageSettingsField('slug', this.value)"></div>
            <div id="pb-page-slug-help" class="pb-page-settings-help">${isHomepage ? 'Homepage URL is locked to the root route.' : 'Lowercase letters, numbers, and hyphens. Website routes are managed via Edit URL.'}</div>
            <div id="pb-page-slug-error" class="pb-page-settings-error" role="alert">${escapeBuilderInspectorHtml(issue('slug'))}</div>
          </div>
          ${typeof page.step_order === 'number' ? `<div class="pb-page-settings-readonly"><span>Funnel order</span><strong>${page.step_order}</strong><small>Informational; page reordering is outside this task.</small></div>` : ''}
        </section>
        <section class="pb-page-settings-group" aria-labelledby="pb-page-seo-heading">
          <h4 id="pb-page-seo-heading">SEO</h4>
          <div class="pb-page-settings-field">
            <div class="pb-page-settings-label-row"><label for="pb-page-seo-title">SEO title</label><span id="pb-page-seo-title-count">${draft.seo_title.length}/${BUILDER_SEO_TITLE_MAX_LENGTH}</span></div>
            <input id="pb-page-seo-title" type="text" maxlength="${BUILDER_SEO_TITLE_MAX_LENGTH}" value="${escapeBuilderInspectorHtml(draft.seo_title)}" aria-invalid="${invalid('seo_title')}" aria-describedby="pb-page-seo-title-help pb-page-seo-title-error" oninput="window.updateBuilderPageSettingsField('seo_title', this.value)">
            <div id="pb-page-seo-title-help" class="pb-page-settings-help">Optional. Around 50–60 characters is a useful guideline.</div>
            <div id="pb-page-seo-title-error" class="pb-page-settings-error" role="alert">${escapeBuilderInspectorHtml(issue('seo_title'))}</div>
          </div>
          <div class="pb-page-settings-field">
            <div class="pb-page-settings-label-row"><label for="pb-page-seo-description">Meta description</label><span id="pb-page-seo-description-count">${draft.seo_description.length}/${BUILDER_SEO_DESCRIPTION_MAX_LENGTH}</span></div>
            <textarea id="pb-page-seo-description" maxlength="${BUILDER_SEO_DESCRIPTION_MAX_LENGTH}" aria-invalid="${invalid('seo_description')}" aria-describedby="pb-page-seo-description-help pb-page-seo-description-error" oninput="window.updateBuilderPageSettingsField('seo_description', this.value)">${escapeBuilderInspectorHtml(draft.seo_description)}</textarea>
            <div id="pb-page-seo-description-help" class="pb-page-settings-help">Optional. Around 150–160 characters is a useful guideline.</div>
            <div id="pb-page-seo-description-error" class="pb-page-settings-error" role="alert">${escapeBuilderInspectorHtml(issue('seo_description'))}</div>
          </div>
          <div class="pb-seo-preview" aria-label="Search result preview">
            <span>Search preview</span>
            <strong id="pb-page-seo-preview-title">${escapeBuilderInspectorHtml(draft.seo_title || draft.name || 'Untitled page')}</strong>
            <code id="pb-page-seo-preview-url">https://${escapeBuilderInspectorHtml(host)}${escapeBuilderInspectorHtml(previewPath)}</code>
            <p id="pb-page-seo-preview-description">${escapeBuilderInspectorHtml(draft.seo_description || 'Add a meta description to preview the page summary.')}</p>
          </div>
        </section>
      </div>
      <div class="pb-page-settings-footer">
        <span id="pb-page-settings-save-status" class="${controller.status}" role="status" aria-live="polite">${statusLabel}</span>
        ${controller.status === 'error' ? '<button type="button" class="pb-page-settings-retry" onclick="window.saveBuilderPageSettings()">Retry</button>' : ''}
        <button id="pb-page-settings-save" type="button" class="pb-page-settings-save" onclick="window.saveBuilderPageSettings()" ${controller.canSave ? '' : 'disabled'}>Save settings</button>
      </div>
    </div>
  `;
}

(window as any).setBuilderPagesPanelView = (view: 'list' | 'settings') => {
  builderPagesPanelView = view;
  renderBuilder();
};

(window as any).updateBuilderPageSettingsField = (field: BuilderPageSettingsField, value: string) => {
  const controller = getBuilderPageSettingsController();
  if (!controller || !['name', 'slug', 'seo_title', 'seo_description'].includes(field)) return;
  controller.updateField(field, value);
  const error = builderPageSettingsIssue(field);
  const input = document.getElementById(`pb-page-${field.replaceAll('_', '-')}`);
  input?.setAttribute('aria-invalid', error ? 'true' : 'false');
  const errorElement = document.getElementById(`pb-page-${field.replaceAll('_', '-')}-error`);
  if (errorElement) errorElement.textContent = error;
  const count = document.getElementById(`pb-page-${field.replaceAll('_', '-')}-count`);
  if (count) count.textContent = `${value.length}/${field === 'seo_title' ? BUILDER_SEO_TITLE_MAX_LENGTH : BUILDER_SEO_DESCRIPTION_MAX_LENGTH}`;
  const saveButton = document.getElementById('pb-page-settings-save') as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = !controller.canSave;
  const status = document.getElementById('pb-page-settings-save-status');
  if (status) {
    status.className = controller.status;
    status.textContent = controller.issues.length ? 'Fix validation errors' : controller.isDirty ? 'Unsaved changes' : 'No changes';
  }
  const draft = controller.draft;
  const previewTitle = document.getElementById('pb-page-seo-preview-title');
  const previewDescription = document.getElementById('pb-page-seo-preview-description');
  const previewUrl = document.getElementById('pb-page-seo-preview-url');
  if (previewTitle) previewTitle.textContent = draft.seo_title || draft.name || 'Untitled page';
  if (previewDescription) previewDescription.textContent = draft.seo_description || 'Add a meta description to preview the page summary.';
  if (previewUrl) {
    const entry = getBuilderWebsitePageEntries().find(item => item.page.id === controller.pageId);
    const website = getActiveBuilderWebsite();
    const host = website?.domain || (website?.subdomain ? `${website.subdomain}.pressurepro.io` : 'your-site.example');
    previewUrl.textContent = `https://${host}${entry?.path || (entry?.isHomepage ? '/' : `/${draft.slug || 'page-url'}`)}`;
  }
};

(window as any).saveBuilderPageSettings = async () => {
  const controller = getBuilderPageSettingsController();
  if (!controller) return;
  const pending = controller.save();
  renderBuilder();
  const succeeded = await pending;
  if (controller === builderPageSettingsController && controller.pageId === builderPageId) {
    renderBuilder();
    if (succeeded) (window as any).showToast('Page settings saved', 'success');
  }
};

function renderBuilderPagesPanel(): string {
  const website = getActiveBuilderWebsite();
  const entries = getBuilderWebsitePageEntries();
  const newPage = getBuilderNewPageController();
  const duplicate = getBuilderDuplicatePageController();
  const deleteController = getBuilderDeletePageController();
  const reorderController = getBuilderReorderPagesController();
  const homepageController = getBuilderSetHomepageController();
  const routeController = getBuilderPageRouteController();
  const isHomepageUpdating = homepageController.isUpdating;
  const updatingHomepageFunnelId = homepageController.updatingFunnelId;
  const pendingRouteCount = routeController.getPendingDraftCount();
  const canCreate = !!getActiveBuilderWebsite()
    && !!getBuilderNewPageContext().actingUserId
    && newPage.destinations.length > 0
    && !newPage.isCreating;
  const isDuplicating = duplicate.isDuplicating;
  const duplicatingPageId = duplicate.duplicatingPageId;
  const isDeleting = deleteController.isDeleting;
  const deletingPageId = deleteController.deletingPageId;
  const isConfirming = deleteController.isConfirming;
  const confirmingPageId = deleteController.confirmingPageId;
  const isReordering = reorderController.isReordering;
  const reorderingPageId = reorderController.reorderingPageId;
  const isOnlyPage = entries.length <= 1;

  return `
    <div class="pb-pages-panel">
      <div class="pb-pages-view-tabs" role="tablist" aria-label="Pages panel views">
        <button type="button" role="tab" aria-selected="${builderPagesPanelView === 'list'}" class="${builderPagesPanelView === 'list' ? 'active' : ''}" onclick="window.setBuilderPagesPanelView('list')">All pages</button>
        <button type="button" role="tab" aria-selected="${builderPagesPanelView === 'settings'}" class="${builderPagesPanelView === 'settings' ? 'active' : ''}" onclick="window.setBuilderPagesPanelView('settings')">Settings</button>
      </div>
      ${builderPagesPanelView === 'settings' ? renderBuilderPageSettingsPanel() : `
      <div class="pb-pages-heading">
        <span>Website pages</span>
        <strong>${entries.length}</strong>
      </div>
      ${pendingRouteCount > 0 ? `
        <div class="pb-pages-route-publish-banner">
          <button type="button" class="pb-publish-routes-btn" onclick="window.openBuilderRoutePublishModal()" aria-label="Publish ${pendingRouteCount} URL ${pendingRouteCount === 1 ? 'change' : 'changes'}">
            🚀 Publish ${pendingRouteCount} URL ${pendingRouteCount === 1 ? 'change' : 'changes'}
          </button>
        </div>
      ` : ''}
      ${deleteController.status === 'error' && deleteController.message ? `
        <div class="pb-page-delete-error" style="background: #fef2f2; color: #991b1b; padding: 8px 12px; border-radius: 6px; font-size: 0.825rem; margin-bottom: 12px; border: 1px solid #fecaca;">
          ${escapeBuilderInspectorHtml(deleteController.message)}
        </div>
      ` : ''}
      ${reorderController.status === 'error' && reorderController.error ? `
        <div class="pb-page-reorder-error" style="background: #fef2f2; color: #991b1b; padding: 8px 12px; border-radius: 6px; font-size: 0.825rem; margin-bottom: 12px; border: 1px solid #fecaca;">
          ${escapeBuilderInspectorHtml(reorderController.error)}
        </div>
      ` : ''}
      ${homepageController.status === 'error' && homepageController.error ? `
        <div class="pb-page-homepage-error" style="background: #fef2f2; color: #991b1b; padding: 8px 12px; border-radius: 6px; font-size: 0.825rem; margin-bottom: 12px; border: 1px solid #fecaca;">
          ${escapeBuilderInspectorHtml(homepageController.error)}
        </div>
      ` : ''}
      <div class="pb-new-page-entry">
        <button type="button" class="pb-new-page-button" aria-label="New page" onclick="window.openBuilderNewPageDialog()" ${canCreate ? '' : 'disabled'}>
          <span aria-hidden="true">+</span> New page
        </button>
        ${newPage.destinations.length === 0 ? '<p>This website does not have an available page destination.</p>' : ''}
      </div>
      <div class="pb-page-list">
        ${entries.length ? entries.map(({ page, path, isHomepage, isLiveHomepage, isDraftHomepage }) => {
          const name = page.name.trim() || 'Untitled page';
          const status = page.status || 'draft';
          const isCurrent = page.id === builderPageId;
          const isThisDuplicating = isDuplicating && duplicatingPageId === page.id;
          const isThisDeleting = isDeleting && deletingPageId === page.id;
          const isThisConfirming = isConfirming && confirmingPageId === page.id;
          const isThisReordering = isReordering && reorderingPageId === page.id;
          const routeVM = website ? routeController.getPageRoute(page, website, { isHomepage, isLiveHomepage, isDraftHomepage }) : null;
          const isConfirmingDeleteRoute = routeController.getState().isConfirmingDelete && routeController.getState().deletingPageId === page.id;
          const displayPath = routeVM?.displayPath ?? path;
          const safeName = escapeBuilderInspectorHtml(name);
          const safePath = escapeBuilderInspectorHtml(displayPath);
          const safeStatus = escapeBuilderInspectorHtml(status);
          const pageArg = builderInspectorJsArgument(page.id);
          const funnelEntries = entries.filter(e => e.page.funnel_id === page.funnel_id);
          const funnelIndex = funnelEntries.findIndex(e => e.page.id === page.id);
          const isFirstInFunnel = funnelIndex === 0;
          const isLastInFunnel = funnelIndex === funnelEntries.length - 1;
          const canMoveUp = !isFirstInFunnel && !isReordering && !isDuplicating && !isDeleting;
          const canMoveDown = !isLastInFunnel && !isReordering && !isDuplicating && !isDeleting;
          const isOnlyFunnelPage = funnelEntries.length <= 1;
          const isPublished = status === 'published';
          const isDeleteDisabled = isDuplicating || isDeleting || isReordering || isOnlyFunnelPage || isPublished;
          const deleteTooltip = isPublished
            ? 'This page is published. Unpublish it before deleting it.'
            : isOnlyFunnelPage
              ? 'Cannot delete the only page in this destination'
              : 'Delete page';

          return `
            <div
              class="pb-page-row ${isCurrent ? 'active' : ''}"
              ${isCurrent ? 'aria-current="page"' : ''}
            >
              <button
                type="button"
                class="pb-page-row-select"
                onclick='window.switchBuilderPage(${pageArg})'
                aria-label="Open ${safeName} page"
              >
                <span class="pb-page-row-topline">
                  <span class="pb-page-name">${safeName}</span>
                  ${isCurrent ? '<span class="pb-page-open">Open</span>' : ''}
                </span>
                <span class="pb-page-path">${safePath}</span>
                <span class="pb-page-badges">
                  <span class="pb-page-status ${status === 'published' ? 'published' : 'draft'}">${safeStatus}</span>
                  ${isDraftHomepage ? '<span class="pb-page-homepage-draft" style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">Home (Unpublished)</span>' : isLiveHomepage ? '<span class="pb-page-homepage-live" style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">Home (Live)</span>' : isHomepage ? '<span class="pb-page-homepage">Homepage</span>' : ''}
                  ${routeVM?.hasUnpublishedChanges ? `
                    <span class="pb-page-route-badge ${routeVM.routeStatus}">${escapeBuilderInspectorHtml(routeVM.statusLabel)}</span>
                  ` : ''}
                  ${routeVM?.currentLivePath && routeVM.currentLivePath !== routeVM.effectivePath ? `
                    <small class="pb-page-live-path-sub">Live: ${escapeBuilderInspectorHtml(routeVM.currentLivePath)}</small>
                  ` : ''}
                </span>
              </button>
              <div class="pb-page-row-actions">
                ${isThisConfirming ? `
                  <div class="pb-page-delete-confirm-box" style="display: flex; gap: 4px; align-items: center;">
                    <button
                      type="button"
                      class="pb-page-confirm-delete-button"
                      onclick="event.stopPropagation(); window.confirmDeleteBuilderPage()"
                      aria-label="Confirm delete ${safeName}"
                      style="background: #dc2626; color: #ffffff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      class="pb-page-cancel-delete-button"
                      onclick="event.stopPropagation(); window.cancelDeleteBuilderPage()"
                      aria-label="Cancel delete ${safeName}"
                      style="background: #4b5563; color: #ffffff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer;"
                    >
                      Cancel
                    </button>
                  </div>
                ` : isConfirmingDeleteRoute ? `
                  <div class="pb-page-delete-confirm-box" style="display: flex; gap: 4px; align-items: center;">
                    <button
                      type="button"
                      class="pb-page-confirm-delete-button"
                      onclick="event.stopPropagation(); window.confirmDeleteBuilderPageRoute(${pageArg})"
                      aria-label="Confirm remove URL for ${safeName}"
                      style="background: #dc2626; color: #ffffff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;"
                    >
                      Confirm remove
                    </button>
                    <button
                      type="button"
                      class="pb-page-cancel-delete-button"
                      onclick="event.stopPropagation(); window.cancelDeleteBuilderPageRoute()"
                      aria-label="Cancel remove URL for ${safeName}"
                      style="background: #4b5563; color: #ffffff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer;"
                    >
                      Cancel
                    </button>
                  </div>
                ` : `
                  ${isDraftHomepage || (!website?.draft_homepage_funnel_id && isLiveHomepage) || !page.funnel_id ? '' : `
                    <button
                      type="button"
                      class="pb-page-set-homepage-button"
                      onclick='event.stopPropagation(); window.setBuilderHomepage(${builderInspectorJsArgument(page.funnel_id)})'
                      aria-label="Set ${safeName} destination as homepage"
                      title="Set as homepage"
                      ${isHomepageUpdating || isDuplicating || isDeleting || isReordering ? 'disabled' : ''}
                    >
                      ${isHomepageUpdating && updatingHomepageFunnelId === page.funnel_id ? 'Setting…' : 'Set as homepage'}
                    </button>
                  `}
                  ${routeVM?.hasUnpublishedChanges ? `
                    <button
                      type="button"
                      class="pb-page-revert-route-button"
                      onclick='event.stopPropagation(); window.revertBuilderPageRoute(${pageArg})'
                      aria-label="Revert pending URL for ${safeName}"
                      title="Revert pending URL change"
                      style="background: #374151; color: #f3f4f6; border: 1px solid #4b5563; padding: 3px 7px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;"
                    >
                      Revert URL
                    </button>
                  ` : ''}
                  ${routeVM?.isEditable ? `
                    <button
                      type="button"
                      class="pb-page-edit-route-button"
                      onclick='event.stopPropagation(); window.openBuilderPageRouteEditor(${pageArg})'
                      aria-label="Edit URL for ${safeName}"
                      title="Edit page URL"
                      style="background: #1f2937; color: #93c5fd; border: 1px solid #3b82f6; padding: 3px 7px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;"
                    >
                      Edit URL
                    </button>
                  ` : ''}
                  ${routeVM?.currentLivePath && !routeVM.hasUnpublishedChanges ? `
                    <button
                      type="button"
                      class="pb-page-delete-route-button"
                      onclick='event.stopPropagation(); window.promptDeleteBuilderPageRoute(${pageArg})'
                      aria-label="Remove URL for ${safeName}"
                      title="Stage removal of URL from live site"
                      style="background: transparent; color: #f87171; border: 1px solid #7f1d1d; padding: 3px 7px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;"
                    >
                      Remove URL
                    </button>
                  ` : ''}
                  <button
                    type="button"
                    class="pb-page-move-up-button"
                    onclick='event.stopPropagation(); window.moveBuilderPageUp(${pageArg})'
                    aria-label="Move ${safeName} page up"
                    title="Move page up"
                    ${canMoveUp ? '' : 'disabled'}
                  >
                    ${isThisReordering && reorderController.reorderingDirection === 'up' ? '…' : '↑'}
                  </button>
                  <button
                    type="button"
                    class="pb-page-move-down-button"
                    onclick='event.stopPropagation(); window.moveBuilderPageDown(${pageArg})'
                    aria-label="Move ${safeName} page down"
                    title="Move page down"
                    ${canMoveDown ? '' : 'disabled'}
                  >
                    ${isThisReordering && reorderController.reorderingDirection === 'down' ? '…' : '↓'}
                  </button>
                  <button
                    type="button"
                    class="pb-page-duplicate-button"
                    onclick='event.stopPropagation(); window.duplicateBuilderPage(${pageArg})'
                    aria-label="Duplicate ${safeName} page"
                    title="Duplicate page"
                    ${isDuplicating || isDeleting || isReordering ? 'disabled' : ''}
                  >
                    ${isThisDuplicating ? 'Duplicating…' : 'Duplicate'}
                  </button>
                  <button
                    type="button"
                    class="pb-page-delete-button"
                    onclick='event.stopPropagation(); window.promptDeleteBuilderPage(${pageArg})'
                    aria-label="Delete ${safeName} page"
                    title="${escapeBuilderInspectorHtml(deleteTooltip)}"
                    style="color: #dc2626;"
                    ${isDeleteDisabled ? 'disabled' : ''}
                  >
                    ${isThisDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('') : '<div class="pb-pages-empty"><h4>No pages found</h4><p>Create the first draft page for an existing destination.</p></div>'}
      </div>
      `}
    </div>
  `;
}

function builderNewPageIssue(field: BuilderNewPageValidationField): string {
  return getBuilderNewPageController().issues.find(issue => issue.field === field)?.message ?? '';
}

function renderBuilderNewPageDialog(): string {
  const controller = getBuilderNewPageController();
  if (controller.status === 'closed' || builderMode !== 'edit') return '';
  const destinations = controller.destinations;
  const selected = destinations.find(item => item.key === controller.input.destinationKey);
  const plannedPath = controller.plannedPath;
  const pathLabel = plannedPath ?? 'No matching existing route';
  const issue = (field: BuilderNewPageValidationField) => builderNewPageIssue(field);
  return `
    <div class="pb-new-page-backdrop" onclick="if(event.target===this) window.closeBuilderNewPageDialog()">
      <section class="pb-new-page-dialog" role="dialog" aria-modal="true" aria-labelledby="pb-new-page-title" aria-describedby="pb-new-page-description">
        <header>
          <div>
            <span>Pages</span>
            <h2 id="pb-new-page-title">New page</h2>
            <p id="pb-new-page-description">Create an empty draft inside an existing website destination.</p>
          </div>
          <button type="button" class="pb-new-page-close" aria-label="Close new page dialog" onclick="window.closeBuilderNewPageDialog()" ${controller.isCreating ? 'disabled' : ''}>×</button>
        </header>
        <form onsubmit="event.preventDefault(); window.submitBuilderNewPage()" novalidate>
          <div class="pb-new-page-body">
            <div class="pb-new-page-field">
              <label for="pb-new-page-name">Page name</label>
              <input id="pb-new-page-name" type="text" maxlength="${BUILDER_PAGE_NAME_MAX_LENGTH}" value="${escapeBuilderInspectorHtml(controller.input.name)}" aria-invalid="${!!issue('name')}" aria-describedby="pb-new-page-name-error" oninput="window.updateBuilderNewPageName(this.value)" ${controller.isCreating ? 'disabled' : ''}>
              <p id="pb-new-page-name-error" class="pb-new-page-error" role="alert">${escapeBuilderInspectorHtml(issue('name'))}</p>
            </div>
            <div class="pb-new-page-field">
              <label for="pb-new-page-slug">URL slug</label>
              <div class="pb-new-page-slug"><span>/</span><input id="pb-new-page-slug" type="text" maxlength="${BUILDER_PAGE_SLUG_MAX_LENGTH}" value="${escapeBuilderInspectorHtml(controller.input.slug)}" aria-invalid="${!!issue('slug')}" aria-describedby="pb-new-page-slug-help pb-new-page-slug-error" oninput="window.updateBuilderNewPageSlug(this.value)" ${controller.isCreating ? 'disabled' : ''}></div>
              <small id="pb-new-page-slug-help">A matching WebsiteRoute must already exist. Creating this page will not create a route.</small>
              <p id="pb-new-page-slug-error" class="pb-new-page-error" role="alert">${escapeBuilderInspectorHtml(issue('slug'))}</p>
            </div>
            <div class="pb-new-page-field">
              <label for="pb-new-page-destination">Destination</label>
              ${destinations.length > 1 ? `
                <select id="pb-new-page-destination" onchange="window.updateBuilderNewPageDestination(this.value)" aria-invalid="${!!issue('destination')}" aria-describedby="pb-new-page-destination-error" ${controller.isCreating ? 'disabled' : ''}>
                  ${destinations.map(destination => `<option value="${escapeBuilderInspectorHtml(destination.key)}" ${destination.key === controller.input.destinationKey ? 'selected' : ''}>${escapeBuilderInspectorHtml(destination.label)}</option>`).join('')}
                </select>
              ` : `<div id="pb-new-page-destination" class="pb-new-page-destination-readonly">${escapeBuilderInspectorHtml(selected?.label ?? 'No available destination')}</div>`}
              <p id="pb-new-page-destination-error" class="pb-new-page-error" role="alert">${escapeBuilderInspectorHtml(issue('destination'))}</p>
            </div>
            <div class="pb-new-page-path-preview">
              <span>Planned page path</span>
              <code id="pb-new-page-path-value">${escapeBuilderInspectorHtml(pathLabel)}</code>
              <small id="pb-new-page-path-help">${plannedPath ? 'This path is backed by an existing route. It is not live until publication requirements are met.' : 'Choose a slug that exactly matches a route in this destination.'}</small>
            </div>
            <p class="pb-new-page-status" role="status" aria-live="polite">${escapeBuilderInspectorHtml(controller.message)}</p>
          </div>
          <footer>
            <button type="button" class="pb-new-page-cancel" onclick="window.closeBuilderNewPageDialog()" ${controller.isCreating ? 'disabled' : ''}>Cancel</button>
            <button type="submit" class="pb-new-page-create" ${controller.isCreating || !destinations.length ? 'disabled' : ''}>${controller.isCreating ? 'Creating…' : controller.status === 'error' ? 'Retry create' : 'Create page'}</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function renderBuilderPageRouteEditorDialog(): string {
  const website = getActiveBuilderWebsite();
  const controller = getBuilderPageRouteController();
  const state = controller.getState();
  if (!state.isEditing || !website || builderMode !== 'edit') return '';
  const page = mockPages.find(p => p.id === state.editingPageId);
  if (!page) return '';

  const routeVM = controller.getPageRoute(page, website);
  const host = website.domain || (website.subdomain ? `${website.subdomain}.pressurepro.io` : 'your-site.example');
  const issue = state.editingValidationIssue || state.stagingError;

  return `
    <div class="pb-page-route-dialog-backdrop" onclick="if(event.target===this) window.closeBuilderPageRouteEditor()">
      <section class="pb-page-route-dialog" role="dialog" aria-modal="true" aria-labelledby="pb-route-editor-title" aria-describedby="pb-route-editor-description">
        <header>
          <div>
            <span>Page Routing</span>
            <h2 id="pb-route-editor-title">Edit Page URL</h2>
            <p id="pb-route-editor-description">Staging a new URL creates an unpublished route draft. Live website routing does not change until published.</p>
          </div>
          <button type="button" class="pb-new-page-close" aria-label="Close route editor dialog" onclick="window.closeBuilderPageRouteEditor()" ${state.isStaging ? 'disabled' : ''}>×</button>
        </header>
        <form onsubmit="event.preventDefault(); window.submitBuilderPageRoute()" novalidate>
          <div class="pb-new-page-body">
            ${routeVM.currentLivePath ? `
              <div class="pb-page-route-live-preview">
                <span class="pb-page-route-live-label">Current live URL</span>
                <code class="pb-page-route-live-val">https://${escapeBuilderInspectorHtml(host)}${escapeBuilderInspectorHtml(routeVM.currentLivePath)}</code>
              </div>
            ` : ''}
            <div class="pb-new-page-field">
              <label for="pb-page-route-input">New page URL</label>
              <div class="pb-new-page-slug">
                <span>/</span>
                <input
                  id="pb-page-route-input"
                  type="text"
                  maxlength="256"
                  value="${escapeBuilderInspectorHtml(state.editingInputPath.replace(/^\/+/, ''))}"
                  aria-invalid="${!!issue}"
                  aria-describedby="pb-page-route-help pb-page-route-error"
                  oninput="window.updateBuilderPageRouteInput(this.value)"
                  ${state.isStaging ? 'disabled' : ''}
                  placeholder="e.g. pressure-washing"
                >
              </div>
              <small id="pb-page-route-help">Lowercase letters, numbers, and hyphens. Changing a published URL automatically creates a permanent redirect from the old URL after publishing.</small>
              <p id="pb-page-route-error" class="pb-new-page-error" role="alert">${escapeBuilderInspectorHtml(issue ?? '')}</p>
            </div>
            <div class="pb-new-page-path-preview">
              <span>Normalized effective path</span>
              <code id="pb-page-route-preview-val">${escapeBuilderInspectorHtml(state.normalizedEditingPath || '/')}</code>
            </div>
          </div>
          <footer>
            <button type="button" class="pb-new-page-cancel" onclick="window.closeBuilderPageRouteEditor()" ${state.isStaging ? 'disabled' : ''}>Cancel</button>
            <button type="submit" class="pb-new-page-create" ${state.isStaging || !state.normalizedEditingPath || !!state.editingValidationIssue ? 'disabled' : ''}>
              ${state.isStaging ? 'Saving URL…' : 'Save URL'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function renderBuilderRoutePublishModal(): string {
  const website = getActiveBuilderWebsite();
  const controller = getBuilderPageRouteController();
  const state = controller.getState();
  if (!state.isConfirmingPublish || !website || builderMode !== 'edit') return '';

  const pendingDrafts = controller.getPendingDrafts();
  const isPublishing = state.publicationState.status === 'publishing';
  const errorMessage = state.publicationState.errorMessage;

  return `
    <div class="pb-route-publish-modal-backdrop" onclick="if(event.target===this) window.closeBuilderRoutePublishModal()">
      <section class="pb-route-publish-modal" role="dialog" aria-modal="true" aria-labelledby="pb-route-publish-title" aria-describedby="pb-route-publish-desc">
        <header>
          <div>
            <span>Website Routing</span>
            <h2 id="pb-route-publish-title">Publish URL Changes</h2>
            <p id="pb-route-publish-desc">Promote staged URL drafts to the live public website.</p>
          </div>
          <button type="button" class="pb-new-page-close" aria-label="Close publish modal" onclick="window.closeBuilderRoutePublishModal()" ${isPublishing ? 'disabled' : ''}>×</button>
        </header>
        <div class="pb-route-publish-body">
          <div class="pb-route-publish-summary">
            <h4>Pending Route Changes (${pendingDrafts.length})</h4>
            <ul class="pb-route-publish-list">
              ${pendingDrafts.map(d => {
                if (d.is_staged_delete) {
                  return `<li class="pb-route-change-delete"><span class="badge">Remove</span> <code>${escapeBuilderInspectorHtml(d.live_path || d.path)}</code> <small>(Will be removed from live site)</small></li>`;
                }
                if (d.is_new_draft) {
                  return `<li class="pb-route-change-create"><span class="badge">New</span> <code>${escapeBuilderInspectorHtml(d.path)}</code></li>`;
                }
                return `<li class="pb-route-change-rename"><span class="badge">Rename</span> <code>${escapeBuilderInspectorHtml(d.live_path || '')}</code> → <strong>${escapeBuilderInspectorHtml(d.path)}</strong> <small>(Old URL will redirect automatically)</small></li>`;
              }).join('')}
            </ul>
          </div>
          ${errorMessage ? `
            <div class="pb-route-publish-error" role="alert" style="background: #fef2f2; color: #991b1b; padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; margin-top: 12px; border: 1px solid #fecaca;">
              ${escapeBuilderInspectorHtml(errorMessage)}
            </div>
          ` : ''}
        </div>
        <footer>
          <button type="button" class="pb-new-page-cancel" onclick="window.closeBuilderRoutePublishModal()" ${isPublishing ? 'disabled' : ''}>Cancel</button>
          <button type="button" class="pb-new-page-create" onclick="window.confirmBuilderRoutePublish()" ${isPublishing ? 'disabled' : ''}>
            ${isPublishing ? 'Publishing…' : 'Publish URL changes'}
          </button>
        </footer>
      </section>
    </div>
  `;
}

(window as any).openBuilderNewPageDialog = () => {
  const controller = getBuilderNewPageController();
  if (controller.isCreating || !controller.destinations.length) return;
  controller.open();
  document.body.classList.add('pb-new-page-modal-open');
  renderBuilder();
  setTimeout(() => document.getElementById('pb-new-page-name')?.focus(), 0);
};

(window as any).closeBuilderNewPageDialog = () => {
  if (!getBuilderNewPageController().cancel()) return;
  document.body.classList.remove('pb-new-page-modal-open');
  renderBuilder();
  setTimeout(() => document.querySelector<HTMLElement>('.pb-new-page-button')?.focus(), 0);
};

function updateBuilderNewPageLiveFields(): void {
  const controller = getBuilderNewPageController();
  const slugInput = document.getElementById('pb-new-page-slug') as HTMLInputElement | null;
  if (slugInput && slugInput.value !== controller.input.slug) slugInput.value = controller.input.slug;
  const path = document.getElementById('pb-new-page-path-value');
  if (path) path.textContent = controller.plannedPath ?? 'No matching existing route';
  const pathHelp = document.getElementById('pb-new-page-path-help');
  if (pathHelp) pathHelp.textContent = controller.plannedPath
    ? 'This path is backed by an existing route. It is not live until publication requirements are met.'
    : 'Choose a slug that exactly matches a route in this destination.';
  for (const field of ['name', 'slug', 'destination'] as BuilderNewPageValidationField[]) {
    const error = document.getElementById(`pb-new-page-${field}-error`);
    if (error) error.textContent = builderNewPageIssue(field);
    document.getElementById(`pb-new-page-${field}`)?.setAttribute('aria-invalid', builderNewPageIssue(field) ? 'true' : 'false');
  }
}

(window as any).updateBuilderNewPageName = (value: string) => {
  getBuilderNewPageController().updateName(value);
  updateBuilderNewPageLiveFields();
};
(window as any).updateBuilderNewPageSlug = (value: string) => {
  getBuilderNewPageController().updateSlug(value);
  updateBuilderNewPageLiveFields();
};
(window as any).updateBuilderNewPageDestination = (value: string) => {
  getBuilderNewPageController().updateDestination(value);
  renderBuilder();
  setTimeout(() => document.getElementById('pb-new-page-destination')?.focus(), 0);
};
(window as any).submitBuilderNewPage = async () => {
  const controller = getBuilderNewPageController();
  const pending = controller.create();
  renderBuilder();
  const created = await pending;
  renderBuilder();
  if (created) {
    (window as any).showToast('Draft page created', 'success');
    setTimeout(() => document.querySelector<HTMLElement>('.pb-page-row[aria-current="page"]')?.focus(), 0);
    return;
  }
  const firstIssue = controller.issues[0]?.field;
  setTimeout(() => document.getElementById(`pb-new-page-${firstIssue ?? 'name'}`)?.focus(), 0);
};
(window as any).duplicateBuilderPage = async (pageId: string) => {
  const controller = getBuilderDuplicatePageController();
  if (controller.isDuplicating) return;
  const pending = controller.duplicate(pageId);
  renderBuilder();
  const succeeded = await pending;
  renderBuilder();
  if (succeeded) {
    (window as any).showToast('Page duplicated', 'success');
    setTimeout(() => document.querySelector<HTMLElement>('.pb-page-row[aria-current="page"]')?.focus(), 0);
  } else if (controller.message) {
    (window as any).showToast(controller.message, 'error');
  }
};

function isBuilderInspectorPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mergeBuilderInspectorPatch(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = isBuilderInspectorPlainObject(existing)
    ? { ...existing }
    : {};

  for (const [key, patchValue] of Object.entries(patch)) {
    const existingValue = result[key];
    result[key] = isBuilderInspectorPlainObject(existingValue)
      && isBuilderInspectorPlainObject(patchValue)
      ? mergeBuilderInspectorPatch(existingValue, patchValue)
      : structuredClone(patchValue);
  }

  return result;
}

(window as any).setBuilderInspectorTab = (tab: BuilderInspectorTab) => {
  if (builderInspectorTab === tab) return;
  builderInspectorTab = tab;
  renderBuilder();
};

(window as any).updateBuilderInspectorField = (
  sectionId: string,
  fieldId: string,
  submittedValue: unknown
) => {
  const section = getCurrentBuilderSections().find(item => item.id === sectionId);
  if (!section) return;
  const field = getBuilderInspectorField(section.type, fieldId);
  if (!field || field.control === 'collection') return;

  let value: unknown;
  if (field.control === 'toggle') {
    value = submittedValue === true || submittedValue === 'true';
  } else if (field.control === 'number') {
    if (submittedValue === '' || submittedValue === null) return;
    const numericValue = Number(submittedValue);
    if (!Number.isFinite(numericValue)) return;
    value = numericValue;
  } else {
    value = String(submittedValue ?? '');
  }

  try {
    const patch = createBuilderInspectorPatch(field, value);
    applyLiveBuilderMutation(document => ({
      ...document,
      sections: document.sections.map(currentSection => {
        if (currentSection.id !== sectionId) return currentSection;
        const nextSection = {
          ...currentSection,
          content: patch.content
            ? mergeBuilderInspectorPatch(currentSection.content, patch.content)
            : currentSection.content,
          styles: patch.styles
            ? mergeBuilderInspectorPatch(currentSection.styles, patch.styles)
            : currentSection.styles
        };
        if (patch.variant === null) {
          delete nextSection.variant;
        } else if (patch.variant !== undefined) {
          nextSection.variant = patch.variant;
        }
        return nextSection;
      })
    }), {
      category: field.source === 'content'
        ? 'content'
        : field.source === 'styles'
          ? 'design'
          : 'layout',
      sectionId,
      fieldId,
      coalesce: field.control !== 'select' && field.control !== 'toggle'
    });
  } catch (error) {
    console.error(
      `[Builder Inspector] Failed to update field "${fieldId}" on section "${sectionId}".`,
      error
    );
  }
};

function getBuilderSetupIdentity(): string {
  const website = getActiveBuilderWebsite();
  const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
  return `${userId}:${website?.id ?? ''}:${builderPageId}`;
}

function builderSetupAssets(): BuilderMediaAsset[] {
  const website = getActiveBuilderWebsite();
  return (builderMediaController?.state.assets ?? []).filter(asset => asset.websiteId === website?.id);
}

function createBuilderSetupDraft(): BuilderSetupWizardDraft {
  const page = mockPages.find(item => item.id === builderPageId)!;
  const website = getActiveBuilderWebsite()!;
  const stored = parseBuilderSetupBrief(mockWebsiteSettings.build_brief, {
    activeWebsiteId: website.id,
    activePageId: page.id
  });
  const settingsServices = (mockWebsiteSettings.services_offered ?? []).flatMap(label => {
    const known = BUILDER_SETUP_SERVICE_CATALOG.find(item => item.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    return [{ id: known?.id ?? `custom-${label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, ...(known ? {} : { custom: true }) }];
  });
  const services = stored?.services.length ? structuredClone(stored.services) : settingsServices.length ? settingsServices : [{ id: 'driveway-cleaning', label: 'Driveway cleaning' }];
  const pageContext = getBuilderWebsitePageEntries().find(entry => entry.page.id === page.id);
  return {
    identity: getBuilderSetupIdentity(),
    step: 1,
    templateId: stored?.templateId ?? (pageContext?.isHomepage ? 'balanced-services' : 'compact-quote-page'),
    businessName: stored?.businessName ?? mockWebsiteSettings.business_name ?? website.name,
    serviceArea: stored?.serviceArea ?? (mockWebsiteSettings.cities_served ?? []).join(', '),
    publicPhone: stored?.publicPhone ?? mockWebsiteSettings.phone ?? '',
    publicEmail: stored?.publicEmail ?? mockWebsiteSettings.email ?? '',
    customerType: stored?.customerType ?? 'both',
    primaryGoal: stored?.primaryGoal ?? 'request-quote',
    positioningStatement: stored?.positioningStatement ?? '',
    services,
    primaryServiceId: stored?.primaryServiceId ?? services[0].id,
    trustSignals: stored?.trustSignals ?? { insured: false, workplaceCoverage: false, locallyOwned: false, freeEstimates: false, satisfactionGuarantee: false, ecoConsciousOptions: false, commerciallyEquipped: false },
    yearsInBusiness: stored?.yearsInBusiness?.toString() ?? '',
    reviewRating: stored?.reviewRating?.toString() ?? '',
    reviewCount: stored?.reviewCount?.toString() ?? '',
    customTrustStatement: stored?.customTrustStatement ?? '',
    stylePreset: stored?.stylePreset ?? 'clean-professional',
    primaryColor: stored?.primaryColor ?? mockWebsiteSettings.primary_color ?? '#2563eb',
    accentColor: stored?.accentColor ?? '#f59e0b',
    heroAssetId: stored?.heroAsset?.id ?? '',
    galleryAssetIds: stored?.galleryAssets.map(asset => asset.id) ?? [],
    assetAltText: Object.fromEntries([...(stored?.heroAsset ? [stored.heroAsset] : []), ...(stored?.galleryAssets ?? [])].map(asset => [asset.id, asset.altText])),
    mode: getCurrentBuilderSections().length === 0 ? 'replace' : null,
    applySeoMetadata: true,
    replaceConfirmed: false
  };
}

function buildBuilderSetupBrief(): BuilderSetupBriefV1 | null {
  const draft = builderSetupDraft;
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(item => item.id === builderPageId);
  if (!draft || !website || !page) return null;
  const assets = new Map(builderSetupAssets().map(asset => [asset.id, asset]));
  const reference = (id: string) => {
    const asset = assets.get(id);
    return asset ? { id: asset.id, websiteId: asset.websiteId, publicUrl: asset.publicUrl, altText: draft.assetAltText[id] ?? '' } : undefined;
  };
  const pageContext = getBuilderWebsitePageEntries().find(entry => entry.page.id === page.id);
  return {
    schemaVersion: 1,
    templateId: draft.templateId,
    businessName: draft.businessName,
    serviceArea: draft.serviceArea,
    ...(draft.publicPhone.trim() ? { publicPhone: draft.publicPhone } : {}),
    ...(draft.publicEmail.trim() ? { publicEmail: draft.publicEmail } : {}),
    customerType: draft.customerType,
    primaryGoal: draft.primaryGoal,
    ...(draft.positioningStatement.trim() ? { positioningStatement: draft.positioningStatement } : {}),
    services: structuredClone(draft.services),
    primaryServiceId: draft.primaryServiceId,
    trustSignals: structuredClone(draft.trustSignals),
    ...(draft.yearsInBusiness ? { yearsInBusiness: Number(draft.yearsInBusiness) } : {}),
    ...(draft.reviewRating ? { reviewRating: Number(draft.reviewRating) } : {}),
    ...(draft.reviewCount ? { reviewCount: Number(draft.reviewCount) } : {}),
    ...(draft.customTrustStatement.trim() ? { customTrustStatement: draft.customTrustStatement } : {}),
    stylePreset: draft.stylePreset,
    ...(draft.primaryColor.trim() ? { primaryColor: draft.primaryColor } : {}),
    ...(draft.accentColor.trim() ? { accentColor: draft.accentColor } : {}),
    ...(draft.heroAssetId && reference(draft.heroAssetId) ? { heroAsset: reference(draft.heroAssetId) } : {}),
    galleryAssets: draft.galleryAssetIds.flatMap(id => reference(id) ?? []),
    activePageContext: { pageId: page.id, websiteId: website.id, pageName: page.name, slug: page.slug, isHomepage: pageContext?.isHomepage === true }
  };
}

async function persistBuilderSetupPagePatch(
  pageId: string,
  patch: BuilderPageSettingsPatch,
  operation?: ProtectedAsyncOperationToken
): Promise<boolean> {
  if (!Object.keys(patch).length) return true;
  try {
    const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    const result = await response.json();
    if (!response.ok || result.success !== true || !result.data) return false;
    if (operation) protectedAsyncOperationGuard.requireCurrent(operation, getActingUserId());
    const index = mockPages.findIndex(page => page.id === pageId);
    if (index >= 0) mockPages[index] = applyBuilderPageSettings(mockPages[index], pageToBuilderPageSettings(result.data));
    if (index >= 0 && builderHistoryController?.pageId === pageId) builderHistoryController.synchronizePageMetadata(mockPages[index]);
    return true;
  } catch { return false; }
}

function createLiveBuilderSetupController(): BuilderSetupController | null {
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(item => item.id === builderPageId);
  const history = getBuilderHistoryController();
  if (!website || !page || !history) return null;
  const setupOperation = protectedAsyncOperationGuard.begin(`builder-setup:${website.id}:${page.id}`, getActingUserId());
  const setupIsCurrent = () => protectedAsyncOperationGuard.isCurrent(setupOperation, getActingUserId());
  return new BuilderSetupController({
    getContext: () => ({
      websiteId: getActiveBuilderWebsite()?.id ?? '',
      pageId: builderPageId,
      actingUserId: typeof (window as any).currentUser === 'string' ? (window as any).currentUser : '',
      document: getCurrentBuilderDocument()!,
      availableAssetIds: builderSetupAssets().map(asset => asset.id),
      previousPageSettings: (() => {
        const settings = pageToBuilderPageSettings(mockPages.find(item => item.id === builderPageId)!);
        return { seo_title: settings.seo_title, seo_description: settings.seo_description };
      })(),
      previousBuildBrief: mockWebsiteSettings.build_brief
    }),
    persistence: {
      persistPageSettings: (pageId, patch) => persistBuilderSetupPagePatch(pageId, patch, setupOperation),
      applyDocument: document => setupIsCurrent()
        && applyLiveBuilderMutation(current => ({ ...current, sections: structuredClone(document.sections) }), { category: 'structural', fieldId: 'guided-setup', coalesce: false, selectSectionId: document.sections[0]?.id ?? null }, { autosave: false, render: false }),
      persistDocument: async () => {
        if (!setupIsCurrent()) return false;
        const saved = await (window as any).savePageSections() === true;
        return setupIsCurrent() && saved;
      },
      restoreDocument: () => {
        if (!setupIsCurrent()) return false;
        const active = getBuilderHistoryController();
        if (!active?.undo()) return false;
        syncBuilderDocumentToPageSections(active.document);
        return true;
      },
      persistBuildBrief: async (_websiteId, brief) => {
        try {
          const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ build_brief: brief }) });
          const result = await response.json();
          if (!response.ok || result.success !== true) return false;
          protectedAsyncOperationGuard.requireCurrent(setupOperation, getActingUserId());
          mockWebsiteSettings.build_brief = brief as any;
          return true;
        } catch { return false; }
      }
    }
  });
}

function builderSetupStepIssues(): string[] {
  const brief = buildBuilderSetupBrief();
  if (!brief) return ['Guided setup is unavailable.'];
  const issues = validateBuilderSetupBrief(brief, { activeWebsiteId: brief.activePageContext.websiteId, activePageId: brief.activePageContext.pageId });
  const fieldsByStep: Record<number, string[]> = {
    1: ['templateId', 'businessName', 'serviceArea', 'publicPhone', 'publicEmail', 'customerType', 'primaryGoal', 'positioningStatement'],
    2: ['services', 'primaryServiceId'],
    3: ['trustSignals', 'yearsInBusiness', 'reviewRating', 'reviewCount', 'customTrustStatement', 'stylePreset', 'primaryColor', 'accentColor', 'colors', 'assets'],
    4: []
  };
  return issues.filter(issue => fieldsByStep[builderSetupDraft?.step ?? 1].includes(issue.field)).map(issue => issue.message);
}

function renderBuilderSetupDialog(): string {
  const draft = builderSetupDraft;
  if (!builderSetupWizardOpen || !draft || builderMode !== 'edit') return '';
  const controller = builderSetupController;
  const assets = builderSetupAssets();
  const plan = controller?.plan;
  const issueHtml = controller?.message ? `<p class="pb-setup-message ${controller.status}">${escapeBuilderInspectorHtml(controller.message)}</p>` : '';
  const checked = (value: boolean) => value ? 'checked' : '';
  const businessStep = `
    <div class="pb-setup-grid">
      <label>Business display name<input value="${escapeBuilderInspectorHtml(draft.businessName)}" maxlength="120" oninput="window.updateBuilderSetupField('businessName',this.value)"></label>
      <label>Primary service area<input value="${escapeBuilderInspectorHtml(draft.serviceArea)}" maxlength="150" oninput="window.updateBuilderSetupField('serviceArea',this.value)"></label>
      <label>Public phone (optional)<input value="${escapeBuilderInspectorHtml(draft.publicPhone)}" maxlength="50" oninput="window.updateBuilderSetupField('publicPhone',this.value)"></label>
      <label>Public email (optional)<input type="email" value="${escapeBuilderInspectorHtml(draft.publicEmail)}" maxlength="254" oninput="window.updateBuilderSetupField('publicEmail',this.value)"></label>
      <label>Primary customer type<select onchange="window.updateBuilderSetupField('customerType',this.value)"><option value="residential" ${draft.customerType === 'residential' ? 'selected' : ''}>Residential</option><option value="commercial-strata" ${draft.customerType === 'commercial-strata' ? 'selected' : ''}>Commercial / strata</option><option value="both" ${draft.customerType === 'both' ? 'selected' : ''}>Both</option></select></label>
      <label>Primary page goal<select onchange="window.updateBuilderSetupField('primaryGoal',this.value)"><option value="request-quote" ${draft.primaryGoal === 'request-quote' ? 'selected' : ''}>Request a quote</option><option value="call-business" ${draft.primaryGoal === 'call-business' ? 'selected' : ''}>Call the business</option><option value="learn-services" ${draft.primaryGoal === 'learn-services' ? 'selected' : ''}>Learn about services</option></select></label>
      <label class="wide">Short positioning statement (optional)<textarea maxlength="220" oninput="window.updateBuilderSetupField('positioningStatement',this.value)">${escapeBuilderInspectorHtml(draft.positioningStatement)}</textarea></label>
    </div>
    <fieldset class="pb-setup-templates"><legend>Page template</legend>${BUILDER_SETUP_TEMPLATES.map(template => `<label class="${draft.templateId === template.id ? 'selected' : ''}"><input type="radio" name="setup-template" value="${template.id}" ${checked(draft.templateId === template.id)} onchange="window.updateBuilderSetupField('templateId',this.value)"><strong>${escapeBuilderInspectorHtml(template.name)}</strong><span>${escapeBuilderInspectorHtml(template.description)}</span></label>`).join('')}</fieldset>`;
  const servicesStep = `
    <fieldset class="pb-setup-options"><legend>Services offered</legend>${BUILDER_SETUP_SERVICE_CATALOG.map(service => { const selected = draft.services.some(item => item.id === service.id); return `<label><input type="checkbox" ${checked(selected)} onchange="window.toggleBuilderSetupService('${service.id}',this.checked)"><span>${escapeBuilderInspectorHtml(service.label)}</span>${selected ? `<input type="radio" name="primary-service" aria-label="Make ${escapeBuilderInspectorHtml(service.label)} primary" ${checked(draft.primaryServiceId === service.id)} onchange="window.setBuilderSetupPrimaryService('${service.id}')">` : ''}</label>`; }).join('')}</fieldset>
    <div class="pb-setup-custom"><label for="pb-setup-custom-service">Custom service</label><div><input id="pb-setup-custom-service" maxlength="80" placeholder="Add a custom service"><button type="button" onclick="window.addBuilderSetupCustomService()">Add</button></div>${draft.services.filter(service => service.custom).map(service => `<button type="button" class="pb-setup-chip" onclick="window.removeBuilderSetupService('${service.id}')">${escapeBuilderInspectorHtml(service.label)} ×</button>`).join('')}</div>`;
  const trustKeys: Array<[keyof BuilderSetupBriefV1['trustSignals'], string]> = [['insured','Insured'],['workplaceCoverage','WorkSafe or equivalent coverage'],['locallyOwned','Locally owned'],['freeEstimates','Free estimates'],['satisfactionGuarantee','Satisfaction guarantee'],['ecoConsciousOptions','Eco-conscious options'],['commerciallyEquipped','Commercially equipped']];
  const trustStep = `
    <fieldset class="pb-setup-options"><legend>Confirmed trust signals</legend>${trustKeys.map(([key,label]) => `<label><input type="checkbox" ${checked(draft.trustSignals[key])} onchange="window.toggleBuilderSetupTrust('${key}',this.checked)"><span>${label}</span></label>`).join('')}</fieldset>
    <div class="pb-setup-grid"><label>Years in business (optional)<input type="number" min="1" max="200" value="${draft.yearsInBusiness}" oninput="window.updateBuilderSetupField('yearsInBusiness',this.value)"></label><label>Review rating (optional)<input type="number" min="1" max="5" step="0.1" value="${draft.reviewRating}" oninput="window.updateBuilderSetupField('reviewRating',this.value)"></label><label>Review count (with rating)<input type="number" min="1" max="10000000" value="${draft.reviewCount}" oninput="window.updateBuilderSetupField('reviewCount',this.value)"></label><label>Custom trust statement<input maxlength="140" value="${escapeBuilderInspectorHtml(draft.customTrustStatement)}" oninput="window.updateBuilderSetupField('customTrustStatement',this.value)"></label><label>Visual style<select onchange="window.updateBuilderSetupField('stylePreset',this.value)"><option value="clean-professional" ${draft.stylePreset === 'clean-professional' ? 'selected' : ''}>Clean and professional</option><option value="bold-high-contrast" ${draft.stylePreset === 'bold-high-contrast' ? 'selected' : ''}>Bold and high contrast</option><option value="friendly-local" ${draft.stylePreset === 'friendly-local' ? 'selected' : ''}>Friendly and local</option></select></label><label>Primary colour<input type="color" value="${escapeBuilderInspectorHtml(draft.primaryColor)}" onchange="window.updateBuilderSetupField('primaryColor',this.value)"></label><label>Accent colour<input type="color" value="${escapeBuilderInspectorHtml(draft.accentColor)}" onchange="window.updateBuilderSetupField('accentColor',this.value)"></label></div>
    <section class="pb-setup-assets"><h3>Optional durable images</h3><p>Local browser-only images cannot be applied until uploaded to remote media.</p>${assets.length ? assets.map(asset => { const durable = /^https:\/\//i.test(asset.publicUrl) && !/[?&](token|apikey|signature)=/i.test(asset.publicUrl); return `<div class="pb-setup-asset ${durable ? '' : 'disabled'}"><img src="${escapeBuilderInspectorHtml(asset.publicUrl)}" alt=""><span>${escapeBuilderInspectorHtml(asset.displayName)}</span><label><input type="radio" name="hero-asset" ${checked(draft.heroAssetId === asset.id)} ${durable ? '' : 'disabled'} onchange="window.selectBuilderSetupHeroAsset('${asset.id}')"> Hero</label><label><input type="checkbox" ${checked(draft.galleryAssetIds.includes(asset.id))} ${durable ? '' : 'disabled'} onchange="window.toggleBuilderSetupGalleryAsset('${asset.id}',this.checked)"> Gallery</label>${durable && (draft.heroAssetId === asset.id || draft.galleryAssetIds.includes(asset.id)) ? `<input maxlength="200" placeholder="Alt text (optional)" value="${escapeBuilderInspectorHtml(draft.assetAltText[asset.id] ?? '')}" oninput="window.setBuilderSetupAssetAlt('${asset.id}',this.value)">` : ''}${durable ? '' : '<small>Upload this image to remote media before using it in a publishable page.</small>'}</div>`; }).join('') : '<p>No media selected. You can continue without images.</p>'}</section>`;
  const reviewStep = `
    <section class="pb-setup-review"><h3>Review page setup</h3><p>The public site remains unchanged until you publish.</p>${getCurrentBuilderSections().length ? `<fieldset><legend>How should setup apply?</legend><label><input type="radio" name="setup-mode" value="append" ${checked(draft.mode === 'append')} onchange="window.setBuilderSetupMode('append')"> Add generated sections after the ${getCurrentBuilderSections().length} existing sections</label><label><input type="radio" name="setup-mode" value="replace" ${checked(draft.mode === 'replace')} onchange="window.setBuilderSetupMode('replace')"> Replace current sections</label>${draft.mode === 'replace' ? `<label class="pb-setup-warning"><input type="checkbox" ${checked(draft.replaceConfirmed)} onchange="window.confirmBuilderSetupReplace(this.checked)"> This will replace the current page sections. You can undo it during this editing session.</label>` : ''}</fieldset>` : '<p>This empty page will be populated with generated sections.</p>'}<label class="pb-setup-seo"><input type="checkbox" ${checked(draft.applySeoMetadata)} onchange="window.toggleBuilderSetupSeo(this.checked)"> Apply generated SEO title and description</label>${plan ? `<dl><div><dt>Template</dt><dd>${escapeBuilderInspectorHtml(plan.summary.templateName)}</dd></div><div><dt>Sections</dt><dd>${plan.summary.sectionTypes.map(type => escapeBuilderInspectorHtml(type)).join(' → ')}</dd></div><div><dt>Services</dt><dd>${plan.summary.services.map(value => escapeBuilderInspectorHtml(value)).join(', ')}</dd></div><div><dt>Trust signals</dt><dd>${plan.summary.trustSignals.length ? plan.summary.trustSignals.map(value => escapeBuilderInspectorHtml(value)).join(', ') : 'None — Proof omitted'}</dd></div><div><dt>Images</dt><dd>${plan.summary.assetIds.length}</dd></div><div><dt>Page metadata</dt><dd>${plan.pageSettingsPatch ? 'SEO title and description' : 'No changes'}</dd></div><div><dt>Website settings</dt><dd>Versioned internal build brief only</dd></div></dl><p class="pb-setup-session-warning">Undo is available during this editing session. Saved publication versions remain unchanged.</p>` : '<p class="pb-setup-message">Choose an application mode to create the page preview.</p>'}</section>`;
  const body = draft.step === 1 ? businessStep : draft.step === 2 ? servicesStep : draft.step === 3 ? trustStep : reviewStep;
  const applying = controller?.status === 'applying';
  const canApply = draft.step === 4 && !!plan && !applying && (draft.mode !== 'replace' || getCurrentBuilderSections().length === 0 || draft.replaceConfirmed);
  return `<div class="pb-setup-backdrop"><section class="pb-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="pb-setup-title"><header><div><span>Guided setup · Step ${draft.step} of 4</span><h2 id="pb-setup-title">${['Business','Business','Services','Trust and style','Review'][draft.step]}</h2></div><button type="button" aria-label="Close guided setup" onclick="window.closeBuilderSetup()" ${applying ? 'disabled' : ''}>×</button></header><div class="pb-setup-progress" aria-label="Step ${draft.step} of 4"><i style="width:${draft.step * 25}%"></i></div><div class="pb-setup-body">${body}${issueHtml}<div id="pb-setup-live" role="status" aria-live="polite" class="sr-only">${applying ? 'Saving page setup…' : ''}</div></div><footer><button type="button" onclick="window.closeBuilderSetup()" ${applying ? 'disabled' : ''}>Cancel</button><span></span>${draft.step > 1 ? `<button type="button" onclick="window.previousBuilderSetupStep()" ${applying ? 'disabled' : ''}>Back</button>` : ''}${draft.step < 4 ? '<button type="button" class="primary" onclick="window.nextBuilderSetupStep()">Next</button>' : `<button type="button" class="primary" onclick="window.applyBuilderSetup()" ${canApply ? '' : 'disabled'}>${applying ? 'Saving page setup…' : 'Apply setup'}</button>`}</footer></section></div>`;
}

(window as any).openBuilderSetup = (selector = '.pb-guided-setup-button') => {
  const website = getActiveBuilderWebsite();
  const page = mockPages.find(item => item.id === builderPageId);
  const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
  if (!website || !page || !userId || builderSetupController?.status === 'applying') return;
  builderSetupTriggerSelector = selector;
  if (!builderSetupDraft || builderSetupDraft.identity !== getBuilderSetupIdentity()) builderSetupDraft = createBuilderSetupDraft();
  builderSetupController = createLiveBuilderSetupController();
  builderSetupWizardOpen = true;
  document.body.classList.add('pb-setup-modal-open');
  void ensureBuilderMediaController();
  renderBuilder();
  setTimeout(() => document.querySelector<HTMLElement>('.pb-setup-dialog input:not([type="radio"]):not([type="checkbox"]), .pb-setup-dialog button')?.focus(), 0);
};
(window as any).closeBuilderSetup = () => {
  if (builderSetupController?.status === 'applying') return;
  builderSetupWizardOpen = false;
  document.body.classList.remove('pb-setup-modal-open');
  renderBuilder();
  setTimeout(() => document.querySelector<HTMLElement>(builderSetupTriggerSelector)?.focus(), 50);
};
(window as any).updateBuilderSetupField = (field: string, value: unknown) => { if (builderSetupDraft && field in builderSetupDraft) { (builderSetupDraft as any)[field] = value; builderSetupController?.invalidate(); } };
(window as any).toggleBuilderSetupService = (id: string, selected: boolean) => {
  const draft = builderSetupDraft;
  if (!draft) return;
  const item = BUILDER_SETUP_SERVICE_CATALOG.find(service => service.id === id);
  if (!item) return;
  draft.services = selected ? [...draft.services, { ...item }] : draft.services.filter(service => service.id !== id);
  if (!draft.services.some(service => service.id === draft.primaryServiceId)) draft.primaryServiceId = draft.services[0]?.id ?? '';
  builderSetupController?.invalidate();
  renderBuilder();
};
(window as any).setBuilderSetupPrimaryService = (id: string) => { if (builderSetupDraft?.services.some(service => service.id === id)) { builderSetupDraft.primaryServiceId = id; builderSetupController?.invalidate(); } };
(window as any).addBuilderSetupCustomService = () => { const input = document.getElementById('pb-setup-custom-service') as HTMLInputElement | null; const label = input?.value.trim(); if (!builderSetupDraft || !label) return; const id = `custom-${label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`; if (!builderSetupDraft.services.some(service => service.label.toLocaleLowerCase() === label.toLocaleLowerCase()) && builderSetupDraft.services.length < 12) builderSetupDraft.services.push({ id, label, custom: true }); if (!builderSetupDraft.primaryServiceId) builderSetupDraft.primaryServiceId = id; builderSetupController?.invalidate(); renderBuilder(); };
(window as any).removeBuilderSetupService = (id: string) => { if (!builderSetupDraft) return; builderSetupDraft.services = builderSetupDraft.services.filter(service => service.id !== id); if (builderSetupDraft.primaryServiceId === id) builderSetupDraft.primaryServiceId = builderSetupDraft.services[0]?.id ?? ''; builderSetupController?.invalidate(); renderBuilder(); };
(window as any).toggleBuilderSetupTrust = (key: keyof BuilderSetupBriefV1['trustSignals'], value: boolean) => { if (builderSetupDraft && key in builderSetupDraft.trustSignals) { builderSetupDraft.trustSignals[key] = value; builderSetupController?.invalidate(); } };
(window as any).selectBuilderSetupHeroAsset = (id: string) => { if (builderSetupDraft) { builderSetupDraft.heroAssetId = id; builderSetupController?.invalidate(); renderBuilder(); } };
(window as any).toggleBuilderSetupGalleryAsset = (id: string, selected: boolean) => { if (!builderSetupDraft) return; builderSetupDraft.galleryAssetIds = selected ? [...new Set([...builderSetupDraft.galleryAssetIds, id])].slice(0, 6) : builderSetupDraft.galleryAssetIds.filter(assetId => assetId !== id); builderSetupController?.invalidate(); renderBuilder(); };
(window as any).setBuilderSetupAssetAlt = (id: string, value: string) => { if (builderSetupDraft) { builderSetupDraft.assetAltText[id] = value; builderSetupController?.invalidate(); } };
(window as any).previousBuilderSetupStep = () => { if (builderSetupDraft && builderSetupDraft.step > 1) { builderSetupDraft.step = (builderSetupDraft.step - 1) as BuilderSetupWizardDraft['step']; renderBuilder(); } };
(window as any).nextBuilderSetupStep = () => { if (!builderSetupDraft) return; const issues = builderSetupStepIssues(); if (issues.length) { builderSetupController!.message = issues[0]; renderBuilder(); return; } builderSetupController!.message = ''; builderSetupDraft.step = Math.min(4, builderSetupDraft.step + 1) as BuilderSetupWizardDraft['step']; if (builderSetupDraft.step === 4 && builderSetupDraft.mode) { const brief = buildBuilderSetupBrief(); if (brief) builderSetupController?.generate(brief, builderSetupDraft.mode, builderSetupDraft.applySeoMetadata); } renderBuilder(); };
(window as any).setBuilderSetupMode = (mode: BuilderSetupApplyMode) => { if (!builderSetupDraft) return; builderSetupDraft.mode = mode; builderSetupDraft.replaceConfirmed = getCurrentBuilderSections().length === 0; const brief = buildBuilderSetupBrief(); if (brief) builderSetupController?.generate(brief, mode, builderSetupDraft.applySeoMetadata); renderBuilder(); };
(window as any).confirmBuilderSetupReplace = (confirmed: boolean) => { if (builderSetupDraft) { builderSetupDraft.replaceConfirmed = confirmed; renderBuilder(); } };
(window as any).toggleBuilderSetupSeo = (enabled: boolean) => { if (!builderSetupDraft?.mode) return; builderSetupDraft.applySeoMetadata = enabled; const brief = buildBuilderSetupBrief(); if (brief) builderSetupController?.generate(brief, builderSetupDraft.mode, enabled); renderBuilder(); };
(window as any).applyBuilderSetup = async () => { const controller = builderSetupController; if (!controller || controller.status === 'applying') return; const operation = protectedAsyncOperationGuard.begin('builder-setup-ui', getActingUserId()); const pending = controller.apply(); renderBuilder(); const result = await pending; if (!protectedAsyncOperationGuard.isCurrent(operation, getActingUserId()) || controller !== builderSetupController) return; if (result.success) { builderSetupWizardOpen = false; builderSetupDraft = null; document.body.classList.remove('pb-setup-modal-open'); renderBuilder(); (window as any).showToast('Setup applied. Your public site was not published.', 'success'); setTimeout(() => document.querySelector<HTMLElement>('.pb-canvas-inner .pb-section-preview')?.focus(), 0); } else { renderBuilder(); } };

window.addEventListener('keydown', event => {
  if (!builderSetupWizardOpen) return;
  if (event.key === 'Escape' && builderSetupController?.status !== 'applying') {
    event.preventDefault();
    (window as any).closeBuilderSetup();
    return;
  }
  if (event.key !== 'Tab') return;
  const dialog = document.querySelector<HTMLElement>('.pb-setup-dialog');
  const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

window.addEventListener('keydown', event => {
  if (currentView !== 'builder') return;
  if (!builderNavigationUiManager) return;

  const itemModal = builderNavigationUiManager.getItemModalState();
  const publishModal = builderNavigationUiManager.getPublishModalState();

  if (!itemModal.isOpen && !publishModal.isOpen) return;

  if (event.key === 'Escape') {
    if (itemModal.isOpen && !itemModal.isSaving) {
      event.preventDefault();
      builderNavigationUiManager.closeItemModal();
      renderBuilder();
      return;
    }
    if (publishModal.isOpen && !publishModal.isPublishing) {
      event.preventDefault();
      builderNavigationUiManager.closePublishModal();
      renderBuilder();
      return;
    }
  }

  if (event.key === 'Tab') {
    const dialog = document.querySelector<HTMLElement>('.pb-modal-overlay');
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

function _renderBuilder() {
  hydrateBuilderContext();
  if (editorUsesLocalData()) {
    PagesRepo.hydrateLocalPages(getActingUserId());
  }
  hydrateBuilderPageSettingsPagesFromLocalStorage(getActingUserId());

  const userId = getActingUserId();
  const activeWebsite = getActiveBuilderWebsite();
  const page = mockPages.find(p => p.id === builderPageId && p.user_id === userId);
  const routeResolution = activeWebsite && page
    ? resolveBuilderNavigationTarget({
        actingUserId: userId,
        target: { websiteId: activeWebsite.id, pageId: page.id, action: 'edit' },
        websites: mockWebsites,
        routes: mockWebsiteRoutes,
        funnels: mockFunnels,
        pages: mockPages
      })
    : null;
  if (builderRouteUnavailableReason || !page || routeResolution?.status !== 'resolved') {
    app.innerHTML = `
      <main style="width: 100vw; padding: 0; overflow: hidden; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b0f19; color: white; font-family: 'Inter', system-ui, sans-serif;">
        <div style="text-align: center; max-width: 360px; padding: 40px;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 12px; color: #f8fafc;">Builder unavailable</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; margin: 0 0 20px; line-height: 1.5;">The selected website or page is no longer available.</p>
          <button onclick="window.navigateTo('website-dashboard')" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Return to Website Dashboard</button>
        </div>
      </main>
    `;
    return;
  }

  if (
    builderPublicationHistoryPageId !== null
    && builderPublicationHistoryPageId !== page.id
  ) {
    resetBuilderPublicationHistory();
  }

  ensureBuilderPublicationState(page.id);

  hydrateBuilderSectionsFromLocalStorage(builderPageId);

  const history = getBuilderHistoryController();
  const sections = history
    ? builderDocumentToPageSections(history.document)
    : mockPageSections
        .filter(s => s.page_id === builderPageId)
        .sort((a, b) => a.order - b.order);
  const publicationStatus = getBuilderPublicationDisplayStatus();

  app.innerHTML = `
    <main style="width: 100vw; padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column; background: #000; color: white; font-family: 'Inter', system-ui, sans-serif;">

      <header class="pb-topbar" style="height: 64px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 100;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.builderGoBack()" style="background: transparent; border: 1px solid #333; color: #888; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Exit
          </button>
          <div style="width: 1px; height: 24px; background: #222;"></div>
          <div style="display: flex; gap: 4px; background: #000; border: 1px solid #333; padding: 4px; border-radius: 10px;">
             <button onclick="window.setBuilderMode('edit')" style="padding: 8px 16px; border-radius: 7px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${builderMode === 'edit' ? '#2563EB' : 'transparent'}; color: ${builderMode === 'edit' ? 'white' : '#888'};">Studio</button>
             <button onclick="window.setBuilderMode('preview')" style="padding: 8px 16px; border-radius: 7px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${builderMode === 'preview' ? '#2563EB' : 'transparent'}; color: ${builderMode === 'preview' ? 'white' : '#888'};">Preview</button>
          </div>
          ${builderMode === 'edit' ? `
          <button type="button" class="pb-guided-setup-button" onclick="window.openBuilderSetup('.pb-guided-setup-button')">Guided Setup</button>
          <div class="pb-history-controls" role="group" aria-label="Edit history">
            <button id="pb-history-undo" type="button" class="pb-history-button" aria-label="Undo" title="Undo (Ctrl/Command+Z)" onclick="window.undoBuilder()" ${history?.canUndo ? '' : 'disabled'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v1"/></svg>
              <span>Undo</span>
            </button>
            <button id="pb-history-redo" type="button" class="pb-history-button" aria-label="Redo" title="Redo (Ctrl/Command+Shift+Z or Ctrl+Y)" onclick="window.redoBuilder()" ${history?.canRedo ? '' : 'disabled'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v1"/></svg>
              <span>Redo</span>
            </button>
          </div>
          ` : ''}
        </div>

        <div class="pb-viewport-toggle" role="group" aria-label="Canvas viewport">
          <button type="button" class="pb-vt-btn ${builderViewport === 'desktop' ? 'active' : ''}" aria-label="Desktop viewport" aria-pressed="${builderViewport === 'desktop'}" title="Desktop viewport" onclick="window.setBuilderViewport('desktop')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2"/><polyline points="8 22 12 18 16 22"/></svg>
            <span>Desktop</span>
          </button>
          <button type="button" class="pb-vt-btn ${builderViewport === 'tablet' ? 'active' : ''}" aria-label="Tablet viewport, 768 pixels" aria-pressed="${builderViewport === 'tablet'}" title="Tablet · 768px" onclick="window.setBuilderViewport('tablet')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            <span>Tablet</span>
          </button>
          <button type="button" class="pb-vt-btn ${builderViewport === 'mobile' ? 'active' : ''}" aria-label="Mobile viewport, 375 pixels" aria-pressed="${builderViewport === 'mobile'}" title="Mobile · 375px" onclick="window.setBuilderViewport('mobile')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            <span>Mobile</span>
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 15px;">
           <span id="pb-autosave-indicator" style="font-size: 0.75rem; color: #666; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${builderSaveState.status === 'saved' ? '#10b981' : builderSaveState.status === 'saving' ? '#fbbf24' : builderSaveState.status === 'dirty' ? '#f97316' : '#ef4444'};"></span>
            ${builderSaveStatusLabel(builderSaveState.status)}
            ${builderSaveState.status === 'failed' ? `<button type="button" class="pb-autosave-retry" onclick="window.retryBuilderAutosave()">Retry</button>` : builderSaveState.status === 'conflict' ? `<button type="button" class="pb-autosave-retry" onclick="window.reloadBuilderAfterConflict()">Reload page</button>` : ''}
          </span>
          ${builderMode === 'edit' ? `
          <div class="pb-publication-control">
            <span id="pb-publication-status" class="pb-publication-status ${publicationStatus.className}">${publicationStatus.label}</span>
            <button type="button" class="pb-publish-button" aria-label="Publish current page" onclick="window.openBuilderPublishModal()" ${builderPublishing ? 'disabled' : ''}>${builderPublishing ? 'Publishing…' : 'Publish'}</button>
          </div>
          ` : ''}
          <button onclick="window.navigateTo('preview', '${page.slug}')" style="background: #1e1e1e; border: 1px solid #333; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem;">Live Preview</button>
        </div>
      </header>

      <div class="pb-layout" style="flex: 1; display: flex; overflow: hidden;">
        <!-- Left Panel: Structured Sections -->
        ${builderMode === 'edit' ? `
        <aside class="pb-left-panel" style="width: 260px; border-right: 1px solid #222; background: #111; display: flex; flex-direction: column;">
          <div class="pb-left-tabs" role="tablist" aria-label="Builder sidebar">
            <button type="button" role="tab" aria-selected="${builderLeftPanelTab === 'add'}" class="${builderLeftPanelTab === 'add' ? 'active' : ''}" onclick="window.setBuilderLeftPanelTab('add')">Add</button>
            <button type="button" role="tab" aria-selected="${builderLeftPanelTab === 'pages'}" class="${builderLeftPanelTab === 'pages' ? 'active' : ''}" onclick="window.setBuilderLeftPanelTab('pages')">Pages</button>
            <button type="button" role="tab" aria-selected="${builderLeftPanelTab === 'navigation'}" class="${builderLeftPanelTab === 'navigation' ? 'active' : ''}" onclick="window.setBuilderLeftPanelTab('navigation')">Nav</button>
            <button type="button" role="tab" aria-selected="${builderLeftPanelTab === 'layers'}" class="${builderLeftPanelTab === 'layers' ? 'active' : ''}" onclick="window.setBuilderLeftPanelTab('layers')">Layers</button>
            <button type="button" role="tab" aria-selected="${builderLeftPanelTab === 'assets'}" class="${builderLeftPanelTab === 'assets' ? 'active' : ''}" onclick="window.setBuilderLeftPanelTab('assets')">Assets</button>
          </div>

          ${builderLeftPanelTab === 'add' ? `
          <div class="pb-panel-header" style="padding: 24px 20px; border-bottom: 1px solid #222;">
            <h3 style="font-size: 0.7rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin: 0;">Add Components</h3>
          </div>

          <div class="pb-component-list" style="flex: 1; overflow-y: auto; padding: 20px;">
            ${[
        { id: 'comp-hero', icon: '🦸', label: 'Hero' },
        { id: 'comp-proof', icon: '🏆', label: 'Proof' },
        { id: 'comp-offer', icon: '💰', label: 'Offer' },
        { id: 'comp-gallery', icon: '🖼️', label: 'Gallery' },
        { id: 'comp-form', icon: '📋', label: 'Form' },
        { id: 'comp-faq', icon: '❓', label: 'FAQ' }
      ].map(item => `
              <div class="pb-component-item" onclick="window.addStructuredSection('${item.id}')" style="display: flex; align-items: center; gap: 15px; padding: 15px; background: #1a1a1a; border-radius: 12px; border: 1px solid #222; cursor: pointer; margin-bottom: 12px; transition: all 200ms ease;">
                <div style="font-size: 1.5rem;">${item.icon}</div>
                <div style="font-weight: 700; font-size: 0.9rem; color: #eee;">${item.label}</div>
              </div>
            `).join('')}
          </div>
          ` : builderLeftPanelTab === 'pages'
            ? renderBuilderPagesPanel()
            : builderLeftPanelTab === 'navigation'
              ? renderBuilderSiteNavigationPanel()
              : builderLeftPanelTab === 'layers'
                ? renderBuilderLayersPanel(sections)
                : renderBuilderAssetsPanel(sections)}

          <div style="padding: 20px; border-top: 1px solid #222; background: #0a0a0a;">
             <div style="font-size: 0.6rem; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px; letter-spacing: 0.05em;">Switch Page</div>
             <select onchange="window.switchBuilderPage(this.value)" style="width: 100%; padding: 12px; border-radius: 8px; background: #111; border: 1px solid #333; color: #eee; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                ${getBuilderWebsitePageEntries().map(({ page: builderPage }) => `<option value="${escapeBuilderInspectorHtml(builderPage.id)}" ${builderPage.id === builderPageId ? 'selected' : ''}>${escapeBuilderInspectorHtml(builderPage.name.trim() || 'Untitled page')}</option>`).join('')}
             </select>
          </div>
        </aside>
        ` : ''}

        <!-- Center Panel: Live Canvas -->
        <section class="pb-canvas-area" style="flex: 1; min-width: 0; overflow: auto; height: 100%; padding: 40px 20px; background: #000; display: flex; flex-direction: column; align-items: safe center; position: relative;">
          
          ${(() => {
            if (builderMode === 'preview') return '';
            const hasCTA = sections.some(s => ['hero', 'offer', 'form'].includes(s.type));
            if (!hasCTA && sections.length > 0) {
              return `
                <div class="pb-conversion-warning">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <strong style="color: #991B1B; font-size: 0.9rem; font-weight: 800;">Conversion Risk</strong>
                  </div>
                  <p style="font-size: 0.8rem; color: #7F1D1D; line-height: 1.5; margin: 0;">This page has no Call-to-Action. Add a <b>Hero</b>, <b>Offer</b>, or <b>Form</b> to capture leads.</p>
                  <button onclick="window.addStructuredSection('comp-hero')" style="background: #991B1B; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;">Fix Now: Add Hero</button>
                </div>
              `;
            }
            return '';
          })()}

          <div class="pb-canvas-inner pb-canvas-${builderViewport}" style="border-radius: ${builderViewport === 'mobile' ? '40px' : '12px'}; overflow: visible; position: relative;">
            ${sections.length === 0 && builderMode === 'edit' ? `
              <div class="pb-guided-setup-empty">
                <span>Guided Website Setup</span>
                <h3>Build a polished pressure-washing page in a few guided steps.</h3>
                <p>Choose your services, confirmed trust signals, visual style, and uploaded media. Review the exact section plan before anything changes.</p>
                <button type="button" class="pb-guided-setup-empty-button" onclick="window.openBuilderSetup('.pb-guided-setup-empty-button')">Start Guided Setup</button>
                <small>Applying setup does not publish the page.</small>
              </div>
            ` : ''}
            
            ${(() => {
                if (localStorage.getItem('pb_onboarding_hints_seen') || builderMode === 'preview') return '';
                // Only show hints if we have at least one hero/offer section
                const hasHero = sections.find(s => s.type === 'hero');
                if (!hasHero) return '';

                return `
                    <div class="pb-onboarding-hint" style="top: 140px; left: 10%;">
                        <div class="pb-onboarding-hint-content">Edit your headline here ✍️</div>
                    </div>
                `;
            })()}

            ${builderViewport === 'mobile' ? `
              <div class="pb-sticky-cta">
                 <button class="btn-primary" style="width: 100%; box-shadow: 0 10px 25px rgba(37,99,235,0.4);">Ready to Start?</button>
              </div>
            ` : ''}

            ${['Add Initial', ...sections].map((item) => {
        const isInitial = item === 'Add Initial';
        const section = isInitial ? null : (item as any);
        const order = isInitial ? 0 : section.order + 0.5;

        return `
                ${builderMode === 'edit' ? `
                <div class="pb-add-between" onclick="window.addStructuredSectionAt('${order}')" style="height: 12px; opacity: 0; transition: opacity 200ms; cursor: cell;">
                   <div style="width: 100%; height: 2px; background: #2563EB;"></div>
                </div>
                ` : ''}
                ${!isInitial ? `
                  <div id="sec-preview-${escapeBuilderInspectorHtml(section.id)}" class="pb-section-preview ${builderSelectedSectionId === section.id ? 'active' : ''} ${section.styles?.visible === false ? 'pb-section--hidden' : ''}"
                       data-builder-section-id="${escapeBuilderInspectorHtml(section.id)}"
                       role="${builderMode === 'edit' ? 'button' : 'region'}"
                       tabindex="${builderMode === 'edit' ? '0' : '-1'}"
                       aria-label="${escapeBuilderInspectorHtml(`${section.type} section`)}"
                       aria-selected="${builderSelectedSectionId === section.id}"
                       onclick="${builderMode === 'edit' ? `window.handleBuilderCanvasSectionClick(event, '${section.id}')` : ''}"
                       onkeydown="${builderMode === 'edit' ? `window.handleBuilderCanvasSectionKeydown(event, '${section.id}')` : ''}"
                       style="position: relative; border: 2px solid transparent; transition: border-color 0.2s; background: white; cursor: ${builderMode === 'edit' ? 'pointer' : 'default'};">
                      
                      ${builderMode === 'edit' ? `
                        <div style="position: absolute; top: 12px; left: 12px; background: #111; color: #555; padding: 4px 10px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; z-index: 40; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #222; pointer-events: none; opacity: 0.8;">
                          ${(() => {
                            switch(section.type) {
                              case 'hero': return 'Hero Section';
                              case 'proof': return 'Testimonials';
                              case 'offer': return 'Deal / Offer';
                              case 'form': return 'Lead Capture';
                              case 'gallery': return 'Gallery';
                              case 'faq': return 'FAQ';
                              default: return section.type;
                            }
                          })()}
                        </div>
                      ` : ''}

                      ${builderMode === 'edit' && section.styles?.visible === false ? `
                        <div style="position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.6rem; font-weight: 900; z-index: 40; pointer-events: none;">HIDDEN</div>
                      ` : ''}

                      <div style="padding: ${section.styles.padding || '80px 40px'}; 
                                  text-align: ${section.styles.text_alignment || section.styles.alignment || section.styles.textAlign || 'left'}; 
                                  background-image: ${section.content.background_image ? `url('${section.content.background_image}')` : 'none'};
                                  background-size: cover;
                                  background-position: center;
                                  background-color: ${section.styles.background || section.styles.backgroundColor || 'white'}; 
                                  color: ${section.styles.color || (section.content.background_image ? 'white' : 'inherit')}; 
                                  width: 100%;
                                  min-height: ${section.type === 'hero' ? '600px' : 'auto'};
                                  display: flex;
                                  flex-direction: column;
                                  justify-content: ${section.type === 'hero' ? 'center' : 'flex-start'};
                                  position: relative;
                                  overflow: hidden;
                                  opacity: ${section.styles?.visible === false ? '0.4' : '1'};
                                  filter: ${section.styles?.visible === false ? 'grayscale(0.8)' : 'none'};">
                        ${section.content.background_image ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.45);"></div>` : ''}
                        <div style="position: relative; z-index: 10; width: 100%; max-width: 1000px; margin: 0 auto;">
                          ${renderSectionPreviewContent(section)}
                        </div>
                      </div>

                      <div class="pb-section-controls" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: none; gap: 4px; background: #111; border: 1px solid #333; padding: 4px; border-radius: 10px; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.5); align-items: center;">
                        <span style="font-size: 0.6rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; margin: 0 10px;">${section.type}</span>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Switch Layout" onclick="event.stopPropagation(); window.switchSectionVariant('${section.id}')" style="background: transparent; border: none; color: #2563EB; cursor: pointer; padding: 8px 16px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          Switch Layout
                        </button>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Move Up" onclick="event.stopPropagation(); window.moveSection('${section.id}', -1)" style="background: transparent; border: none; color: #eee; cursor: pointer; padding: 8px 12px; font-size: 0.9rem;">↑</button>
                        <button title="Move Down" onclick="event.stopPropagation(); window.moveSection('${section.id}', 1)" style="background: transparent; border: none; color: #eee; cursor: pointer; padding: 8px 12px; font-size: 0.9rem;">↓</button>
                        <button title="Toggle Visibility" onclick="event.stopPropagation(); window.toggleSectionVisibility('${section.id}')" style="background: transparent; border: none; color: ${section.styles?.visible === false ? '#10b981' : '#ff4d4d'}; cursor: pointer; padding: 8px 12px; font-size: 0.75rem; font-weight: 800;">${section.styles?.visible === false ? 'Show' : 'Hide'}</button>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Delete" onclick="event.stopPropagation(); window.removeSection('${section.id}')" style="background: transparent; border: none; color: #666; cursor: pointer; padding: 8px 12px; font-size: 0.8rem;">🗑</button>
                      </div>
                  </div>
                ` : ''}
              `;
      }).join('') || `
              <div style="padding: 120px 40px; text-align: center; color: #555; border: 2px dashed #222; margin: 60px; border-radius: 20px;">
                <h3 style="margin-bottom: 20px; font-size: 1.5rem; font-weight: 800; color: #eee;">Canvas Ready</h3>
                <p style="font-size: 0.9rem;">Click components on the left to start building.</p>
              </div>
            `}
          </div>
        </section>
        ${builderMode === 'edit' ? renderBuilderInspectorPanel(sections) : ''}
      </div>
      ${renderBuilderPublishModal(page, sections, publicationStatus)}
      ${renderBuilderUnifiedPublishModalHtml()}
      ${renderBuilderNewPageDialog()}
      ${renderBuilderSetupDialog()}
      ${renderBuilderPageRouteEditorDialog()}
      ${renderBuilderRoutePublishModal()}
      ${renderBuilderNavigationDialogs()}
    </main>
  `;
}




function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) current[key] = isNaN(Number(keys[i + 1])) ? {} : [];
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

(window as any).saveInlineEdit = (sectionId: string, field: string, el: HTMLElement) => {
  const newValue = el.innerText;
  applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(section => {
      if (section.id !== sectionId) return section;
      const content = structuredClone(section.content);
      setNestedValue(content, field, newValue);
      return { ...section, content };
    })
  }), {
    category: 'content',
    sectionId,
    fieldId: field
  }, { render: false });
  
  // Dismiss onboarding hints on first interaction
  if (!localStorage.getItem('pb_onboarding_hints_seen')) {
    localStorage.setItem('pb_onboarding_hints_seen', 'true');
  }
};

(window as any).finishBuilderFieldEdit = () => {
  getBuilderHistoryController()?.breakCoalescing();
};

/**
 * WB.3.1 — Inline editable text span helper.
 */
function inlineText(sectionId: string, field: string, value: string, extraStyle: string = ''): string {
  const safe = (value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const canEdit = builderMode === 'edit';
  return `<span
    class="pb-inline-text"
    ${canEdit ? 'contenteditable="true"' : ''}
    data-section-id="${sectionId}"
    data-field="${field}"
    style="${extraStyle} ${canEdit ? '' : 'pointer-events: none;'}"
    onclick="window.handleBuilderCanvasSectionClick(event, '${sectionId}');event.stopPropagation()"
    oninput="window.saveInlineEdit('${sectionId}', '${field}', this)"
    onblur="window.saveInlineEdit('${sectionId}', '${field}', this);window.finishBuilderFieldEdit()"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.blur();}"
  >${safe}</span>`;
}

function renderSectionPreviewContent(section: any) {
  const content = section.content;
  const id = section.id;

  switch (section.type) {
    case 'hero': {
      const headingField = content.heading !== undefined ? 'heading' : 'title';
      const subField = content.subheading !== undefined ? 'subheading' : 'subtitle';
      const btnField = content.button_text !== undefined ? 'button_text' : 'buttonText';
      const textAlign = section.styles?.text_alignment === 'center' ? 'center' : 'left';
      const marginSide = textAlign === 'center' ? 'auto' : '0';

      if (section.variant === 'split') {
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; align-items: center; text-align: left;">
            <div>
              <h1 style="font-size: clamp(2.2rem, 8vw, 3rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; color: inherit;">
                ${inlineText(id, headingField, content[headingField] || 'Hero Heading', 'display:block;width:100%;')}
              </h1>
              <p style="font-size: clamp(1rem, 3vw, 1.25rem); opacity: 0.85; margin-bottom: 2.5rem; line-height: 1.5; color: inherit;">
                ${inlineText(id, subField, content[subField] || 'Hero Subheading', 'display:block;width:100%;')}
              </p>
              <button class="btn-primary" style="padding: 16px 36px; font-size: 1.15rem; border-radius: 50px; pointer-events: none; border: none; background: #2563EB; color: white; width: fit-content;">
                ${inlineText(id, btnField, content[btnField] || 'Action')}
              </button>
            </div>
            <div style="border-radius: 24px; overflow: hidden; aspect-ratio: 4/3; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; border: 4px solid white; background: #eee;">
              <img src="${content.background_image || 'https://images.unsplash.com/photo-1541604193435-22077a288934'}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; inset: 0; cursor: crosshair; background: rgba(37,99,235,0); transition: background 0.2s; display: flex; align-items: center; justify-content: center;"
                   onmouseover="this.style.background='rgba(37,99,235,0.1)'" 
                   onmouseout="this.style.background='rgba(37,99,235,0)'"
                   onclick="window.openImagePicker('${id}', 'background_image')">
                 <span style="background: white; color: #2563EB; padding: 8px 16px; border-radius: 50px; font-weight: 800; font-size: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.2s;" class="pb-img-edit-hint">Change Photo</span>
              </div>
              <style>.pb-canvas-inner:hover .pb-img-edit-hint { opacity: 1 !important; }</style>
            </div>
          </div>
        `;
      }
      if (section.variant === 'minimal') {
        return `
          <div style="text-align: center; max-width: 700px; margin: 0 auto; color: #1e293b; padding: 40px 0;">
            <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 1.2rem; color: #0f172a; line-height: 1.2;">
              ${inlineText(id, headingField, content[headingField] || 'Hero Heading')}
            </h1>
            <p style="font-size: 1.15rem; color: #64748b; margin-bottom: 2rem; line-height: 1.6;">
              ${inlineText(id, subField, content[subField] || 'Hero Subheading')}
            </p>
            <button class="btn-primary" style="padding: 14px 32px; font-size: 1rem; border-radius: 12px; pointer-events: none; border: none; background: #2563EB; color: white;">
              ${inlineText(id, btnField, content[btnField] || 'Action')}
            </button>
          </div>
        `;
      }
      // Standard Centered
      return `
        <div style="text-align: ${textAlign};">
          <h1 style="font-size: clamp(2.2rem, 8vw, 3.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; color: inherit;">
            ${inlineText(id, headingField, content[headingField] || 'Hero Heading', 'display:block;width:100%;')}
          </h1>
          <p style="font-size: clamp(1.1rem, 3vw, 1.4rem); opacity: 0.85; margin-bottom: 2.5rem; max-width: 650px; margin-left: ${marginSide}; margin-right: ${marginSide}; line-height: 1.5; color: inherit;">
            ${inlineText(id, subField, content[subField] || 'Hero Subheading', 'display:block;width:100%;')}
          </p>
              <button class="btn-primary" onclick="event.stopPropagation()">
                ${inlineText(id, btnField, content[btnField] || 'Action')}
              </button>
        </div>
      `;
    }
    case 'proof': {
      const tests: any[] = content.testimonials || [];
      if (section.variant === 'list') {
        return `
          <div style="max-width: 700px; margin: 0 auto;">
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
               ${inlineText(id, 'title', content.title || 'What People Say', 'display:block;width:100%;')}
            </h2>
            <div style="display: flex; flex-direction: column; gap: 24px;">
              ${tests.map((t: any, idx: number) => `
                <div style="padding: 24px; border-left: 4px solid #2563EB; background: #f8fafc; border-radius: 0 16px 16px 0;">
                  <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic; margin-bottom: 12px; color: #1e293b;">
                    &ldquo;${inlineText(id, `testimonials.${idx}.quote`, t.quote || 'Great service!')}&rdquo;
                  </p>
                  <div style="font-weight: 800; color: #64748b; font-size: 0.9rem;">
                    &mdash; ${inlineText(id, `testimonials.${idx}.name`, t.name || 'Customer')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(1.6rem, 5vw, 2.22rem); font-weight: 800; margin-bottom: 40px; color: inherit;">
            ${inlineText(id, 'title', content.title || 'Don’t Just Take Our Word For It', 'display:block;width:100%;')}
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 24px;">
            ${tests.map((t: any, idx: number) => `
              <div style="background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #eee; text-align: left;">
                <div style="color: #fbbf24; font-size: 1rem; margin-bottom: 12px;">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p style="font-size: 0.95rem; line-height: 1.6; font-style: italic; margin-bottom: 16px; color: #475569;">
                  &ldquo;${inlineText(id, `testimonials.${idx}.quote`, t.quote || 'Great service!')}&rdquo;
                </p>
                <div style="font-weight: 800; color: #1e293b; font-size: 0.85rem;">
                  &mdash; ${inlineText(id, `testimonials.${idx}.name`, t.name || 'Customer')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'offer': {
      if (section.variant === 'card') {
        return `
          <div style="max-width: 600px; margin: 0 auto; padding: 40px; text-align: center; background: white; color: #1e293b; border-radius: 32px; border: 2px solid #e2e8f0; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);">
            <div style="display: inline-block; background: #EEF2FF; color: #4338CA; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 24px;">Limited Offer</div>
            <h2 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 12px; color: #0f172a;">
               ${inlineText(id, 'headline', content.headline || 'Special Package Deal')}
            </h2>
            <p style="font-size: 1.1rem; color: #64748b; margin-bottom: 32px; line-height: 1.6;">
               ${inlineText(id, 'description', content.description || 'Get our most popular service at a special rate.')}
            </p>
            <button class="btn-primary" style="background: #2563EB; color: white; padding: 18px 40px; font-size: 1.15rem; font-weight: 800; border-radius: 12px; border: none; pointer-events: none; width: 100%;">
               ${inlineText(id, 'button_text', content.button_text || 'Claim Offer')}
            </button>
            <div style="margin-top: 20px; font-size: 0.85rem; color: #94a3b8; font-weight: 600;">
               ${inlineText(id, 'expiry', content.expiry || 'Hurry, ends soon!')}
            </div>
          </div>
        `;
      }
      return `
        <div style="padding: clamp(40px, 10vw, 60px) clamp(20px, 5vw, 40px); text-align: center; background: #4f46e5; color: white; border-radius: 24px; box-shadow: 0 20px 50px rgba(79,70,229,0.3);">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.1em; backdrop-filter: blur(4px);">Limited Offer</div>
          <h2 style="font-size: clamp(2rem, 7vw, 3rem); font-weight: 900; margin-bottom: 12px;">
            ${inlineText(id, 'headline', content.headline || 'Special Package Deal', 'display:block;width:100%;')}
          </h2>
          <p style="font-size: clamp(1rem, 3vw, 1.25rem); opacity: 0.9; margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            ${inlineText(id, 'description', content.description || 'Get our most popular service at a special rate.', 'display:block;width:100%;')}
          </p>
          <button class="btn-primary" onclick="event.stopPropagation()">
            ${inlineText(id, 'button_text', content.button_text || 'Claim Offer')}
          </button>
          <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8; font-weight: 700;">
            ${inlineText(id, 'expiry', content.expiry || 'Hurry, ends soon!')}
          </div>
        </div>`;
    }
    case 'gallery': {
      const items: any[] = content.items || [];
      if (section.variant === 'grid') {
        return `
          <div>
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
               ${inlineText(id, 'title', content.title || 'Work Gallery')}
            </h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
               ${items.map((item: any, idx: number) => `
                 <div style="aspect-ratio: 1; border-radius: 12px; overflow: hidden; position: relative; background: #eee; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.after')">
                    <img src="${item.after}" style="width: 100%; height: 100%; object-fit: cover;">
                 </div>
               `).join('')}
            </div>
          </div>
        `;
      }
      return `
        <div>
          <h2 style="font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
            ${inlineText(id, 'title', content.title || 'Our Recent Transformations', 'display:block;width:100%;')}
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 24px;">
            ${items.map((item: any, idx: number) => `
              <div style="background: #fff; border-radius: 20px; overflow: hidden; border: 1px solid #eee; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #eee; position: relative;">
                   <div style="position: relative; overflow: hidden; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.before')">
                    <img src="${item.before}" style="width: 100%; aspect-ratio: 1; object-fit: cover;">
                    <span style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em; backdrop-filter: blur(4px);">BEFORE</span>
                  </div>
                  <div style="position: relative; overflow: hidden; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.after')">
                    <img src="${item.after}" style="width: 100%; aspect-ratio: 1; object-fit: cover;">
                    <span style="position: absolute; bottom: 8px; right: 8px; background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">AFTER</span>
                  </div>
                </div>
                <div style="padding: 15px; text-align: center; font-size: 0.75rem; color: #999; font-weight: 700; background: #fafafa; text-transform: uppercase;">
                   Tap to swap photos
                </div>
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; margin-top: 40px;">
             <button onclick="event.stopPropagation(); window.duplicateGalleryItem('${id}')" style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">+ Add Another Transformation</button>
          </div>
        </div>`;
    }
    case 'form': {
      return renderStandardForm(id, content, false);
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      if (section.variant === 'split') {
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; text-align: left;">
            <div style="max-width: 400px;">
              <h2 style="font-size: clamp(1.8rem, 5vw, 2.5rem); font-weight: 900; margin-bottom: 20px; line-height: 1.1; color: #0f172a;">
                ${inlineText(id, 'heading', content.heading || 'Got Questions?', 'display:block;width:100%;')}
              </h2>
              <p style="font-size: 1.1rem; color: #64748b; line-height: 1.6; opacity: 0.8;">
                We have answers. If you can't find what you're looking for, feel free to contact our team.
              </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 32px;">
              ${faqs.map((faq: any, idx: number) => `
                <div style="padding-bottom: 32px; border-bottom: 1px solid #f1f5f9;">
                  <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 12px; color: #1e293b; letter-spacing: -0.01em;">
                    ${inlineText(id, `items.${idx}.question`, faq.question || 'New Question')}
                  </h3>
                  <div style="color: #475569; line-height: 1.7; font-size: 1rem;">
                    ${inlineText(id, `items.${idx}.answer`, faq.answer || 'Answer goes here...', 'display:block;width:100%;')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
      }
      return `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 48px; text-align: center; color: inherit;">
            ${inlineText(id, 'heading', content.heading || 'Frequently Asked Questions', 'display:block;width:100%;')}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="pb-faq-item" style="border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff; transition: all 0.3s ease;">
                <button class="pb-faq-toggle" onclick="this.closest('.pb-faq-item').classList.toggle('open'); event.stopPropagation();"
                        style="width: 100%; text-align: left; padding: 24px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 800; color: #1e293b;">
                  <span>${inlineText(id, `items.${idx}.question`, faq.question || 'New Question')}</span>
                  <span class="pb-faq-chevron" style="font-size: 0.8rem; color: #cbd5e1; transition: transform 0.3s;">▼</span>
                </button>
                <div class="pb-faq-answer" style="padding: 0 24px; max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                  <div style="padding-bottom: 24px; color: #64748b; line-height: 1.7; font-size: 1rem;">
                    ${inlineText(id, `items.${idx}.answer`, faq.answer || 'Answer goes here...', 'display:block;width:100%;')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            .pb-faq-item.open { border-color: #2563EB; box-shadow: 0 20px 40px -10px rgba(37,99,235,0.1); }
            .pb-faq-item.open .pb-faq-chevron { transform: rotate(180deg); color: #2563EB; }
            .pb-faq-item.open .pb-faq-answer { max-height: 1000px; }
          </style>
        </div>`;
    }
    default:
      return `<div style="padding: 60px; background: #fff; border-radius: 20px; border: 2px dashed #eee; text-align: center; color: #999;">
                <strong style="color: #666; font-size: 1.1rem;">LEGACY SECTION: ${escapeBuilderInspectorHtml(String(section.type).toUpperCase())}</strong><br>
                <p style="margin-top: 10px; font-size: 0.9rem;">This section is preserved and is read-only in the current Builder.</p>
              </div>`;
  }
}


// ── WB.3.2 Image Picker ─────────────────────────────────────────────────────
/**
 * Opens a hidden file-input, reads the selected image as a data URL,
 * updates the canvas img element in-place (no re-render flicker),
 * persists to the in-memory store, and fires auto-save.
 */
(window as any).openImagePicker = (sectionId: string, field: string) => {
  builderLeftPanelTab = 'assets';
  builderMediaSelectedAssetIds.clear();
  void ensureBuilderMediaController().then(controller => {
    controller?.openPicker({ pageId: builderPageId, sectionId, field });
    renderBuilder();
  });
  renderBuilder();
};

// ── WB.3.6 — Builder Navigation Handlers ────────────────────────────────────
(window as any).builderGoBack = () => {
  getBuilderHistoryController()?.breakCoalescing();
  const target = builderReturnTo === 'funnels' ? 'funnel-detail' : 'pages';
  const param = builderReturnTo === 'funnels' ? builderReturnFunnelId : undefined;
  (window as any).navigateTo(target, param);
};

(window as any).openBuilderFromFunnel = (pageId: string, funnelId: string) => {
  builderPageId = pageId;
  builderReturnTo = 'funnels';
  builderReturnFunnelId = funnelId;
  const primarySection = getPrimarySectionForPage(pageId);
  const page = mockPages.find((p: any) => p.id === pageId);
  const context: BuilderContext = {
    websiteId: getActiveBuilderWebsite()?.id,
    pageId,
    action: 'edit',
    sectionId: primarySection?.id || null,
    path: page?.slug ? `/${page.slug === 'home' ? '' : page.slug}` : undefined,
    label: page?.name || primarySection?.content?.heading,
    returnTo: 'funnels',
    funnelId
  };
  persistBuilderContext(context);
  (window as any).navigateTo('builder', undefined, { builderContext: context });
};

(window as any).switchBuilderPage = async (id: string, source: 'pages' | 'footer' = 'pages') => {
  if (id === builderPageId) return;
  if (builderSetupController?.status === 'applying') {
    (window as any).showToast('Wait for guided setup to finish saving.', 'info');
    return;
  }

  const pageSettings = builderPageSettingsController?.pageId === builderPageId
    ? builderPageSettingsController
    : null;
  if (pageSettings?.status === 'saving') {
    (window as any).showToast('Wait for page settings to finish saving.', 'info');
    return;
  }
  if (pageSettings?.isDirty) {
    const saved = await pageSettings.save();
    if (!saved) {
      renderBuilder();
      (window as any).showToast('Fix or retry Page Settings before switching pages.', 'error');
      return;
    }
  }

  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = undefined;
    const previousPage = mockPages.find(page => page.id === builderPageId);
    await (window as any).savePageSections();
    if (previousPage) (previousPage as any).updated_at = new Date().toISOString();
  }

  await builderSaveQueue.whenIdle();

  builderSetupWizardOpen = false;
  builderSetupDraft = null;
  builderSetupController = null;
  document.body.classList.remove('pb-setup-modal-open');
  builderPageId = id;
  builderPageSettingsController?.cancelPending();
  builderPageSettingsController = null;
  builderHistoryController = null;
  builderSelectedSectionId = null;
  builderInsertOrder = null;
  builderPublicationRequestSequence += 1;
  builderPublicationLoadedPageId = null;
  builderPublicationLoading = false;
  builderPublicationTarget = null;
  builderPublishedRevision = null;
  builderPublicationStatusLoadFailed = false;
  builderPublicationError = null;
  builderPublicationSuccess = null;
  builderPublishModalOpen = false;
  resetBuilderPublicationHistory();
  document.body.classList.remove('pb-publish-modal-open');
  if (source === 'pages') {
    builderReturnTo = 'pages';
    builderReturnFunnelId = null;
  }
  const context: BuilderContext = {
    websiteId: getActiveBuilderWebsite()?.id,
    pageId: id,
    action: 'edit',
    sectionId: getPrimarySectionForPage(id)?.id || null,
    returnTo: builderReturnTo,
    funnelId: builderReturnFunnelId
  };
  persistBuilderContext(context);
  if (context.websiteId) window.history.replaceState({}, '', buildBuilderNavigationTarget({ websiteId: context.websiteId, pageId: id, action: 'edit' }));
  consumedBuilderInitialAction = null;
  renderBuilder();
};

function synchronizeBuilderSelectionDom(id: string): void {
  document.querySelectorAll<HTMLElement>('.pb-section-preview[data-builder-section-id]').forEach(section => {
    const selected = section.dataset.builderSectionId === id;
    section.classList.toggle('active', selected);
    section.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll<HTMLElement>('.pb-layer-row').forEach(row => {
    const button = row.querySelector<HTMLButtonElement>('.pb-layer-main');
    const selected = button?.dataset.builderSectionId === id;
    row.classList.toggle('active', selected);
    if (button) {
      if (selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  });
  const inspector = document.querySelector<HTMLElement>('.pb-inspector-panel');
  const history = getBuilderHistoryController();
  if (inspector && history) inspector.outerHTML = renderBuilderInspectorPanel(builderDocumentToPageSections(history.document));
}

(window as any).selectSectionForBuilder = (id: string, shouldScroll = false, preserveCanvasInteraction = false) => {
  const history = getBuilderHistoryController();
  const changed = history?.selectSection(id) ?? builderSelectedSectionId !== id;
  builderSelectedSectionId = history?.selectedSectionId ?? id;
  builderInsertOrder = null;
  persistBuilderContext({
    websiteId: getActiveBuilderWebsite()?.id,
    pageId: builderPageId,
    sectionId: id,
    returnTo: builderReturnTo,
    funnelId: builderReturnFunnelId
  });
  if (changed) {
    if (preserveCanvasInteraction) synchronizeBuilderSelectionDom(id);
    else renderBuilder();
  }
  if (shouldScroll) {
    setTimeout(() => {
      document.getElementById(`sec-preview-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }
};

(window as any).showComponentPickerAt = (order: string) => {
  builderInsertOrder = parseFloat(order);
  (window as any).navigateTo('components');
};
(window as any).toggleSectionVisibility = (id: string) => {
  applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(section => section.id === id
      ? {
          ...section,
          styles: {
            ...section.styles,
            visible: section.styles?.visible === false
          }
        }
      : section)
  }), {
    category: 'structural',
    sectionId: id,
    fieldId: 'visibility',
    coalesce: false,
    selectSectionId: id
  });
};

(window as any).duplicateGalleryItem = (id: string) => {
  applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(section => section.id === id && section.type === 'gallery'
      ? {
          ...section,
          content: {
            ...section.content,
            items: [
              ...(Array.isArray(section.content.items) ? section.content.items : []),
              {
                before: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&q=80&w=600',
                after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600'
              }
            ]
          }
        }
      : section)
  }), {
    category: 'structural',
    sectionId: id,
    fieldId: 'gallery-items',
    coalesce: false,
    selectSectionId: id
  });
};

(window as any).addStructuredSection = (componentId: string) => {
  const component = mockComponents.find((c: any) => c.id === componentId);
  if (!component) return;

  const currentSections = getCurrentBuilderSections();
  const orderToInsertAt = builderInsertOrder !== null
    ? builderInsertOrder
    : Math.max(...currentSections.map((s: any) => s.order), 0) + 1;

  builderInsertOrder = null;

  const sectionId = createBuilderSectionId();
  let newSection: PageSection;

  if (isRegisteredBuilderSectionType(component.type)) {
    const currentPage = mockPages.find(page => page.id === builderPageId);

    try {
      newSection = createBuilderSection(component.type, {
        id: sectionId,
        pageId: builderPageId,
        order: orderToInsertAt,
        funnelId: currentPage?.funnel_id
      });
    } catch (error) {
      console.error(
        `[Builder] Failed to create registered section type "${component.type}".`,
        error
      );
      return;
    }
  } else {
    newSection = {
      id: sectionId,
      page_id: builderPageId,
      type: component.type,
      content: JSON.parse(JSON.stringify(component.default_content)),
      styles: JSON.parse(JSON.stringify(component.default_styles)),
      order: orderToInsertAt
    };
  }

  const added = applyLiveBuilderMutation(document => normalizeBuilderDocumentOrders({
    ...document,
    sections: [...document.sections, structuredClone(newSection)]
  }), {
    category: 'structural',
    sectionId: newSection.id,
    fieldId: 'add-section',
    coalesce: false,
    selectSectionId: newSection.id
  });
  if (!added) return;
  // Scroll newly added section into view
  setTimeout(() => {
    document.getElementById(`sec-preview-${newSection.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
};

// Keep legacy addSectionToPage working (used by duplicateBuilderSection + right-panel)
(window as any).addSectionToPage = (componentId: string) => {
  (window as any).addStructuredSection(componentId);
};

(window as any).duplicateBuilderSection = (id: string) => {
  const source = getCurrentBuilderSections().find(section => section.id === id);
  if (!source) return;
  const duplicateId = typeof crypto?.randomUUID === 'function'
    ? `sec-${crypto.randomUUID()}`
    : `sec-${Date.now()}-copy`;
  const duplicate: PageSection = {
    ...structuredClone(source),
    id: duplicateId,
    order: source.order + 0.5
  };
  applyLiveBuilderMutation(document => normalizeBuilderDocumentOrders({
    ...document,
    sections: [...document.sections, duplicate]
  }), {
    category: 'structural',
    sectionId: duplicateId,
    fieldId: 'duplicate-section',
    coalesce: false,
    selectSectionId: duplicateId
  });
};

(window as any).addStructuredSectionAt = (order: string) => {
  builderInsertOrder = parseFloat(order);
  (window as any).showToast('Select a component to insert', 'info');
  // Just show the toast, the user then clicks a component on the left
};

(window as any).removeSection = (id: string) => {
  const sections = getCurrentBuilderSections();
  const index = sections.findIndex(section => section.id === id);
  if (index === -1) return;
  const fallback = sections[index + 1]?.id ?? sections[index - 1]?.id ?? null;
  builderInsertOrder = null;
  applyLiveBuilderMutation(document => normalizeBuilderDocumentOrders({
    ...document,
    sections: document.sections.filter(section => section.id !== id)
  }), {
    category: 'structural',
    sectionId: id,
    fieldId: 'delete-section',
    coalesce: false,
    selectSectionId: fallback
  });
};

(window as any).moveSection = (id: string, direction: number) => {
  const pageSections = getCurrentBuilderSections();

  const index = pageSections.findIndex(s => s.id === id);
  const newIndex = index + direction;

  if (newIndex >= 0 && newIndex < pageSections.length) {
    persistBuilderContext({
      pageId: builderPageId,
      sectionId: id,
      returnTo: builderReturnTo,
      funnelId: builderReturnFunnelId
    });
    applyLiveBuilderMutation(document => {
      const sections = builderDocumentToPageSections(document);
      const [moved] = sections.splice(index, 1);
      sections.splice(newIndex, 0, moved);
      return {
        ...document,
        sections: sections.map((section, order) => ({ ...section, order }))
      };
    }, {
      category: 'structural',
      sectionId: id,
      fieldId: 'reorder-section',
      coalesce: false,
      selectSectionId: id
    });
  }
};

(window as any).switchSectionVariant = (id: string) => {
  const section = getCurrentBuilderSections().find(item => item.id === id);
  if (!section) return;

  const variantsByType: Record<string, string[]> = {
    hero: ['standard', 'split', 'minimal'],
    proof: ['grid', 'list'],
    offer: ['banner', 'card'],
    gallery: ['comparison', 'grid'],
    form: ['embedded', 'compact'],
    faq: ['accordion', 'split']
  };

  const currentVariant = section.variant || variantsByType[section.type]?.[0] || 'standard';
  const available = variantsByType[section.type] || ['standard'];
  const currentIndex = available.indexOf(currentVariant);
  const nextIndex = (currentIndex + 1) % available.length;
  
  applyLiveBuilderMutation(document => ({
    ...document,
    sections: document.sections.map(item => item.id === id
      ? { ...item, variant: available[nextIndex] }
      : item)
  }), {
    category: 'structural',
    sectionId: id,
    fieldId: 'variant',
    coalesce: false,
    selectSectionId: id
  });
  (window as any).showToast(`Switched to ${available[nextIndex]} layout`, 'success');
};

(window as any).updateSectionData = (id: string, field: 'content' | 'styles', value: string) => {
  try {
    const parsed = JSON.parse(value);
    applyLiveBuilderMutation(document => ({
      ...document,
      sections: document.sections.map(section => section.id === id
        ? { ...section, [field]: structuredClone(parsed) }
        : section)
    }), {
      category: field === 'content' ? 'content' : 'design',
      sectionId: id,
      fieldId: field
    });
  } catch (e) {
    // Silently ignore invalid JSON while typing
  }
};

// ── WB.3.5 Toast with type variants ──────────────────────────────────────────
(window as any).showToast = (message: string, type: 'success' | 'error' | 'saving' | 'info' = 'info') => {
  // Remove any existing same-type toast to avoid stacking
  document.querySelectorAll(`.pb-toast-${type}`).forEach(el => el.remove());

  const colours: Record<string, { border: string; bg: string; icon: string }> = {
    success: { border: '#22c55e', bg: '#052e16',  icon: '✓' },
    error:   { border: '#ef4444', bg: '#1c0a0a',  icon: '✕' },
    saving:  { border: '#f59e0b', bg: '#1c1405',  icon: '↑' },
    info:    { border: '#3b82f6', bg: '#0c1a2e',  icon: 'ℹ' },
  };
  const c = colours[type] ?? colours.info;

  const toast = document.createElement('div');
  toast.className = `pb-toast-${type}`;
  const icon = document.createElement('span');
  icon.style.cssText = 'font-size:1rem;line-height:1;';
  icon.textContent = c.icon;
  const messageText = document.createElement('span');
  messageText.textContent = message;
  toast.append(icon, messageText);
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${c.bg};
    color: #fff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    z-index: 10000;
    opacity: 0;
    transform: translateY(16px) scale(0.96);
    transition: opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1);
    border: 1px solid ${c.border};
    border-left: 4px solid ${c.border};
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 320px;
    pointer-events: none;
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // Auto-dismiss
  const ttl = type === 'saving' ? 2000 : 3500;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px) scale(0.96)';
    setTimeout(() => toast.remove(), 250);
  }, ttl);
};

async function getBuilderSaveAccessToken(): Promise<string | null> {
  if (browserFixturesEnabled) return 'browser-fixture-session';
  const client = await getBuilderPublicationSupabaseClient();
  if (!client) return null;
  const session = await client.auth.getSession();
  return session.data.session?.access_token ?? null;
}

const persistPageSectionDocument = createPageSectionSaveClient({
  getAccessToken: getBuilderSaveAccessToken
});
const fetchPageSectionRevision = createPageSectionRevisionClient({
  getAccessToken: getBuilderSaveAccessToken
});

// ── WB.3.5 savePageSections — authenticated production API + transactional RPC
(window as any).savePageSections = async () => {
  const history = getBuilderHistoryController();
  const saveSnapshot = history?.createSaveSnapshot();
  if (history && !saveSnapshot) return true;
  const pageId = saveSnapshot?.pageId ?? builderPageId;
  const sections = saveSnapshot
    ? builderDocumentToPageSections(saveSnapshot.document)
    : mockPageSections.filter((section: any) => section.page_id === pageId);
  const saveOperation = protectedAsyncOperationGuard.begin(
    `builder-section-save:${pageId}:${saveSnapshot?.generation ?? 'current'}`,
    getActingUserId()
  );

  const queuedSave = builderSaveQueue.enqueue(async () => {
    if (!protectedAsyncOperationGuard.isCurrent(saveOperation, getActingUserId())) return false;
    const generation = saveSnapshot?.generation ?? 1;
    if (builderPageRevisionAuthority.requiresReload(pageId)) {
      if (history && saveSnapshot) history.acknowledgeSave(saveSnapshot.generation, false);
      builderSaveState.requireReloadForConflict();
      renderBuilderAutosaveIndicator();
      return false;
    }
    builderSaveState.begin(generation);
    renderBuilderAutosaveIndicator();
    if (!builderPageRevisionAuthority.has(pageId)) {
      const revisionResult = await fetchPageSectionRevision(pageId);
      if (!protectedAsyncOperationGuard.isCurrent(saveOperation, getActingUserId())) return false;
      if (!revisionResult.success) {
        if (history && saveSnapshot) history.acknowledgeSave(saveSnapshot.generation, false);
        builderSaveState.complete(generation, { success: false, code: revisionResult.error.code }, true);
        console.warn(`[AutoSave] SECTION_SAVE_FAILED code=${revisionResult.error.code} status=${revisionResult.error.status} pageId=${pageId} requestId=${revisionResult.error.request_id}`);
        renderBuilderAutosaveIndicator();
        return false;
      }
      builderPageRevisionAuthority.accept(pageId, revisionResult.data.revision);
    }
    const result = await persistPageSectionDocument(pageId, {
      generation,
      expected_revision: builderPageRevisionAuthority.get(pageId) ?? null,
      sections
    });
    const succeeded = result.success;

    if (!protectedAsyncOperationGuard.isCurrent(saveOperation, getActingUserId())) return false;
    if (history && saveSnapshot) {
      const acknowledgement = history.acknowledgeSave(saveSnapshot.generation, succeeded);
      builderSaveState.complete(
        saveSnapshot.generation,
        result.success ? { success: true } : { success: false, code: result.error.code },
        acknowledgement.isDirty
      );
      if (history === builderHistoryController && history.pageId === builderPageId) {
        updateBuilderHistoryControls();
      }
    } else {
      builderSaveState.complete(generation, result.success ? { success: true } : { success: false, code: result.error.code }, false);
    }
    if (result.success) {
      builderPageRevisionAuthority.accept(pageId, result.data.revision);
      if (builderSaveState.status === 'saved') (window as any).showToast('Saved ✓', 'success');
    } else {
      if (result.error.code === 'CONFLICT') builderPageRevisionAuthority.invalidateAfterConflict(pageId);
      console.warn(`[AutoSave] SECTION_SAVE_FAILED code=${result.error.code} status=${result.error.status} pageId=${pageId} requestId=${result.error.request_id}`);
    }
    renderBuilderAutosaveIndicator();
    return succeeded;
  });
  return queuedSave;
};

// Attach to window for global access/testing
(window as any).createLead = createLead;

function renderStandardForm(id: string, content: any, isPublic: boolean) {
  const prefix = isPublic ? 'site-f-' : 'pf-';
  const title = content.title || 'Get Your Free Quote';

  // 🌿 Context-Aware CTA (Phase W4.8)
  let submitLabel = content.submit_label || 'Get My Free Quote ✨';
  if (isPublic) {
    if (activeWebsiteContext?.service) {
      submitLabel = `Get ${activeWebsiteContext.service} Quote`;
    } else {
      submitLabel = 'Get Free Quote';
    }
  }

  // 🌿 WB.5.2: Input Memory (Repeat Visit Support - Phase W4.6)
  const savedName = window.localStorage.getItem('crm_lead_name') || '';
  const savedPhone = window.localStorage.getItem('crm_lead_phone') || '';
  const defaultService = content.service || activeWebsiteContext?.service || '';
  const serviceSelected = (value: string) => defaultService.toLowerCase() === value.toLowerCase() ? 'selected' : '';
  const rawFields: unknown[] = Array.isArray(content.fields)
    ? content.fields
    : ['name', 'phone', 'email', 'address', 'service_type', 'message'];
  const fieldDefinitions = new Map<string, Record<string, unknown>>();
  rawFields.forEach(field => {
    if (typeof field === 'string') fieldDefinitions.set(field, { name: field, required: true });
    else if (field && typeof field === 'object') {
      const item = field as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name : typeof item.id === 'string' ? item.id : '';
      if (name) fieldDefinitions.set(name, item);
    }
  });
  const configuredFields = new Set(fieldDefinitions.keys());
  const fieldDisplay = (name: string) => configuredFields.has(name) ? '' : 'display: none;';
  const fieldRequired = (name: string) => configuredFields.has(name) && fieldDefinitions.get(name)?.required !== false ? 'required' : '';
  const configuredServiceOptions = fieldDefinitions.get('service_type')?.options;
  const serviceOptions = Array.isArray(configuredServiceOptions)
    ? configuredServiceOptions.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : ['Driveway Cleaning', 'House Washing', 'Roof Cleaning', 'Gutter Cleaning', 'Commercial Cleaning', 'Other'];

  return `
    <div id="form-wrapper-${id}" class="site-form-section" style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); color: #1e293b; text-align: left; border: 1px solid #f1f5f9;">
      <h3 style="margin-bottom: 30px; font-size: 1.85rem; text-align: center; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">${title}</h3>
      <form id="${prefix}form-${id}" onsubmit="event.preventDefault(); window.submitBuilderForm('${id}', ${isPublic})" style="display: flex; flex-direction: column; gap: 16px;">
        <input type="text" id="${prefix}website_url-${id}" name="website_url" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden;">
        <div class="form-group" style="${fieldDisplay('name')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Full Name <span style="color: #ef4444;">*</span></label>
          <input type="text" id="${prefix}name-${id}"
                 value="${savedName}"
                 placeholder="e.g. John Doe" ${fieldRequired('name')}
                 autocomplete="name"
                 oninput="window.localStorage.setItem('crm_lead_name', this.value)"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>
        <div class="form-group" style="${fieldDisplay('phone')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Phone Number <span style="color: #ef4444;">*</span></label>
          <input type="tel" id="${prefix}phone-${id}"
                 value="${savedPhone}"
                 placeholder="e.g. (555) 000-0000" ${fieldRequired('phone')}
                 title="Enter a 10-digit phone number, or 11 digits starting with 1."
                 autocomplete="tel"
                 oninput="this.setCustomValidity(''); window.localStorage.setItem('crm_lead_phone', this.value)"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>
        <div class="form-group" style="${fieldDisplay('email')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Email <span style="color: #ef4444;">*</span></label>
          <input type="email" id="${prefix}email-${id}"
                  placeholder="e.g. john@example.com"
                  ${fieldRequired('email')}
                  autocomplete="email"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>
        <div class="form-group" style="${fieldDisplay('address')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Address or Project Location <span style="color: #ef4444;">*</span></label>
          <input type="text" id="${prefix}address-${id}"
                  placeholder="e.g. 123 Main Street"
                  ${fieldRequired('address')}
                  autocomplete="street-address"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>

        <div class="form-group" style="${fieldDisplay('service_type')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Service Needed <span style="color: #ef4444;">*</span></label>
          <select id="${prefix}service-${id}"
                  ${fieldRequired('service_type')}
                  autocomplete="off"
                  style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 15px center; background-size: 18px;">
            <option value="">Select a service...</option>
            ${serviceOptions.map(option => `<option value="${escapeBuilderInspectorHtml(option)}" ${serviceSelected(option)}>${escapeBuilderInspectorHtml(option)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="${fieldDisplay('message')}">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Message (Optional)</label>
          <textarea id="${prefix}message-${id}"
                    autocomplete="off"
                    placeholder="Tell us more about your project..."
                    style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; min-height: 100px; resize: vertical; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'"></textarea>
        </div>


        <div id="${prefix}status-${id}" role="status" aria-live="polite" tabindex="-1" style="display: none; padding: 12px 14px; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-weight: 700; font-size: 0.9rem;"></div>

        <button type="submit" class="btn-primary"
          style="width: 100%; margin-top: 10px; font-size: 1.3rem; height: 64px;"
          >
          ${submitLabel}
        </button>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 15px; color: #94a3b8; font-size: 0.85rem; font-weight: 600;">
          <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Secure & Private Inquiry
        </div>
      </form>
    </div>
  `;
}

(window as any).submitBuilderForm = async (sectionId: string, isPublic: boolean = false) => {
  const section = (isPublic ? activeRenderedPublicSections : mockPageSections).find(s => s.id === sectionId);
  if (!section) return;

  const prefix = isPublic ? 'site-f-' : 'pf-';

  const nameInput = document.getElementById(`${prefix}name-${sectionId}`) as HTMLInputElement;
  const phoneInput = document.getElementById(`${prefix}phone-${sectionId}`) as HTMLInputElement;
  const emailInput = document.getElementById(`${prefix}email-${sectionId}`) as HTMLInputElement;
  const addressInput = document.getElementById(`${prefix}address-${sectionId}`) as HTMLInputElement;
  const serviceInput = (document.getElementById(`${prefix}service-${sectionId}`) || document.getElementById(`${prefix}service_type-${sectionId}`)) as HTMLSelectElement;
  const messageInput = document.getElementById(`${prefix}message-${sectionId}`) as HTMLTextAreaElement;
  const honeypotInput = document.getElementById(`${prefix}website_url-${sectionId}`) as HTMLInputElement;
  const formEl = document.getElementById(`${prefix}form-${sectionId}`) as HTMLFormElement | null;
  const statusEl = document.getElementById(`${prefix}status-${sectionId}`) as HTMLElement | null;

  const showValidationError = (message: string) => {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.display = 'block';
    }
  };

  const clearValidationError = () => {
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.display = 'none';
    }
  };

  const phoneDigits = (phoneInput?.value || '').replace(/\D/g, '');
  const hasValidPhone = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith('1'));
  if (phoneInput) {
    phoneInput.setCustomValidity(hasValidPhone || !phoneInput.value ? '' : 'Please enter a valid phone number.');
  }

  if (formEl && !formEl.checkValidity()) {
    const message = !phoneInput?.value || !nameInput?.value || !emailInput?.value || !addressInput?.value || !serviceInput?.value
      ? 'Please complete the required fields.'
      : !hasValidPhone
        ? 'Please enter a valid phone number.'
        : emailInput?.validity?.typeMismatch
          ? 'Please enter a valid email address.'
          : 'Please check the highlighted fields.';
    showValidationError(message);
    formEl.reportValidity();
    return;
  }

  if (!nameInput?.value || !phoneInput?.value) {
    showValidationError('Please complete the required fields.');
    return;
  }
  clearValidationError();
  const sectionWrapper = document.getElementById(`form-wrapper-${sectionId}`);
  const submitBtn = document.querySelector(`#form-wrapper-${sectionId} .btn-primary`) as HTMLButtonElement;

  if (!submitBtn || submitBtn.disabled) return; // Zero loss: prevent double submit

  const originalBtnText = submitBtn.innerHTML;
  const settings = getWebsiteSettings();

  try {
    // 1. Disable immediately & Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px;"><svg class="animate-spin" style="width:18px; height:18px;" viewBox="0 0 24 24"><circle style="opacity:0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path style="opacity:0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending Request…</span>';

    // 🌿 WB.5.1: Attach Funnel Attribution + SEO Metadata (W3.8)
    const page = mockPages.find(p => p.id === section.page_id);
    // Derive landing_page by stripping /site and /preview prefixes from window.location.pathname and defaulting to /
    let landingPath = window.location.pathname || '/';
    if (landingPath.startsWith('/site/')) {
      landingPath = landingPath.replace('/site', '');
    } else if (landingPath === '/site') {
      landingPath = '/';
    }
    if (landingPath.startsWith('/preview/')) {
      landingPath = landingPath.replace('/preview', '');
    } else if (landingPath === '/preview') {
      landingPath = '/';
    }
    const landing_page = landingPath || '/';

    // Safely parse attribution details using our helper from the landing page path
    const inferredService = landing_page.includes('driveway-cleaning') ? 'Driveway Cleaning' : '';
    const parsedAttr = {
      source_service: inferredService,
      source_city: '',
      source_page_type: inferredService ? 'service' : 'unknown'
    };

    // Prefer activeWebsiteContext properties, then activeWebsiteContext.route properties, then parsed fallbacks
    const source_service = activeWebsiteContext?.service || activeWebsiteContext?.route?.service || parsedAttr.source_service || '';
    const source_city = activeWebsiteContext?.city || activeWebsiteContext?.route?.city || parsedAttr.source_city || '';

    // Classify source_page and source_page_type
    let source_page_type = activeWebsiteContext?.route_type || parsedAttr.source_page_type || 'unknown';
    if (landing_page === '/' || landing_page === '') {
      source_page_type = 'homepage';
    } else if (source_service && source_city) {
      source_page_type = 'service_city';
    } else if (source_service) {
      source_page_type = 'service';
    } else if (source_city) {
      source_page_type = 'city';
    }

    // Set source_page as the landing page path or fall back to '/'
    const source_page = landing_page || '/';

    const leadData = {
      name: nameInput?.value || '',
      phone: phoneInput?.value,
      email: emailInput?.value || '',
      address: addressInput?.value || '',
      service_type: serviceInput?.value || source_service || 'General Inquiry',
      message: messageInput?.value || '',
      website_url: honeypotInput?.value || '',
      source: 'public website',
      funnel_id: page?.funnel_id,
      page_id: section.page_id,
      page_slug: activeWebsiteContext?.slug || activeWebsiteContext?.route?.slug || page?.slug || '',
      city: source_city,
      service: source_service,
      source_page,
      source_page_type,
      source_service,
      source_city,
      landing_page,
      referrer: document.referrer || ''
    };

    const edgeSubmission = shouldUsePublicLeadEdge(publicLeadRuntime, {
      isPublic,
      preview: activeRenderedPublicPreview
    });
    if (edgeSubmission && publicLeadRuntime.success && publicLeadRuntime.value.source === 'edge') {
      const location = derivePublicSiteLocation({
        pathname: window.location.pathname,
        hostname: window.location.hostname,
        source: 'edge',
        production: publicSiteEnvironment.PROD === true,
        developmentHostOverride: publicSiteHostOverride
      });
      if (!location.success) throw new Error('PUBLIC_LEAD_LOCATION');

      const availableValues: Record<string, string | boolean> = {
        name: leadData.name,
        phone: leadData.phone || '',
        email: leadData.email,
        address: leadData.address,
        service_type: leadData.service_type,
        message: leadData.message
      };
      const configuredFields = Array.isArray(section.content?.fields)
        ? section.content.fields.flatMap((field: unknown) => {
            if (typeof field === 'string') return [field];
            if (field && typeof field === 'object') {
              const item = field as Record<string, unknown>;
              const name = typeof item.name === 'string' ? item.name : typeof item.id === 'string' ? item.id : '';
              return name ? [name] : [];
            }
            return [];
          })
        : [];
      const fields = Object.fromEntries(
        configuredFields.filter((name: string) => Object.prototype.hasOwnProperty.call(availableValues, name))
          .map((name: string) => [name, availableValues[name]])
      );
      const signature = JSON.stringify(fields);
      let attempt = publicLeadAttempts.get(sectionId);
      if (!attempt || attempt.accepted || attempt.signature !== signature) {
        attempt = { key: crypto.randomUUID(), signature, accepted: false };
        publicLeadAttempts.set(sectionId, attempt);
      }
      const result = await submitPublicLead(window.fetch.bind(window), {
        endpoint: publicLeadRuntime.value.endpoint,
        submission: {
          host: location.host,
          path: location.path,
          formSectionId: sectionId,
          idempotencyKey: attempt.key,
          fields,
          elapsedMs: 0,
          honeypot: honeypotInput?.value || ''
        }
      });
      if (result.state !== 'accepted') {
        showValidationError(result.message);
        statusEl?.focus();
        throw new Error(`PUBLIC_LEAD_${result.state}`);
      }
      attempt.accepted = true;
      clearValidationError();
      console.log('[CRM: FORM] Public lead accepted.');
      if (sectionWrapper) {
        sectionWrapper.innerHTML = `
          <div id="form-success-confirmation" role="status" tabindex="-1" style="text-align:center; padding:60px 20px; background:#f0fff4; border-radius:24px; border:2px solid #c6f6d5;">
            <h3 style="font-size:2.25rem; font-weight:800; margin-bottom:16px; color:#22543d;">Thanks! We'll contact you shortly.</h3>
            <p style="font-size:1.1rem; color:#2f855a;">Your request has been received.</p>
          </div>`;
        (document.getElementById('form-success-confirmation') as HTMLElement | null)?.focus();
      }
      return;
    }

    const internalAttemptScope = `${isPublic ? 'preview' : 'builder'}:${sectionId}`;
    const internalAttempt = authenticatedFormAttempts.begin(internalAttemptScope, leadData);
    const internalLeadData = { ...leadData, request_key: internalAttempt.key };
    const internalLeadUiOperation = editorUsesSupabase()
      ? protectedAsyncOperationGuard.begin(`internal-lead-ui:${internalAttemptScope}`, getActingUserId())
      : null;

    // Timeout & Retry Logic (W4.2)
    const MAX_TIMEOUT = 10000;
    const withTimeout = (promise: Promise<any>, ms: number) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
      ]);

    const performSubmission = async (canRetry: boolean = true): Promise<any> => {
      try {
        const response = await withTimeout(fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(internalLeadData)
        }), MAX_TIMEOUT) as Response;
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Lead submission failed with status ${response.status}`);
        }
        return result.data || result;
      } catch (err: any) {
        if (canRetry) {
          console.warn('[CRM: FORM] Submission failed/timed out. Retrying once...', err);
          const response = await withTimeout(fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(internalLeadData)
          }), MAX_TIMEOUT) as Response;
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || `Lead submission failed with status ${response.status}`);
          }
          return result.data || result;
        }
        throw err;
      }
    };

    const res = await performSubmission(true); // Initial try + 1 retry
    if (internalLeadUiOperation) protectedAsyncOperationGuard.requireCurrent(internalLeadUiOperation, getActingUserId());
    authenticatedFormAttempts.accept(internalAttemptScope, internalAttempt.key);

    console.log("[CRM: FORM] Success:", res);

    // Track successful lead submission event
    if (typeof (window as any).trackConversionEvent === 'function') {
      (window as any).trackConversionEvent('generate_lead', {
        service_type: leadData.service_type,
        page_slug: leadData.page_slug,
        city: leadData.city,
        service: leadData.service,
        funnel_id: leadData.funnel_id,
        page_id: leadData.page_id
      });
    }

    // Success State (W4.3)
    if (sectionWrapper) {
      sectionWrapper.innerHTML = `
        <div id="form-success-confirmation" style="text-align: center; padding: 60px 20px; animation: fadeIn 0.5s ease-out; background: #f0fff4; border-radius: 24px; border: 2px solid #c6f6d5;">
          <div style="font-size: 4.5rem; margin-bottom: 24px; display: inline-block; animation: bounce 1s cubic-bezier(0.175, 0.885, 0.32, 1.275);">🚀</div>
          <h3 style="font-size: 2.25rem; font-weight: 800; margin-bottom: 16px; color: #22543d; letter-spacing: -0.5px;">Thanks! We'll contact you shortly.</h3>
          <p style="font-size: 1.2rem; color: #2f855a; line-height: 1.6; max-width: 400px; margin: 0 auto 30px; font-weight: 500;">
            We've received your request. In the meantime, you can reach us directly at:
          </p>
          <a href="tel:${settings.phone}" style="display: inline-block; font-size: 1.75rem; font-weight: 900; color: #22543d; text-decoration: none; border-bottom: 3px solid #68d391; padding-bottom: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${settings.phone}
          </a>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #c6f6d5;">
             <p style="font-weight: 700; color: #38a169; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">Request Confirmed</p>
          </div>
        </div>
      `;
      // Auto-scroll to confirmation
      setTimeout(() => {
        sectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

  } catch (error: any) {
    if (isSupersededOperationError(error)) return;
    console.error("[CRM: FORM] Persistent failure after retry:", error);

    if (shouldUsePublicLeadEdge(publicLeadRuntime, {
      isPublic,
      preview: activeRenderedPublicPreview
    })) {
      if (!statusEl?.textContent) showValidationError('We could not submit your request right now. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      statusEl?.focus();
      return;
    }

    // Persistent Failure Fallback UI (W4.10 Zero Loss)
    if (sectionWrapper) {
      sectionWrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; animation: fadeIn 0.5s ease-out; background: #fffaf0; border-radius: 24px; border: 2px dashed #f6ad55; box-shadow: 0 10px 25px rgba(192, 86, 33, 0.05);">
          <div style="font-size: 4.5rem; margin-bottom: 24px;">🆘</div>
          <h3 style="font-size: 1.85rem; font-weight: 900; margin-bottom: 12px; color: #c05621; letter-spacing: -0.5px;">Submission Interrupted</h3>
          <p style="font-size: 1.1rem; color: #7b341e; margin-bottom: 30px; line-height: 1.6; max-width: 320px; margin-left: auto; margin-right: auto;">
            Our server is having trouble connecting. To ensure we save your spot, please <b>call or text</b> us directly:
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <a href="tel:${settings.phone}"
               style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 18px; background: #c05621; color: white; text-decoration: none; border-radius: 16px; font-weight: 800; font-size: 1.15rem; box-shadow: 0 6px 15px rgba(192, 86, 33, 0.3); transition: transform 0.2s;">
               <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
               Call ${settings.phone}
            </a>

            <a href="sms:${settings.phone}?body=Hi, I tried to submit your website form but it failed. Please contact me about a cleaning quote."
               style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 18px; background: white; color: #c05621; text-decoration: none; border-radius: 16px; font-weight: 800; font-size: 1.15rem; border: 2px solid #ed8936; transition: transform 0.2s;">
               <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
               Text ${settings.phone}
            </a>
          </div>

          <p style="margin-top: 25px; font-size: 0.85rem; color: #a0522d; font-weight: 600;">Hans personally monitors this line 24/7</p>
        </div>
      `;
    } else {
      alert(`Something went wrong. Please call us directly at ${settings.phone}`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }
};

function renderPublicHeader(config: any, settings: any) {
  const displayName = settings.business_name || config.logo_text || 'Our Business';
  if (settings.primary_color && typeof document !== 'undefined' && document.documentElement?.style) {
    document.documentElement.style.setProperty('--primary', settings.primary_color);
    document.documentElement.style.setProperty('--primary-color', settings.primary_color);
  }
  return `
    <header style="padding: 20px clamp(16px, 4vw, 40px); border-bottom: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 16px 24px; justify-content: space-between; align-items: center; position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 100; transition: top 0.3s ease; box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: clip;">
      <div style="display: flex; align-items: center; gap: 15px; min-width: 0;">
         ${config.logo_url || settings.logo_url ? `<img src="${config.logo_url || settings.logo_url}" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;">` : ''}
         <span style="font-weight: 800; font-size: 1.25rem; color: #1e293b; overflow-wrap: anywhere;">${displayName}</span>
      </div>
      <nav style="display: flex; flex-wrap: wrap; gap: 14px 20px; align-items: center; justify-content: flex-end; min-width: 0; max-width: 100%;">
         ${(config.nav_items || []).map((item: any) => {
           const isCta = Boolean(item.is_cta || item.isCta);
           const rawPath = String(item.path || '');
           const isSpecialScheme = rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('tel:') || rawPath.startsWith('mailto:');
           const href = safeNavHref(rawPath);
           const clickHandler = isSpecialScheme
             ? ''
             : `data-nav-path="${escapeHtmlText(rawPath)}" onclick="event.preventDefault(); window.navigateTo('site', this.getAttribute('data-nav-path'))"`;
           if (isCta) {
             return `
               <a href="${escapeHtmlText(href)}"
                  ${clickHandler}
                  class="btn-primary"
                  style="padding: 8px 16px; font-size: 0.9rem; border-radius: 8px; text-decoration: none; font-weight: 700;">
                  ${escapeHtmlText(item.label)}
               </a>
             `;
           }
           return `
             <a href="${escapeHtmlText(href)}"
                ${clickHandler}
                style="text-decoration: none; color: #475569; font-weight: 600; font-size: 0.95rem; transition: color 0.2s;"
                onmouseover="this.style.color='var(--primary-color)'"
                onmouseout="this.style.color='#475569'">
                ${escapeHtmlText(item.label)}
             </a>
           `;
         }).join('')}
         ${config.cta_text ? `
           <a href="#quote-form" class="btn-primary" style="padding: 10px 20px; font-size: 0.9rem; border-radius: 8px; text-decoration: none;" onclick="event.preventDefault(); document.querySelector('#quote-form, .site-form-section')?.scrollIntoView({behavior: 'smooth', block: 'start'});">${escapeHtmlText(config.cta_text)}</a>
         ` : `
           <a href="tel:${settings.phone}" style="color: var(--primary-color); font-weight: 700; text-decoration: none;">Call ${escapeHtmlText(settings.phone)}</a>
         `}
      </nav>
    </header>
  `;
}

function renderPublicFooter(config: any, settings: any) {
  const businessName = settings.business_name || config.business_name || 'Our Business';
  const phone = settings.phone || config.phone_number || '';
  const smsPhone = settings.sms_number || phone;
  const email = settings.email || config.email || '';
  const serviceArea = config.service_area || 'Your Local Area';
  const cta = config.cta_text || 'Get My Free Quote';
  const links = config.links || [];
  const copyright = `(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`;

  return `
    <footer style="padding: 60px 20px; background: #0f172a; color: #f8fafc; margin-top: 80px; border-top: 4px solid var(--primary-color);">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 40px; margin-bottom: 40px;">
          <div>
            <h3 style="color: white; font-size: 1.5rem; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px;">${escapeHtmlText(businessName)}</h3>
            <p style="color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 24px;">
              Providing professional exterior cleaning and restoration services with a focus on quality, reliability, and customer satisfaction.
            </p>
            <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6; font-weight: 600;">
              <span>Serving ${escapeHtmlText(serviceArea)}</span>
            </div>
          </div>
          <div>
            <h4 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Navigation</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${links.map((l: any) => {
                const rawPath = String(l.path || '');
                const isSpecialScheme = rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('tel:') || rawPath.startsWith('mailto:');
                const href = safeNavHref(rawPath);
                const clickHandler = isSpecialScheme
                  ? ''
                  : `data-nav-path="${escapeHtmlText(rawPath)}" onclick="event.preventDefault(); window.navigateTo('site', this.getAttribute('data-nav-path'))"`;
                return `
                  <a href="${escapeHtmlText(href)}"
                     ${clickHandler}
                     style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: all 0.2s;" onmouseover="this.style.color='white'; this.style.paddingLeft='4px'" onmouseout="this.style.color='#94a3b8'; this.style.paddingLeft='0'">
                    ${escapeHtmlText(l.label)}
                  </a>
                `;
              }).join('')}
            </div>
          </div>
          <div>
            <h4 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Contact Us</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">Questions? Call or text us directly for immediate assistance.</p>
            <a href="tel:${phone}" style="display: flex; align-items: center; gap: 12px; color: white; text-decoration: none; font-size: 1.4rem; font-weight: 800; margin-bottom: 20px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
               <span style="background: var(--primary-color); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.1rem;">Call</span>
               <span>${phone}</span>
            </a>
            ${smsPhone ? `
              <a href="sms:${smsPhone}?body=Hi, I'd like a quote for pressure washing." style="display: flex; align-items: center; gap: 12px; color: #94a3b8; text-decoration: none; font-size: 0.95rem; margin-bottom: 20px; font-weight: 500;">
                 <span style="background: #1e293b; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem;">SMS</span>
                 <span>Text us</span>
              </a>
            ` : ''}
            ${email ? `
              <a href="mailto:${email}" style="display: flex; align-items: center; gap: 12px; color: #94a3b8; text-decoration: none; font-size: 0.95rem; margin-bottom: 20px; font-weight: 500;">
                 <span style="background: #1e293b; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem;">Email</span>
                 <span>${email}</span>
              </a>
            ` : ''}
            <button class="btn-primary" style="width: 100%; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 1rem; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4); border: none; cursor: pointer;" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
              ${cta}
            </button>
          </div>
        </div>
        <div style="padding-top: 30px; border-top: 1px solid #1e293b; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; color: #64748b; font-size: 0.85rem;">
          <div>${copyright}</div>
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">-</span> Fully Insured</span>
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">-</span> Licensed Professionals</span>
          </div>
          <button onclick="window.navigateTo('dashboard')" style="background: none; border: 1px solid #334155; padding: 6px 16px; border-radius: 6px; cursor: pointer; color: inherit; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.borderColor='#475569'; this.style.color='white'" onmouseout="this.style.borderColor='#334155'; this.style.color='inherit'">
            Admin Access
          </button>
        </div>
      </div>
    </footer>
  `;
}

function render404(message?: string) {
  document.title = 'Site not found';
  updateMetaTag('description', '');
  updateMetaTag('keywords', '');
  app.innerHTML = `
    <div style="padding: 100px; text-align: center; font-family: 'Inter', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="font-size: 8rem; font-weight: 900; color: #e2e8f0; margin: 0; line-height: 1;">404</h1>
      <h2 style="font-size: 2rem; color: #1e293b; margin-top: -20px; font-weight: 800;">Page Not Found</h2>
      <p style="color: #64748b; margin: 20px 0 40px; font-size: 1.1rem; max-width: 400px; line-height: 1.6;">
        ${message || 'The requested URL was not found on this server.'}
      </p>
      <div style="display: flex; gap: 16px;">
        <button class="btn-primary" onclick="window.location.href='/'" style="padding: 12px 30px; border-radius: 50px;">Go Home</button>
        <button style="background: white; border: 1px solid #e2e8f0; padding: 12px 30px; border-radius: 50px; cursor: pointer; font-weight: 600; color: #475569;" onclick="window.navigateTo('dashboard')">Back to CRM</button>
      </div>
    </div>
  `;
}

let activeWebsiteContext: any = null;

function normalizePreviewPath(path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath === '/home' ? '/' : cleanPath;
}

function resolvePageForPreviewPath(path: string = '/', funnelId?: string): any | null {
  const normalizedPath = normalizePreviewPath(path);
  if (normalizedPath === '/') {
    return mockPages.find((p: any) => p.slug === 'home' || p.name?.toLowerCase() === 'home') || null;
  }

  const slug = normalizedPath.replace(/^\//, '');
  const route = mockWebsiteRoutes.find((r: any) => normalizePreviewPath(r.path || '/') === normalizedPath);
  return mockPages.find((p: any) => p.slug === slug)
    || mockPages.find((p: any) => route?.funnel_id && p.funnel_id === route.funnel_id && p.slug === slug)
    || mockPages.find((p: any) => funnelId && p.funnel_id === funnelId && p.slug === slug)
    || null;
}

function hydratePreviewSectionsForPage(pageId: string): void {
  hydrateBuilderSectionsFromLocalStorage(pageId);
}

function resolveWebsitePathFromBrowserPath(rawPath: string): string | null {
  if (rawPath === '/site' || rawPath === '/preview') return '/';
  if (rawPath.startsWith('/site/')) return rawPath.replace('/site/', '/');
  if (rawPath.startsWith('/preview/')) return rawPath.replace('/preview/', '/');

  const normalizedPath = normalizePreviewPath(rawPath);
  if (normalizedPath === '/') return null;
  const isKnownWebsiteRoute = mockWebsiteRoutes.some((route: any) =>
    normalizePreviewPath(route.path || '/') === normalizedPath
  );
  return isKnownWebsiteRoute ? normalizedPath : null;
}

function createResolvedWebsiteRenderContext(result: any, targetPath: string): any {
  if (!result?.website) return null;
  return {
    ...result.website,
    route: result.route,
    route_id: result.route?.id,
    path: result.route?.path || targetPath,
    slug: result.route?.slug || targetPath.replace(/^\//, ''),
    is_seo_page: result.route?.is_seo_page || targetPath !== '/',
    city: result.route?.city || '',
    service: result.route?.service || '',
    route_type: result.route?.route_type || (targetPath === '/' ? 'homepage' : 'service'),
    funnel_id: result.funnel_id || result.route?.funnel_id || '',
    page_id: result.route?.id || ''
  };
}

function resolveExactPublicPage(
  website: Website,
  route: WebsiteRoute | undefined,
  path: string,
  funnelId: string
): Page | null {
  const normalizedPath = normalizePreviewPath(path);
  const exactRoute = route?.website_id === website.id
    ? route
    : mockWebsiteRoutes.find(candidate => (
      candidate.website_id === website.id
      && normalizePreviewPath(candidate.path || '/') === normalizedPath
    ));
  const routeWithPage = exactRoute as (WebsiteRoute & { page_id?: string }) | undefined;
  if (routeWithPage?.page_id) {
    const routedPage = mockPages.find(candidate => candidate.id === routeWithPage.page_id);
    if (routedPage) return routedPage;
  }

  if (normalizedPath === '/') {
    return mockPages.find(candidate => (
      candidate.slug === 'home' || candidate.name?.toLowerCase() === 'home'
    )) || mockPages.find(candidate => candidate.funnel_id === funnelId) || null;
  }

  const requestedSlug = exactRoute?.slug || normalizedPath.replace(/^\//, '');
  return mockPages.find(candidate => (
    candidate.funnel_id === (exactRoute?.funnel_id || funnelId)
    && candidate.slug === requestedSlug
  )) || mockPages.find(candidate => candidate.slug === requestedSlug)
    || mockPages.find(candidate => candidate.funnel_id === (exactRoute?.funnel_id || funnelId))
    || null;
}

function renderPublicPublicationUnavailable(): void {
  document.title = 'Page temporarily unavailable';
  updateMetaTag('description', 'This page is temporarily unavailable. Please try again later.');
  updateMetaTag('keywords', '');
  app.innerHTML = `
    <main class="public-site" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; background: #f8fafc; font-family: 'Inter', sans-serif;">
      <div style="max-width: 520px; text-align: center; padding: 48px 32px; border: 1px solid #e2e8f0; border-radius: 18px; background: white; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);">
        <h1 style="margin: 0 0 14px; color: #0f172a; font-size: 2rem;">This page is temporarily unavailable.</h1>
        <p style="margin: 0; color: #64748b; font-size: 1rem; line-height: 1.6;">Please try again later.</p>
      </div>
    </main>
  `;
}

function renderPublicLeadFormFallback(page: any, sections: any[], settings: any): string {
  if (!page || sections.some(section => section.type === 'form')) {
    return '';
  }

  const anchorSection = sections.find(section => section.page_id === page.id) || sections[0];
  if (!anchorSection?.id) {
    return '';
  }

  const serviceName = activeWebsiteContext?.service || activeWebsiteContext?.route?.service || page.name || 'Pressure Washing';
  const formContent = {
    title: 'Request a Quote',
    submit_label: 'Request Quote',
    service: serviceName,
    business_name: settings.business_name,
    phone: settings.phone
  };

  return `
    <section id="quote-form" class="public-lead-form-section" style="padding: 90px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
      <div style="max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 500px); gap: 48px; align-items: center;">
        <div>
          <p style="margin: 0 0 12px 0; color: var(--primary-color); font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem;">Fast local estimate</p>
          <h2 style="font-size: clamp(2rem, 5vw, 3.25rem); line-height: 1.05; margin: 0 0 20px 0; color: #0f172a; font-weight: 900;">Request a Quote</h2>
          <p style="font-size: 1.1rem; line-height: 1.7; color: #475569; margin: 0;">Tell us where you need help and we will follow up with next steps for ${serviceName}.</p>
        </div>
        ${renderStandardForm(anchorSection.id, formContent, true)}
      </div>
    </section>
  `;
}



async function renderSitePage(
  funnel_id: string,
  websiteOrContext: any,
  isPreview: boolean = false,
  edgeModel?: PublicSiteRenderModel,
  authoritativePage?: Page
) {
  const renderSequence = ++publicSiteRenderSequence;
  // Store context for lead submission (Phase W3.8)
  activeWebsiteContext = websiteOrContext;
  const website = websiteOrContext as Website;
  
  // 1. Resolve Data
  // In the resolver, it correctly identifies the funnel_id.
  
  // 2. Identify primary page/step in that funnel
  const resolvedPath = websiteOrContext?.route?.path || websiteOrContext?.path || '/';
  const resolvedPage = resolveSiteRenderPage({
    funnelId: funnel_id,
    authoritativePage,
    edgePage: edgeModel?.page as Page | undefined,
    preview: isPreview,
    resolvePreviewPage: () => resolvePageForPreviewPath(resolvedPath, funnel_id),
    resolvePreviewFunnelFallback: () => mockPages.find(candidate => candidate.funnel_id === funnel_id) || null,
    resolvePublicPage: () => resolveExactPublicPage(
      website,
      websiteOrContext?.route,
      resolvedPath,
      funnel_id
    )
  });

  if (!resolvedPage) {
    render404('No content mapped to this page.');
    return;
  }

  let page: any = resolvedPage;
  let sourceSections: PageSection[];
  if (isPreview) {
    hydratePreviewSectionsForPage(resolvedPage.id);
    sourceSections = mockPageSections.filter(section => section.page_id === resolvedPage.id);
  } else if (edgeModel) {
    sourceSections = edgeModel.sections as PageSection[];
  } else {
    app.innerHTML = `
      <main class="public-site" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-family: 'Inter', sans-serif; color: #64748b;">
        <p role="status">Loading page…</p>
      </main>
    `;
    let publicationResult;
    try {
      publicationResult = await loadBuilderPublicRevision(
        window.localStorage,
        website.id,
        resolvedPage.id
      );
    } catch {
      publicationResult = {
        state: 'publication-error' as const,
        error: 'Published page data is unavailable.'
      };
    }
    if (renderSequence !== publicSiteRenderSequence) return;

    if (publicationResult.state === 'publication-error') {
      console.error('[Public site] Selected published revision is unavailable.');
      renderPublicPublicationUnavailable();
      return;
    }
    if (publicationResult.state === 'published') {
      page = publicationResult.revision.document.page;
      sourceSections = builderDocumentToPageSections(
        publicationResult.revision.document
      );
    } else {
      if (resolvedPage.status !== 'published') {
        render404('This page is currently a draft.');
        return;
      }
      hydratePreviewSectionsForPage(resolvedPage.id);
      sourceSections = mockPageSections.filter(section => section.page_id === resolvedPage.id);
    }
  }

  const settings = edgeModel?.settings || getWebsiteSettings();
  const layout = edgeModel?.layout
    || mockWebsiteLayouts.find(l => l.website_id === website.id)
    || getWebsiteLayout()
    || { header_config: { nav_items: [] }, footer_config: {} };
  
  // W6.5: Robust Internal Linking System
  const contactRoute = edgeModel ? undefined : mockWebsiteRoutes.find(r => r.website_id === website.id && (r.path === '/contact' || r.path === '/quote'));
  const contactLink = contactRoute ? `/site${contactRoute.path}` : '/site/contact';
  const homeLink = '/site/';
  
  // Identify all service routes for cross-linking
  const serviceRoutes = (edgeModel ? [] : mockWebsiteRoutes)
    .filter(r => r.website_id === website.id && r.path !== '/' && r.path !== '/contact' && r.path !== '/quote')
    .map(r => ({ 
      ...r, 
      funnel_name: mockFunnels.find(f => f.id === r.funnel_id)?.name || 'Service' 
    }));

  const sections = sourceSections
    .filter(section => section.styles?.visible !== false)
    .sort((a, b) => a.order - b.order)
    .map(section => {
      // Create a copy of content to avoid mutating the mock database directly every render
      const content = { ...section.content, business_name: settings.business_name, phone: settings.phone };
      
      // Smart Link CTAs based on page context
      if (!edgeModel && ['hero', 'offer', 'cta'].includes(section.type) && !content.button_link) {
        if (page.name.toLowerCase().includes('contact')) {
          content.button_link = homeLink; // Contact pages link back home
          if (!content.button_text) content.button_text = 'Back to Homepage';
        } else {
          content.button_link = contactLink; // Service pages link to contact
          if (!content.button_text) content.button_text = 'Get Free Estimate';
        }
      }

      // Populate service lists automatically
      if (!edgeModel && section.type === 'services') {
        content.service_routes = serviceRoutes;
      }
      
      return { ...section, content };
    });
  activeRenderedPublicSections = sections;
  activeRenderedPublicPreview = isPreview;

  // Inject Tracking Scripts
  if (!isPreview) {
    if (settings.facebook_pixel_id) {
      const script = document.createElement('script');
      script.innerHTML = `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${settings.facebook_pixel_id}'); fbq('track', 'PageView');
        `;
      document.head.appendChild(script);
    }
    if (settings.gtm_id) {
      const script = document.createElement('script');
      script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s),j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtm_id}');`;
      document.head.appendChild(script);
    }
  }

  app.innerHTML = `
    <div class="public-site ${!isPreview ? 'has-cta-bar' : ''}" style="min-height: 100vh; background: white; font-family: 'Inter', sans-serif;">
      ${isPreview ? `<div style="background: #fdf2f2; color: #dc2626; padding: 10px; text-align: center; font-weight: 700; border-bottom: 1px solid #fee2e2; position: sticky; top: 0; z-index: 9999;">PREVIEW MODE: You are viewing a draft version of "${page.name}"</div>` : ''}
      
      ${!isPreview ? `
        <div id="site-cta-bar" class="cta-bar">
          <a href="tel:${settings.phone}" class="cta-bar-btn cta-bar-btn--call">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <span>Call Now</span>
          </a>
          <a href="sms:${settings.sms_number || settings.phone}?body=Hi, I'd like a quote for pressure washing." class="cta-bar-btn" style="background: #0ea5e9; color: white; display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
            <span>Text Photos</span>
          </a>
          <button class="cta-bar-btn cta-bar-btn--quote" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>Get Free Quote</span>
          </button>
        </div>
      ` : ''}

      ${renderPublicHeader(layout.header_config, settings)}

      ${sections.map(section => {
        // 🌿 Fix.7: Inject global variables into section content with auto-replacement (Phase Fix.7)
        let contentJson = JSON.stringify(section.content);
        const smsCta = settings.sms_number || settings.phone;
        const publicBusinessName = settings.business_name || '';
        const publicPhone = settings.phone || '';
        contentJson = contentJson
          .replace(/{{business_name}}/g, publicBusinessName)
          .replace(/{{phone}}/g, publicPhone)
          .replace(/{{sms_number}}/g, smsCta || '')
          .replace(/{{email}}/g, settings.email || '');
          
        const content = { ...JSON.parse(contentJson), business_name: publicBusinessName, phone: publicPhone, sms_number: smsCta, email: settings.email };
        return renderSection(section.type, content, section.styles, section.id, section.variant);
      }).join('')}

      ${edgeModel ? '' : renderPublicLeadFormFallback(page, sections, settings)}

      ${renderPublicFooter(layout.footer_config, settings)}
    </div>
  `;

  // Update SEO
  const seoTitle = page.seo_title || page.name;
  document.title = `${seoTitle} | ${settings.business_name}`;
  updateMetaTag('description', page.seo_description || '');
  updateMetaTag('keywords', (page.seo_keywords || []).join(', '));

  // Public form submission still requires a separate validated, rate-limited
  // lead endpoint. The current browser interception is not the production write boundary.

  // Tracking Simulations (Phase Debug)
  if ((window as any).mockGlobalSettings?.fbPixelId) {
    if (!document.getElementById('fb-pixel-sim')) {
      const t = document.createElement('script');
      t.id = 'fb-pixel-sim';
      t.innerHTML = `console.log("FB Pixel [${(window as any).mockGlobalSettings.fbPixelId}] Initialized"); window.fbq = function() { console.log('fbq:', arguments); };`;
      document.head.appendChild(t);
    }
  }
  if ((window as any).mockGlobalSettings?.gtmId) {
    if (!document.getElementById('gtm-sim')) {
      const t = document.createElement('script');
      t.id = 'gtm-sim';
      t.innerHTML = `console.log("GTM [${(window as any).mockGlobalSettings.gtmId}] Initialized"); window.dataLayer = window.dataLayer || [];`;
      document.head.appendChild(t);
    }
  }
}

async function renderConfiguredPublicSite(path: string): Promise<void> {
  if (!publicSiteRuntime.success) {
    renderPublicPublicationUnavailable();
    return;
  }
  if (publicSiteRuntime.value.source === 'local') {
    const result = await resolveWebsiteRequest(window.location.hostname, path);
    if (result?.funnel_id) {
      await renderSitePage(
        result.funnel_id,
        createResolvedWebsiteRenderContext(result, normalizePreviewPath(path))
      );
    } else {
      render404('Site not found.');
    }
    return;
  }

  const location = derivePublicSiteLocation({
    pathname: path === '/' ? '/site' : `/site${path}`,
    hostname: window.location.hostname,
    source: 'edge',
    production: publicSiteEnvironment.PROD === true,
    developmentHostOverride: publicSiteHostOverride
  });
  if (!location.success) {
    renderPublicPublicationUnavailable();
    return;
  }

  const requestKey = JSON.stringify([
    publicSiteRuntime.value.endpoint, location.host, location.path
  ]);
  if (publicSitePendingKey === requestKey && publicSitePendingRequest) {
    return publicSitePendingRequest;
  }

  publicSiteAbortController?.abort();
  const controller = new AbortController();
  publicSiteAbortController = controller;
  const renderSequence = ++publicSiteRenderSequence;
  app.innerHTML = `
    <main class="public-site" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-family: 'Inter', sans-serif; color: #64748b;">
      <p role="status">Loading pageâ€¦</p>
    </main>
  `;

  const pending = (async () => {
    const result = await getPublicSitePayload(window.fetch.bind(window), {
      endpoint: publicSiteRuntime.value.source === 'edge'
        ? publicSiteRuntime.value.endpoint
        : '',
      host: location.host,
      path: location.path,
      signal: controller.signal
    });
    if (controller.signal.aborted || renderSequence !== publicSiteRenderSequence) return;

    if (result.state === 'not-found') {
      render404('Site not found.');
      return;
    }
    if (result.state !== 'success' && result.state !== 'not-modified') {
      renderPublicPublicationUnavailable();
      return;
    }

    const model = adaptPublicSitePayload(result.payload);
    const context = {
      ...model.website,
      route: model.route,
      path: model.route.path,
      funnel_id: model.route.funnel_id,
      page_id: model.page.id,
      route_type: model.route.path === '/' ? 'homepage' : 'service'
    };
    await renderSitePage(model.route.funnel_id, context, false, model);
  })().finally(() => {
    if (publicSitePendingKey === requestKey) {
      publicSitePendingKey = null;
      publicSitePendingRequest = null;
    }
  });
  publicSitePendingKey = requestKey;
  publicSitePendingRequest = pending;
  return pending;
}

function updateMetaTag(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content || '');
}

function renderSection(type: string, content: any, styles: any, id: string, variant?: string) {
  return `
    <section id="section-${id}" style="
      padding: ${styles.padding || '60px 20px'};
      text-align: ${styles.text_alignment || styles.alignment || styles.textAlign || 'left'};
      background-image: ${content.background_image ? `url('${content.background_image}')` : 'none'};
      background-size: cover;
      background-position: center;
      background-color: ${styles.background || styles.backgroundColor || 'transparent'};
      color: ${styles.color || (content.background_image ? 'white' : 'inherit')};
      width: ${styles.width || '100%'};
      margin: 0 auto;
      min-height: ${type === 'hero' ? '70vh' : 'auto'};
      display: flex;
      flex-direction: column;
      justify-content: ${type === 'hero' ? 'center' : 'flex-start'};
      position: relative;
    ">
      ${content.background_image ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4);"></div>` : ''}
      <div style="position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; width: 100%;">
        ${renderSectionBody(type, content, styles, id, variant)}
      </div>
    </section>
  `;
}

function renderSectionBody(type: string, content: any, styles: any, id: string, variant?: string) {
  switch (type) {
    case 'hero':
      return `
        <h1 style="font-size: clamp(2.8rem, 8vw, 4.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.05; letter-spacing: -0.02em;">${content.heading || 'Hero Heading'}</h1>
        <p style="font-size: clamp(1.1rem, 3vw, 1.4rem); opacity: 0.9; margin-bottom: 3rem; max-width: 700px; margin-left: ${styles.text_alignment === 'center' ? 'auto' : '0'}; margin-right: ${styles.text_alignment === 'center' ? 'auto' : '0'}; line-height: 1.6;">${content.subheading || 'Hero Subheading'}</p>
        <${content.button_link ? 'a href="' + content.button_link + '"' : 'button'} class="btn-primary" style="display: ${styles.text_alignment === 'center' ? 'inline-block' : 'inline-flex'}; text-decoration: none; padding: 20px 48px; font-size: 1.25rem; border-radius: 60px; font-weight: 800; cursor: pointer; border: none; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);"
                ${!content.button_link ? 'onclick="document.querySelector(\'.site-form-section\')?.scrollIntoView({behavior: \'smooth\'})"' : ''}>
          ${content.button_text || 'Get Started'}
        </${content.button_link ? 'a' : 'button'}>
      `;
    case 'proof': {
      const tests: any[] = content.testimonials || [];
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px;">${content.title || 'Trusted By Local Homeowners'}</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;">
            ${tests.map((t: any) => `
              <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; text-align: left;">
                <div style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 16px;">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p style="font-size: 1rem; line-height: 1.7; font-style: italic; margin-bottom: 24px; color: #475569;">&ldquo;${t.quote}&rdquo;</p>
                <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">&mdash; ${t.name}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'offer':
      return `
        <div style="background: #4f46e5; color: white; padding: 80px 40px; border-radius: 30px; text-align: center; box-shadow: 0 30px 60px -12px rgba(79, 70, 229, 0.25);">
          <div style="display: inline-block; background: rgba(255,255,255,1); color: #4f46e5; padding: 6px 18px; border-radius: 30px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; margin-bottom: 24px; letter-spacing: 0.1em;">Special Deal</div>
          <h2 style="font-size: clamp(2.5rem, 6vw, 3.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1;">${content.headline || 'Ready to Start?'}</h2>
          <p style="font-size: 1.3rem; opacity: 0.9; margin-bottom: 3.5rem; max-width: 650px; margin-left: auto; margin-right: auto; line-height: 1.6;">${content.description || 'Join hundreds of happy customers today.'}</p>
          <${content.button_link ? 'a href="' + content.button_link + '"' : 'button'} class="btn-primary" 
                  style="display: inline-block; text-decoration: none; background: white; color: #4f46e5; border: none; padding: 22px 55px; font-size: 1.35rem; border-radius: 60px; font-weight: 900; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);"
                  onmouseover="this.style.transform='translateY(-4px) scale(1.05)'; this.style.boxShadow='0 30px 60px -15px rgba(0,0,0,0.3)'"
                  onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 20px 40px -10px rgba(0,0,0,0.2)'"
                  ${!content.button_link ? 'onclick="document.querySelector(\'.site-form-section\')?.scrollIntoView({behavior: \'smooth\'})"' : ''}>
            ${content.button_text || 'Claim My Offer'}
          </${content.button_link ? 'a' : 'button'}>
          <div style="margin-top: 30px; font-size: 1rem; opacity: 0.8; font-weight: 700; letter-spacing: 0.02em;">${content.expiry || 'Limited time remaining.'}</div>
        </div>`;
    case 'gallery': {
      const items: any[] = content.items || [];
      if (variant === 'grid') {
        return `
          <div style="text-align: center;">
            <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px;">${content.title || 'Project gallery'}</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 24px;">
              ${items.map((item: any) => `<img src="${escapeBuilderInspectorHtml(item.after || '')}" alt="${escapeBuilderInspectorHtml(item.alt || '')}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 18px; background: #e2e8f0;">`).join('')}
            </div>
          </div>`;
      }
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px;">${content.title || 'Before & After Results'}</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 40px;">
            ${items.map((item: any) => `
              <div style="background: white; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e2e8f0; position: relative;">
                  <div style="position: relative;">
                    <img src="${item.before}" style="width: 100%; aspect-ratio: 1.2; object-fit: cover;">
                    <span style="position: absolute; bottom: 15px; left: 15px; background: rgba(0,0,0,0.8); color: white; padding: 4px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em;">BEFORE</span>
                  </div>
                  <div style="position: relative;">
                    <img src="${item.after}" style="width: 100%; aspect-ratio: 1.2; object-fit: cover;">
                    <span style="position: absolute; bottom: 15px; right: 15px; background: #10b981; color: white; padding: 4px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em;">AFTER</span>
                  </div>
                </div>
                <div style="padding: 24px; font-size: 0.95rem; color: #64748b; font-weight: 700; background: #f8fafc; letter-spacing: 0.01em;">
                  Property Restoration Complete.
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'form':
      return `
        <div class="site-form-section" style="max-width: 600px; margin: 0 auto; background: white; padding: 50px; border-radius: 30px; box-shadow: 0 40px 60px -15px rgba(0,0,0,0.1); border: 1px solid #f1f5f9;">
          <h2 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 15px; text-align: center;">${content.title || 'Get My Free Quote'}</h2>
          <p style="text-align: center; color: #64748b; margin-bottom: 40px; font-weight: 600;">Fill out the form below and we'll be in touch within 15 minutes.</p>
          ${renderStandardForm(id, content, true)}
        </div>`;
    case 'services': {
      const routes: any[] = content.service_routes || [];
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 900; margin-bottom: 15px;">${content.title || 'Our Services'}</h2>
          <p style="color: #64748b; font-size: 1.15rem; margin-bottom: 50px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;">${content.subtitle || 'Professional cleaning solutions for every part of your property.'}</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
            ${routes.map((r: any) => `
              <div class="service-card" style="background: white; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-8px)'; this.style.borderColor='var(--primary-color)'" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='#e2e8f0'">
                <div style="background: #f0f7ff; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 24px;">✨</div>
                <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 12px; color: #1e293b;">${r.funnel_name}</h3>
                <p style="color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px;">Professional restoration for your ${r.funnel_name.toLowerCase()}.</p>
                <a href="#/site${r.path}" style="color: var(--primary-color); font-weight: 700; text-decoration: none; font-size: 1rem; display: inline-flex; align-items: center; gap: 8px;">Learn More <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></a>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      return `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px; text-align: center;">${content.heading || 'Frequently Asked Questions'}</h2>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="site-faq-item" style="border: 2px solid #f1f5f9; border-radius: 20px; overflow: hidden; background: white; transition: all 0.3s ease;">
                <button onclick="this.closest('.site-faq-item').classList.toggle('open')"
                        style="width: 100%; text-align: left; padding: 28px 32px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; font-weight: 800; color: #1e293b; outline: none;">
                  <span>${faq.question || 'Question ' + (idx + 1)}</span>
                  <span class="faq-chevron" style="font-size: 0.9rem; color: #94a3b8; transition: transform 0.3s ease;">▼</span>
                </button>
                <div class="faq-answer-wrap" style="padding: 0 32px; max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                  <p style="padding-bottom: 32px; color: #475569; line-height: 1.8; font-size: 1.1rem; font-weight: 500;">${faq.answer || 'Answer goes here...'}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            .site-faq-item.open { border-color: #4f46e5 !important; box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
            .site-faq-item.open .faq-chevron { transform: rotate(180deg); color: #4f46e5 !important; }
            .site-faq-item.open .faq-answer-wrap { max-height: 500px !important; }
          </style>
        </div>`;
    }
    default:
      return `<div style="padding: 40px; text-align: center; color: #999; border: 2px dashed #eee; border-radius: 12px; margin: 40px;">Legacy Section Type: ${type}</div>`;
  }
}


function renderReports() {
  renderAppWithShell({
    activeView: 'reports',
    title: 'Reports & Insights',
    contentVariant: 'wide',
    contentHtml: `
      <div class="stats-grid">
        <div class="card">
          <h3>Lead Sources</h3>
          <div class="chart-placeholder">Lead Distribution Chart</div>
          <div class="report-item"><span>Google Search</span> <span>45%</span></div>
          <div class="report-item"><span>Facebook Ads</span> <span>30%</span></div>
          <div class="report-item"><span>Referrals</span> <span>25%</span></div>
        </div>
        <div class="card">
          <h3>Revenue Breakdown</h3>
          <div class="chart-placeholder">Revenue Over Time</div>
          <div class="report-item"><span>House Washing</span> <span>$5,200</span></div>
          <div class="report-item"><span>Gutter Cleaning</span> <span>$1,800</span></div>
          <div class="report-item"><span>Roof Cleaning</span> <span>$3,400</span></div>
        </div>
      </div>
    `
  });
}

(window as any).showAttachToWebsiteModal = (funnelId: string) => {
    const userId = getActingUserId();
    const ownedWebsites = mockWebsites.filter(w => w.user_id === userId);
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId)
      ?? (ownedWebsites.length === 1 ? ownedWebsites[0] : undefined);
    if (!website) {
      const selector = document.createElement('div');
      selector.id = 'attach-modal';
      selector.innerHTML = `<div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;"><div class="card" style="width: 100%; max-width: 500px; padding: 35px;"><h3>Choose a website</h3><p>Select the owned website where this page should be attached.</p><label for="attachment-website-select">Website</label><select id="attachment-website-select"><option value="">Select a website</option>${ownedWebsites.map(site => `<option value="${escapeBuilderInspectorHtml(site.id)}">${escapeBuilderInspectorHtml(site.name)}</option>`).join('')}</select><div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;"><button class="btn-outline" onclick="document.getElementById('attach-modal').remove()">Cancel</button><button class="btn-primary" onclick="window.selectWebsiteForAttachment('${escapeBuilderInspectorHtml(funnelId)}', (document.getElementById('attachment-website-select')).value)">Continue</button></div></div></div>`;
      document.body.appendChild(selector);
      return;
    }
    const existingRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
    
    const modal = document.createElement('div');
    modal.id = 'attach-modal';
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div class="card" style="width: 100%; max-width: 500px; padding: 35px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0; margin-bottom: 24px;">Connect Page to Web Address</h3>
                
                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px; display: block;">Option 1: Use an Existing Web Address</label>
                    <select id="existing-route-select" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc;">
                        <option value="">-- Or Create New Address Below --</option>
                        ${existingRoutes.map(r => {
                          const fName = mockFunnels.find(f => f.id === r.funnel_id)?.name || 'Untitled';
                          return `<option value="${r.id}">${r.path} (Currently shows: ${fName})</option>`;
                        }).join('')}
                    </select>
                </div>

                <div style="text-align: center; margin: 24px 0; position: relative;">
                    <hr style="border: 0; border-top: 1px solid #e2e8f0;">
                    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 0 15px; color: #94a3b8; font-weight: 800; font-size: 0.7rem;">OR</span>
                </div>

                <div class="form-group" style="margin-bottom: 30px;">
                    <label style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px; display: block;">Option 2: Create a NEW Web Address</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem; font-weight: 800; color: #64748b;">/</span>
                        <input type="text" id="new-route-path-inp" placeholder="e.g. spring-special-2026" style="flex: 1; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 8px;" onclick="document.getElementById('attach-modal').remove()">Cancel</button>
                    <button class="btn-primary" style="padding: 12px 24px; border-radius: 8px; font-weight: 700;" onclick="window.saveWebsiteAttachment('${funnelId}', '${website.id}')">Confirm Connection</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

(window as any).selectWebsiteForAttachment = (funnelId: string, websiteId: string) => {
    const userId = getActingUserId();
    if (!mockWebsites.some(site => site.id === websiteId && site.user_id === userId)) {
      (window as any).showToast('Choose an owned website.', 'error');
      return;
    }
    activeDashboardWebsiteId = websiteId;
    document.getElementById('attach-modal')?.remove();
    (window as any).showAttachToWebsiteModal(funnelId);
};

(window as any).saveWebsiteAttachment = (funnelId: string, websiteId: string) => {
    if (blockUnsupportedProductionWebsiteMutation('Website page attachment')) return;
    const userId = getActingUserId();
    if (!mockWebsites.some(site => site.id === websiteId && site.user_id === userId)
        || !mockFunnels.some(funnel => funnel.id === funnelId && funnel.user_id === userId)) {
      (window as any).showToast('Website attachment is unavailable.', 'error');
      return;
    }
    const existingId = (document.getElementById('existing-route-select') as HTMLSelectElement).value;
    const newPath = (document.getElementById('new-route-path-inp') as HTMLInputElement).value.trim();
    
    if (existingId) {
        const route = mockWebsiteRoutes.find(r => r.id === existingId && r.website_id === websiteId);
        if (route) {
            route.funnel_id = funnelId;
            (window as any).showToast(`Path ${route.path} updated successfully!`, 2000);
        }
    } else if (newPath) {
        const normalized = '/' + newPath.replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === normalized)) {
            alert('This URL path is already assigned to another page.');
            return;
        }
        mockWebsiteRoutes.push({
            id: `r-${Date.now()}`,
            website_id: websiteId,
            path: normalized,
            funnel_id: funnelId,
            created_at: new Date().toISOString()
        } as any);
        (window as any).showToast(`Assigned to new path: ${normalized}`, 2000);
    } else {
        alert('Please select an existing path or define a new one.');
        return;
    }
    
    document.getElementById('attach-modal')?.remove();
    renderFunnelDetail(funnelId);
};

(window as any).openNewPageModal = (_sourceType: string = 'blank') => {
  const modal = document.createElement('div');
  modal.id = 'page-creation-modal';
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
      <div id="modal-content" style="background: white; border-radius: 20px; width: 100%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
        
        <div style="padding: 30px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 20px 20px 0 0;">
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: #1e293b;">Step 1: Select a Template</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Choose a starting point for your new page.</p>
          </div>
          <button onclick="document.getElementById('page-creation-modal').remove()" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px;">
           <div class="template-card" onclick="window.confirmPageTemplate('blank')" style="border: 2px dashed #cbd5e1; border-radius: 16px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='white'">
             <div style="font-size: 3rem; margin-bottom: 16px;">📄</div>
             <h3 style="margin: 0; color: #1e293b;">Blank Canvas</h3>
             <p style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">Start from scratch and build it your way.</p>
           </div>
           ${mockTemplates.map(tpl => `
             <div class="template-card" onclick="window.confirmPageTemplate('${tpl.id}')" style="border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-4px)'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)'">
               <div style="height: 140px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">🎨</div>
               <div style="padding: 16px;">
                 <h3 style="margin: 0; color: #1e293b; font-size: 1.1rem;">${tpl.name}</h3>
                 <p style="color: #64748b; font-size: 0.8rem; margin-top: 4px;">${tpl.category}</p>
               </div>
             </div>
           `).join('')}
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

(window as any).confirmPageTemplate = (templateId: string) => {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    const tpl = templateId === 'blank' ? null : mockTemplates.find(t => t.id === templateId);

    modalContent.innerHTML = `
        <div style="padding: 30px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 20px 20px 0 0;">
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: #1e293b;">Step 2: Name Your Page</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Give it a name that makes sense for your site.</p>
          </div>
          <button onclick="document.getElementById('page-creation-modal').remove()" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 40px; max-width: 500px; margin: 0 auto;">
           <div class="form-group" style="margin-bottom: 24px;">
              <label style="display: block; font-weight: 700; font-size: 0.9rem; color: #475569; margin-bottom: 10px;">Page Name</label>
              <input type="text" id="finalize_page_name" placeholder="e.g. Roof Cleaning Special" style="width: 100%; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key === 'Enter') window.finalizePageCreation('${templateId}')">
              <small style="color: #94a3b8; display: block; margin-top: 8px;">This will automatically create a web address at /${tpl?.name?.toLowerCase().replace(/\\s+/g, '-') || 'new-page'}</small>
           </div>
           
           <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
              <button onclick="window.openNewPageModal()" style="padding: 12px 24px; border: none; background: #f1f5f9; color: #475569; font-weight: 700; border-radius: 12px; cursor: pointer;">Back</button>
              <button onclick="window.finalizePageCreation('${templateId}')" class="btn-primary" style="padding: 12px 32px; font-weight: 800; border-radius: 12px;">Create & Build</button>
           </div>
        </div>
    `;
    setTimeout(() => document.getElementById('finalize_page_name')?.focus(), 100);
};

(window as any).finalizePageCreation = (templateId: string) => {
    if (blockUnsupportedProductionWebsiteMutation('Legacy page creation')) return;
    const input = document.getElementById('finalize_page_name') as HTMLInputElement;
    const name = input?.value.trim();
    if (!name) { alert('Please enter a name for your page.'); return; }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const funnelId = `fnl-${Date.now()}`;
    const pageId = `p-${Date.now()}`;
    const userId = getActingUserId();
    const ownedWebsites = mockWebsites.filter(site => site.user_id === userId);
    const website = mockWebsites.find(site => site.id === activeDashboardWebsiteId && site.user_id === userId)
      ?? (ownedWebsites.length === 1 ? ownedWebsites[0] : undefined);
    if (!website) {
        (window as any).showToast('Choose the website where this page should be created.', 'error');
        return;
    }
    const websiteId = website.id;

    // 1. Create Funnel
    mockFunnels.push({
        id: funnelId,
        user_id: getActingUserId(),
        name: name,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    // 2. Create Page
    const newPage = {
        id: pageId,
        user_id: getActingUserId(),
        funnel_id: funnelId,
        name: name,
        slug: slug,
        status: 'published',
        seo_title: `${name} | ${website.name}`,
        seo_description: '',
        seo_keywords: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    mockPages.push(newPage as any);

    // 3. Create Route
    mockWebsiteRoutes.push({
        id: `r-${Date.now()}`,
        website_id: websiteId,
        path: `/${slug}`,
        funnel_id: funnelId,
        created_at: new Date().toISOString()
    } as any);

    // 4. Apply Template Sections
    if (templateId !== 'blank') {
        const tpl = mockTemplates.find(t => t.id === templateId);
        if (tpl) {
            tpl.sections.forEach((sec: any, idx: number) => {
                mockPageSections.push({
                    id: `ps-${Date.now()}-${idx}`,
                    page_id: pageId,
                    type: sec.type,
                    content: { ...sec.content },
                    order: sec.order,
                    styles: { ...sec.styles }
                });
            });
        }
    }

    // 5. Success & Transition
    document.getElementById('page-creation-modal')?.remove();
    (window as any).showToast('Page created! Opening builder...', 2000);
    
    // Switch to builder for the new page
    (window as any).switchBuilderPage(pageId);
    (window as any).navigateTo('builder');
};


(window as any).duplicatePage = (id: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Page duplication')) return;
  const page = mockPages.find(p => p.id === id);
  if (!page) return;
  const newPage = {
    ...page,
    id: `p${Date.now()}`,
    name: `${page.name} (Copy)`,
    slug: `${page.slug}-copy`,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPages.push(newPage as any);

  const sections = mockPageSections.filter(s => s.page_id === id);
  sections.forEach(s => {
    mockPageSections.push({
      ...s,
      id: `ps${Date.now()}-${Math.random().toString().slice(2, 6)}`,
      page_id: newPage.id
    });
  });

  renderPages();
};

(window as any).togglePublish = (id: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Legacy page publishing')) return;
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.status = page.status === 'published' ? 'draft' : 'published';
    (page as any).updated_at = new Date().toISOString();
    renderPages();
  }
};

(window as any).generatePageWithAI = (id: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Legacy AI page generation')) return;
  // Mock AI generation
  mockPageSections.push({
    id: `ps-ai-${Date.now()}`,
    page_id: id,
    type: 'text',
    content: { text: '✨ This content was generated by AI specifically for this page.' },
    order: 1,
    styles: { padding: '40px', background: '#fdfbfe' }
  });
  (window as any).switchBuilderPage(id);
  (window as any).navigateTo('builder');
};

(window as any).applyTemplate = (id: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Legacy template application')) return;
  // Mock template application
  mockPageSections.push({
    id: `ps-tpl-${Date.now()}`,
    page_id: id,
    type: 'hero',
    content: { heading: 'Stunning Template Applied', subheading: 'Ready for you to customize visually!' },
    order: 1,
    styles: { background: '#2c3e50', color: '#ffffff' }
  });
  (window as any).switchBuilderPage(id);
  (window as any).navigateTo('builder');
};

function renderPages() {
  const tableRows = mockPages.map(page => {
    const lastEdited = (page as any).updated_at ? new Date((page as any).updated_at).toLocaleDateString() : new Date(page.created_at).toLocaleDateString();
    return `
    <tr class="clickable-row" onclick="window.switchBuilderPage('${page.id}'); window.navigateTo('builder');">
      <td style="font-weight: 600; color: var(--primary-color);">${page.name}</td>
      <td><code>/${page.slug}</code></td>
      <td><span class="badge badge-${page.status}">${page.status}</span></td>
      <td style="color: #666; font-size: 0.9rem;">${lastEdited}</td>
      <td>
        <div style="font-size: 0.85rem; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${page.seo_title}">
          ${page.seo_title}
        </div>
      </td>
      <td style="text-align: center;">
        <span class="badge" style="background: #eef2f6; color: #333;">${mockPageSections.filter(s => s.page_id === page.id).length}</span>
      </td>
      <td>
        <div style="display: flex; gap: 5px; flex-wrap: wrap; max-width: 420px;">
          <button class="btn-primary" style="padding: 5px 12px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.switchBuilderPage('${page.id}'); window.navigateTo('builder');">Edit Page</button>
          <button class="btn-outline" style="padding: 5px 12px; font-size: 0.8rem; border-color: #e2e8f0; color: #475569;" onclick="event.stopPropagation(); window.open('/site/${page.slug}', '_blank')">View Live</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6c757d;" onclick="event.stopPropagation(); window.duplicatePage('${page.id}')">Duplicate</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: ${page.status === 'published' ? '#ea580c' : '#28a745'};" onclick="event.stopPropagation(); window.togglePublish('${page.id}')">${page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #8a2be2;" onclick="event.stopPropagation(); window.generatePageWithAI('${page.id}')">✨ AI Gen</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  renderAppWithShell({
    activeView: 'pages',
    title: 'All Website Sections',
    headerActionsHtml: `
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button class="btn-primary" style="background: #6c757d; padding: 5px 15px; font-size: 0.85rem;" onclick="window.downloadSitemap()">Export sitemap.xml</button>
        <button class="btn-primary" style="background: #8a2be2;" onclick="window.openNewPageModal('ai')">✨ Generate with AI</button>
        <button class="btn-primary" style="background: #17a2b8;" onclick="window.openNewPageModal('template')">📄 Use Template</button>
        <button class="btn-primary" onclick="window.openNewPageModal('blank')">+ New Page</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0; min-width: 700px;">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Last Edited</th>
              <th>SEO Title</th>
              <th>Sections</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #666;">No pages found</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

function renderPageSections(pageId: string) {
  const page = mockPages.find(p => p.id === pageId);
  if (!page) return;

  const sections = mockPageSections
    .filter(s => s.page_id === pageId)
    .sort((a, b) => a.order - b.order);

  const tableRows = sections.map(section => `
    <tr>
      <td style="font-weight: 600;">#${section.order}</td>
      <td><span class="badge" style="background: #e9ecef; color: #495057;">${section.type.toUpperCase()}</span></td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(section.content, null, 2)}</pre>
      </td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(section.styles, null, 2)}</pre>
      </td>
      <td>
        <div style="display: flex; gap: 5px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="alert('Edit Section: ${section.id}')">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="alert('Delete Section: ${section.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  renderAppWithShell({
    activeView: 'page-sections',
    title: `Sections for: ${page.name}`,
    headerActionsHtml: `
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="window.navigateTo('pages')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
        <button class="btn-primary">+ Add Section</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0; min-width: 650px;">
          <thead>
            <tr>
              <th>Order</th>
              <th>Type</th>
              <th>Content (JSON)</th>
              <th>Styles (JSON)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #666;">No sections found for this page</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

function renderComponents() {
  const isPickerMode = builderInsertOrder !== null;

  let filtered = mockComponents;
  if (compSearchQuery) {
    filtered = filtered.filter(c => c.name.toLowerCase().includes(compSearchQuery) || c.type.toLowerCase().includes(compSearchQuery));
  }
  // All components are now top-tier structured sections, no categories needed.

  const gridItems = filtered.map(comp => `
    <div class="card" style="display: flex; flex-direction: column; gap: 15px;">
      <!-- Visual Preview -->
      <div style="width: 100%; height: 250px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; background: #f8fafc;">
        <div style="width: 200%; height: 500px; transform: scale(0.5); transform-origin: top left; pointer-events: none;">
           ${renderSection(comp.type, comp.default_content, comp.default_styles, comp.id)}
        </div>
      </div>
      
      <!-- Name & Type -->
      <div>
        <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary-color);">${comp.name}</h3>
        <span class="badge" style="background: #e9ecef; color: #495057; font-size: 0.7rem; margin-top: 5px; display: inline-block;">${comp.type.toUpperCase()}</span>
      </div>
      
      <!-- Actions -->
      <div style="display: flex; gap: 10px;">
        ${isPickerMode ? `
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: var(--primary-color);" onclick="window.addSectionToPage('${comp.id}')">Insert</button>
        ` : `
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Content for ${comp.name}')">Edit Content</button>
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Styles for ${comp.name}')">Edit Styles</button>
        `}
      </div>
      
      ${!isPickerMode ? `
      <!-- Advanced JSON -->
      <details style="background: #f8f9fa; border-radius: 6px; padding: 10px; border: 1px solid #e2e8f0;">
        <summary style="cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #666; outline: none;">Advanced JSON</summary>
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Content</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(comp.default_content, null, 2)}</pre>
          </div>
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Styles</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(comp.default_styles, null, 2)}</pre>
          </div>
        </div>
      </details>` : ''}
    </div>
  `).join('');

  if (isPickerMode) {
    currentShellController?.destroy();
    currentShellController = null;
    app.innerHTML = `
      <main style="width: 100vw; height: 100vh; overflow-y: auto; padding: 20px; box-sizing: border-box; background: white;">
        <header class="view-header" style="border-bottom: 1px solid #eee; padding-bottom: 20px; display: flex; flex-direction: column; gap: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <h2>Select Component to Insert</h2>
            <div>
              <button class="btn-primary" style="background: transparent; color: #666; border: 1px solid #ccc; margin-right: 10px;" onclick="window.cancelComponentPicker()">Cancel</button>
            </div>
          </div>
          <div style="display: flex; gap: 20px; align-items: center; width: 100%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap;">
            <input type="text" placeholder="Search components by name or type..." value="${compSearchQuery}" oninput="window.setCompSearch(this.value)" style="flex: 1; min-width: 250px; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; outline: none;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${['all', 'basic', 'layout', 'forms', 'advanced'].map(cat => `
                <button onclick="window.setCompCategory('${cat}')" style="padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${compCategoryFilter === cat ? 'var(--primary-color)' : '#e2e8f0'}; background: ${compCategoryFilter === cat ? 'var(--primary-color)' : 'white'}; color: ${compCategoryFilter === cat ? 'white' : '#64748b'};">${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
              `).join('')}
            </div>
          </div>
        </header>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; padding-top: 20px;">
          ${gridItems || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666; font-size: 1.1rem;">No components match your search.</div>'}
        </div>
      </main>
    `;
    return;
  }

  renderAppWithShell({
    activeView: 'components',
    title: 'Component Library',
    headerActionsHtml: `<button class="btn-primary" onclick="alert('Register New Component')">+ New Component</button>`,
    contentVariant: 'wide',
    contentHtml: `
      <div style="display: flex; gap: 20px; align-items: center; width: 100%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap; margin-bottom: 24px;">
        <input type="text" placeholder="Search components by name or type..." value="${compSearchQuery}" oninput="window.setCompSearch(this.value)" style="flex: 1; min-width: 250px; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; outline: none;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${['all', 'basic', 'layout', 'forms', 'advanced'].map(cat => `
            <button onclick="window.setCompCategory('${cat}')" style="padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${compCategoryFilter === cat ? 'var(--primary-color)' : '#e2e8f0'}; background: ${compCategoryFilter === cat ? 'var(--primary-color)' : 'white'}; color: ${compCategoryFilter === cat ? 'white' : '#64748b'};">${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
          `).join('')}
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px;">
        ${gridItems || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666; font-size: 1.1rem;">No components match your search.</div>'}
      </div>
    `
  });
}

(window as any).useTemplate = (templateId: string) => {
  if (blockUnsupportedProductionWebsiteMutation('Template page creation')) return;
  const template = templates.find((t: any) => t.id === templateId);
  if (!template) return;

  const newName = prompt('Enter new page name:', template.name + ' Copy');
  if (!newName) return;

  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const newPage = {
    id: `p${Date.now()}`,
    name: newName,
    slug: slug,
    status: 'draft',
    seo_title: newName,
    seo_description: '',
    seo_keywords: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPages.push(newPage as any);

  template.blocks.forEach((block: any, index: number) => {
    let mappedContent = { ...block.data };
    let mappedStyles: any = {
      background: '#ffffff',
      color: '#333333'
    };

    if (block.type === 'hero') {
      mappedContent = { heading: block.data.heading || block.data.title, subheading: block.data.subheading || block.data.subtitle, button_text: block.data.cta_text || block.data.buttonText };
      mappedStyles = { background: template.theme.primary, color: 'white', text_alignment: 'center', padding: '100px 20px' };
    } else if (block.type === 'services') {
      mappedContent = { heading: block.data.title, items: block.data.items };
      mappedStyles = { background: '#ffffff', color: '#333', padding: '80px 20px' };
    } else if (block.type === 'gallery') {
      mappedContent = { heading: block.data.title, images: block.data.images };
      mappedStyles = { background: '#fdfbfe', color: '#333', padding: '80px 20px' };
    } else if (block.type === 'contact') {
      mappedContent = { title: block.data.title, fields: block.data.fields || ['name', 'email', 'phone', 'message'] };
      mappedStyles = { background: template.theme.secondary, color: 'white', padding: '80px 20px' };
    }

    mockPageSections.push({
      id: `ps-tpl-${Date.now()}-${index}`,
      page_id: newPage.id,
      type: block.type === 'services' || block.type === 'gallery' ? 'text' : (block.type === 'contact' ? 'form' : block.type),
      content: mappedContent,
      order: index + 1,
      styles: mappedStyles
    });
  });

  (window as any).switchBuilderPage(newPage.id);
  (window as any).navigateTo('builder');
};

function renderTemplates() {
  const cardsHtml = templates.map((t: any) => `
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%;">
      <div style="height: 200px; width: 100%; background: #e2e8f0; background-image: url('${t.image}'); background-size: cover; background-position: center; border-bottom: 1px solid #e2e8f0;"></div>
      <div style="padding: 24px; flex: 1; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 1.25rem; color: var(--primary-color);">${t.name}</h3>
          <span class="badge" style="background: #eef2f6; color: #64748b; font-size: 0.75rem;">${t.category}</span>
        </div>
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 24px; flex: 1; line-height: 1.5;">${t.description}</p>
        <button class="btn-primary" style="width: 100%; padding: 14px; font-weight: 600; font-size: 1rem; border-radius: 8px;" onclick="window.useTemplate('${t.id}')">Use Template</button>
      </div>
    </div>
  `).join('');

  renderAppWithShell({
    activeView: 'templates',
    title: 'Website Templates',
    subtitle: 'Pre-designed templates for your handyman and pressure washing business.',
    contentVariant: 'wide',
    contentHtml: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; padding: 10px 0;">
        ${cardsHtml}
      </div>
    `
  });
}

function renderWebsiteSettingsSelector(websites: readonly Website[], invalid = false) {
  const fieldA11y = getFieldAccessibilityProps('settings-website-select', { hasError: invalid });

  const selectHtml = renderSelect({
    id: 'settings-website-select',
    className: 'wo-select',
    invalid: fieldA11y.invalid,
    describedBy: fieldA11y.describedBy,
    options: [
      { value: '', label: 'Select a website' },
      ...websites.map(site => ({
        value: site.id,
        label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}`
      }))
    ],
    attributes: {
      onchange: 'window.selectWebsiteForSettings(this.value)'
    }
  });

  const fieldHtml = renderField({
    id: 'settings-website-select',
    label: 'Website',
    controlHtml: selectHtml,
    errorMessage: invalid ? 'That website is not available for this account. Choose an owned website.' : undefined
  });

  const cardHtml = renderCard({
    title: 'Choose a website',
    bodyHtml: `
      <p style="margin-bottom: var(--wo-space-4); color: var(--wo-color-text-secondary);">${invalid ? 'That website is not available for this account. Choose an owned website.' : 'Select the website whose settings you want to manage.'}</p>
      ${fieldHtml}
    `,
    className: 'website-settings-selection'
  });

  const contentHtml = `
    <section class="website-settings-selection-container">
      ${cardHtml}
    </section>
  `;

  renderAppWithShell({
    activeView: 'website-settings',
    title: 'Website Branding & Tracking',
    contentVariant: 'standard',
    user: getCurrentShellUser(),
    contentHtml
  });
}

function renderWebsiteManagementSelector(view: WebsiteManagementView, websites: readonly Website[], invalid = false) {
  const labels: Record<WebsiteManagementView, string> = {
    'website-settings': 'Website Settings',
    'funnels': 'Site Pages',
    'website-navigation': 'Website Navigation',
    'website-structure': 'Website Structure',
    'seo-pages': 'SEO Pages'
  };

  const fieldA11y = getFieldAccessibilityProps('management-website-select', { hasError: invalid });

  const selectHtml = renderSelect({
    id: 'management-website-select',
    className: 'wo-select',
    invalid: fieldA11y.invalid,
    describedBy: fieldA11y.describedBy,
    options: [
      { value: '', label: 'Select a website' },
      ...websites.map(site => ({
        value: site.id,
        label: `${site.name}${site.domain ? ` — ${site.domain}` : ''}`
      }))
    ],
    attributes: {
      onchange: `window.selectWebsiteForManagement('${view}', this.value)`
    }
  });

  const fieldHtml = renderField({
    id: 'management-website-select',
    label: 'Website',
    controlHtml: selectHtml,
    errorMessage: invalid ? 'That website is not available for this account. Choose an owned website.' : undefined
  });

  const cardHtml = renderCard({
    title: 'Choose a website',
    bodyHtml: `
      <p style="margin-bottom: var(--wo-space-4); color: var(--wo-color-text-secondary);">${invalid ? 'That website is not available for this account. Choose an owned website.' : `Select the website whose ${labels[view].toLowerCase()} you want to manage.`}</p>
      ${fieldHtml}
    `,
    className: 'website-settings-selection'
  });

  const contentHtml = `
    <section class="website-settings-selection-container">
      ${cardHtml}
    </section>
  `;

  renderAppWithShell({
    activeView: view,
    title: labels[view],
    contentVariant: 'standard',
    user: getCurrentShellUser(),
    contentHtml
  });
}

function renderWebsiteManagementSwitcher(view: WebsiteManagementView): string {
  const userId = getActingUserId();
  const owned = mockWebsites.filter(site => site.user_id === userId);
  if (owned.length < 2 || !activeDashboardWebsiteId) return '';
  return `<div class="website-dashboard-selector"><label for="management-website-select">Active website</label><select id="management-website-select" onchange="window.selectWebsiteForManagement('${view}', this.value)">${owned.map(site => `<option value="${escapeBuilderInspectorHtml(site.id)}" ${site.id === activeDashboardWebsiteId ? 'selected' : ''}>${escapeBuilderInspectorHtml(site.name)}${site.domain ? ` — ${escapeBuilderInspectorHtml(site.domain)}` : ''}</option>`).join('')}</select></div>`;
}

function renderWebsiteSettings() {
  const settings = getWebsiteSettings();
  const userId = getActingUserId();
  const ownedWebsites = mockWebsites.filter(website => website.user_id === userId);
  applyPrimaryColor(settings.primary_color);
  const contentHtml = `
    ${ownedWebsites.length > 1 ? `<div class="website-dashboard-selector"><label for="settings-website-select">Active website</label><select id="settings-website-select" onchange="window.selectWebsiteForSettings(this.value)">${ownedWebsites.map(site => `<option value="${escapeBuilderInspectorHtml(site.id)}" ${site.id === activeSettingsWebsiteId ? 'selected' : ''}>${escapeBuilderInspectorHtml(site.name)}${site.domain ? ` — ${escapeBuilderInspectorHtml(site.domain)}` : ''}</option>`).join('')}</select></div>` : ''}
    <div style="max-width: 800px;">
      <div class="card" style="margin-bottom: 24px;">
        <h3>Business Profile</h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div class="form-group">
            <label>Business Name</label>
            <input type="text" data-settings-field="business_name" value="${settings.business_name}" onchange="window.updateSettingsField('business_name', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
             <div class="form-group">
               <label>Public Phone</label>
               <input type="text" id="settings-phone-input" value="${settings.phone}" onchange="window.updateSettingsField('phone', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
             </div>
             <div class="form-group">
               <label>Text/SMS Number</label>
               <input type="text" id="settings-sms-number-input" value="${settings.sms_number || ''}" onchange="window.updateSettingsField('sms_number', this.value)" placeholder="${settings.phone}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               <small style="color: #94a3b8; font-size: 0.75rem;">Used for text-message CTAs. Leave blank to use your public phone number.</small>
             </div>
             <div class="form-group">
               <label>Public Email</label>
               <input type="email" id="settings-email-input" value="${settings.email}" onchange="window.updateSettingsField('email', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
             </div>
          </div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center;">
             <div class="form-group" style="margin: 0;">
               <label>Brand Color</label>
               <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                 <input type="color" id="settings-primary-color-input" value="${settings.primary_color || '#4f46e5'}" onchange="window.updateSettingsField('primary_color', this.value)" oninput="window.updateSettingsField('primary_color', this.value)" style="width: 48px; height: 40px; border: 1px solid #ddd; border-radius: 6px; padding: 2px; cursor: pointer;">
                 <code style="font-size: 0.85rem; color: #475569; font-weight: 600;" id="settings-primary-color-display">${settings.primary_color || '#4f46e5'}</code>
               </div>
             </div>
             <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.85rem; color: #64748b; margin-top: 20px;">
               Changes button and accent colors across your public website and CRM dashboard.
             </div>
          </div>
          <div class="form-group">
            <label>Logo URL</label>
            <div style="display: flex; gap: 10px;">
               <input type="text" id="settings-logo-url-input" value="${settings.logo_url || ''}" onchange="window.updateSettingsField('logo_url', this.value)" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               ${settings.logo_url ? `<img id="settings-logo-img" src="${settings.logo_url}" style="height: 42px; width: 42px; border-radius: 4px; object-fit: cover; border: 1px solid #ddd;">` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Tracking & Marketing</h3>
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">Connect your marketing tools for analytics and ad tracking.</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label>Facebook Pixel ID</label>
            <input type="text" data-settings-field="facebook_pixel_id" placeholder="e.g. 1234567890" value="${settings.facebook_pixel_id || ''}" onchange="window.updateSettingsField('facebook_pixel_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div class="form-group">
            <label>GTM Container ID</label>
            <input type="text" data-settings-field="gtm_id" placeholder="e.g. GTM-XXXXXX" value="${settings.gtm_id || ''}" onchange="window.updateSettingsField('gtm_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
        </div>
      </div>
    </div>
  `;

  renderAppWithShell({
    activeView: 'website-settings',
    title: 'Website Branding & Tracking',
    headerActionsHtml: '<div style="display: flex; gap: 10px;"><button class="btn-primary" style="background: var(--primary-color);" onclick="window.saveGlobalSettings()">Save Settings</button></div>',
    contentVariant: 'standard',
    user: getCurrentShellUser(),
    contentHtml
  });
}

function renderWebsiteNavigation() {
  const userId = getActingUserId();
  const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
  if (!website) {
    renderWebsiteRepositoryUnavailable('website-navigation');
    return;
  }
  if (editorUsesSupabase() && websiteLayoutHydrator.state.status === 'loading') {
    renderAppWithShell({
      activeView: 'website-navigation',
      title: 'Website Navigation',
      contentVariant: 'wide',
      contentHtml: `<section class="card" aria-busy="true"><p>Loading navigation configuration…</p></section>`
    });
    return;
  }
  if (editorUsesSupabase() && websiteLayoutHydrator.state.status === 'error') {
    renderAppWithShell({
      activeView: 'website-navigation',
      title: 'Website Navigation',
      contentVariant: 'wide',
      contentHtml: `<section class="card" role="alert"><h3>Navigation could not be loaded.</h3><p>Your saved configuration was not changed.</p><button class="btn-outline" onclick="window.navigateTo('website-navigation')">Retry</button></section>`
    });
    return;
  }
  const layout = mockWebsiteLayouts.find(l => l.website_id === website.id);
  
  const navItems = layout?.header_config.nav_items ?? [];

  // 🌿 Fix.2: Get available pages for the dropdown
  const siteRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);

  const itemsHtml = navItems.map((item: any, index: number) => `
    <div class="card" style="display: flex; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding: 20px; border: 1px solid #eef2f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <button class="btn-outline" style="padding: 4px 10px; font-size: 0.8rem; background: white;" onclick="window.reorderNavItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-outline" style="padding: 4px 10px; font-size: 0.8rem; background: white;" onclick="window.reorderNavItem(${index}, 1)" ${index === navItems.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      
      <div style="flex: 1 1 140px; min-width: 120px;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Menu Label</label>
        <input type="text" value="${item.label}" onchange="window.updateNavItem(${index}, 'label', this.value)" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; box-sizing: border-box;">
      </div>

      <div style="flex: 1 1 140px; min-width: 120px;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Linked Page</label>
        <select onchange="window.updateNavItem(${index}, 'path', this.value)" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: white; font-size: 0.95rem; cursor: pointer; box-sizing: border-box;">
          <option value="" ${!item.path ? 'selected' : ''}>-- Select a Page --</option>
          ${siteRoutes.map(route => {
             const funnel = mockFunnels.find(f => f.id === route.funnel_id);
             return `<option value="${route.path}" ${item.path === route.path ? 'selected' : ''}>${funnel?.name || 'Page'} (${route.path})</option>`;
          }).join('')}
        </select>
        <small style="color: #94a3b8; margin-top: 6px; display: block;">Link points to: ${item.path || 'None'}</small>
      </div>

      <div style="text-align: center;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Visible</label>
        <input type="checkbox" ${item.visible !== false ? 'checked' : ''} onchange="window.updateNavItem(${index}, 'visible', this.checked)" style="width: 24px; height: 24px; cursor: pointer; accent-color: var(--primary-color);">
      </div>

      <button class="btn-outline" style="background: #fff5f5; color: #ef4444; border-color: #fee2e2; padding: 10px; border-radius: 10px;" onclick="window.deleteNavItem(${index})">
        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `).join('');

  renderAppWithShell({
    activeView: 'website-navigation',
    title: 'Website Navigation',
    subtitle: "Manage your site's header menu. Links are restricted to your published pages to prevent dead ends.",
    headerActionsHtml: `
      <div style="display: flex; gap: 12px;">
        ${layout ? `<button class="btn-primary" style="background: #8a2be2; border: none; padding: 12px 24px;" onclick="window.addNavItem()">+ Add Menu Item</button>` : ''}
        <button class="btn-primary" style="padding: 12px 24px;" onclick="window.saveWebsiteLayout()">${layout ? 'Save Configuration' : 'Create Navigation'}</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      ${renderWebsiteManagementSwitcher('website-navigation')}
      <div style="max-width: 1000px; padding: 10px 0;">
        ${itemsHtml || '<div class="empty-state" style="padding: 80px; text-align: center; background: white; border-radius: 20px; border: 2px dashed #e2e8f0; color: #64748b;"><div style="font-size: 3rem; margin-bottom: 16px;">📂</div><h3>No menu items here</h3><p>Start building your navigation menu by adding your first link.</p><button class="btn-primary" style="margin-top: 20px;" onclick="window.addNavItem()">Add Item</button></div>'}
      </div>
    `
  });
}

(window as any).addNavItem = () => {
    const userId = getActingUserId();
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
    const layout = website ? mockWebsiteLayouts.find(l => l.website_id === website.id) : undefined;
    if (!layout) { (window as any).showToast('Create the navigation configuration first.', 'error'); return; }
    
    if (!layout.header_config.nav_items) layout.header_config.nav_items = [];
    layout.header_config.nav_items.push({ label: 'New Link', path: '/', visible: true });
    renderWebsiteNavigation();
};

(window as any).updateNavItem = (index: number, field: string, value: any) => {
    const userId = getActingUserId();
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
    const layout = website ? mockWebsiteLayouts.find(l => l.website_id === website.id) : undefined;
    if (!layout) return;
    
    (layout.header_config.nav_items[index] as any)[field] = value;
    renderWebsiteNavigation();
};

(window as any).reorderNavItem = (index: number, direction: number) => {
    const userId = getActingUserId();
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
    const layout = website ? mockWebsiteLayouts.find(l => l.website_id === website.id) : undefined;
    if (!layout) return;
    
    const items = layout.header_config.nav_items;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    
    renderWebsiteNavigation();
};

(window as any).deleteNavItem = (index: number) => {
    const userId = getActingUserId();
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
    const layout = website ? mockWebsiteLayouts.find(l => l.website_id === website.id) : undefined;
    if (!layout) return;
    
    layout.header_config.nav_items.splice(index, 1);
    renderWebsiteNavigation();
};

(window as any).saveWebsiteLayout = async () => {
    const userId = getActingUserId();
    const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
    if (!website) { (window as any).showToast('Navigation is unavailable.', 'error'); return; }
    const existing = mockWebsiteLayouts.find(layout => layout.website_id === website.id);
    const headerConfig = existing?.header_config ?? { logo_text: '', nav_items: [] };
    const footerConfig = existing?.footer_config ?? {};
    if (!editorUsesSupabase()) {
      if (!existing) mockWebsiteLayouts.push({ id: `layout-${Date.now()}`, website_id: website.id, header_config: headerConfig, footer_config: footerConfig, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      (window as any).showToast('Navigation updated successfully!', 'success');
      renderWebsiteNavigation();
      return;
    }
    const navigationOperation = currentView === 'website-navigation'
      ? protectedAsyncOperationGuard.captureCurrent('application-navigation', userId)
      : null;
    if (!navigationOperation) { (window as any).showToast('Navigation is unavailable.', 'error'); return; }
    const saveOperation = protectedAsyncOperationGuard.begin(`website-layout-save:${website.id}`, userId);
    (window as any).showToast('Saving navigation layout...', 'saving');
    try {
      const client = await getBuilderPublicationSupabaseClient();
      if (!client) throw new Error('UNAVAILABLE');
      const result = await client.from('website_layouts').upsert({ website_id: website.id, header_config: headerConfig, footer_config: footerConfig, updated_at: new Date().toISOString() }, { onConflict: 'website_id' }).select('*').single();
      if (result.error || !result.data || result.data.website_id !== website.id) throw new Error('UNAVAILABLE');
      const saved = result.data as WebsiteLayout;
      const committed = protectedAsyncOperationGuard.commitIfCurrent(saveOperation, getActingUserId(), () => {
        if (activeDashboardWebsiteId !== website.id) throw new SupersededOperationError();
        const index = mockWebsiteLayouts.findIndex(layout => layout.website_id === website.id);
        if (index >= 0) mockWebsiteLayouts[index] = saved;
        else mockWebsiteLayouts.push(saved);
        websiteLayoutHydrator.state = { status: 'loaded', userId };
      });
      if (!committed) return;
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())
        || currentView !== 'website-navigation') return;
      (window as any).showToast('Navigation updated successfully!', 'success');
      renderWebsiteNavigation();
    } catch (error) {
      if (isSupersededOperationError(error)
        || !protectedAsyncOperationGuard.isCurrent(saveOperation, getActingUserId())
        || activeDashboardWebsiteId !== website.id
        || !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())
        || currentView !== 'website-navigation') return;
      (window as any).showToast('Navigation could not be saved. Please try again.', 'error');
    }
};
function renderWebsiteStructure() {
  const userId = getActingUserId();
  const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
  if (!website) {
    renderWebsiteRepositoryUnavailable('website-structure');
    return;
  }
  const routes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
  
  const websiteUrl = website.domain ? `https://${website.domain}` : `https://${website.subdomain}.pressurepro.io`;

  renderAppWithShell({
    activeView: 'website-structure',
    title: 'Website Configuration',
    subtitle: 'Map your custom URLs to website pages.',
    headerActionsHtml: `<button class="btn-primary" onclick="window.showAddRouteModal('${website.id}')">Add New Route</button>`,
    contentVariant: 'wide',
    contentHtml: `
      ${renderWebsiteManagementSwitcher('website-structure')}
      
      <div class="card" style="margin-bottom: 24px; border-left: 4px solid var(--primary-color);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
           <div>
             <small style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;">Public Website Address</small>
             <div style="font-size: 1.2rem; font-weight: 600; color: #1e293b; margin-top: 4px;">${websiteUrl}</div>
           </div>
           <a href="${websiteUrl}" target="_blank" class="btn-primary" style="background: white; color: #1e293b; border: 1px solid #e2e8f0; font-size: 0.85rem;">Visit Site ↗</a>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
          <h3 style="margin: 0; font-size: 1.1rem;">Mapped Routes</h3>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="padding-left: 20px;">URL Path</th>
              <th>Destination Page</th>
              <th>Status</th>
              <th style="text-align: right; padding-right: 20px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${routes.map(route => {
              const funnel = mockFunnels.find(f => f.id === route.funnel_id);
              const isHome = route.path === '/';
              return `
                <tr>
                  <td style="padding-left: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <code style="font-size: 0.95rem; color: var(--primary-color); font-weight: 700; background: #eff6ff; padding: 4px 8px; border-radius: 4px;">${route.path}</code>
                      ${isHome ? '<span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.7rem;">Homepage</span>' : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 500; color: #1e293b;">${funnel ? funnel.name : 'Unknown Page'}</div>
                    <!-- Internal ID hidden -->
                  </td>
                  <td><span class="badge badge-published">Live</span></td>
                  <td style="text-align: right; padding-right: 20px;">
                    <button class="btn-primary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="event.stopPropagation(); const p = mockPages.find(pg => pg.funnel_id === '${route.funnel_id}'); if(p) { window.switchBuilderPage(p.id); window.navigateTo('builder'); } else { window.navigateTo('funnel-detail', '${route.funnel_id}'); }">Edit Page</button>
                    <button class="btn-outline" style="color: #64748b; border-color: #e2e8f0; padding: 4px 10px; font-size: 0.8rem; margin-left: 5px;" onclick="event.stopPropagation(); window.open('/site${route.path}', '_blank')">View Live</button>
                    ${!isHome ? `<button class="btn-outline" style="color: #ef4444; border-color: #fee2e2; padding: 4px 10px; font-size: 0.8rem; margin-left: 5px;" onclick="window.deleteRoute('${route.id}')">Delete</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center; padding: 60px; color: #94a3b8;">No routes configured yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

(window as any).showAddRouteModal = (websiteId: string) => {
  const modal = document.createElement('div');
  modal.id = 'route-modal';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 450px; padding: 30px;">
        <h3 style="margin-top: 0; margin-bottom: 20px;">Add Website Route</h3>
        
        <div class="form-group" style="margin-bottom: 20px;">
          <label>URL Path</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #64748b; font-weight: 600;">/</span>
            <input type="text" id="route-path" placeholder="e.g. driveway-cleaning" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
          </div>
          <small style="color: #64748b; margin-top: 4px; display: block;">The URL relative to your domain.</small>
        </div>

        <div class="form-group" style="margin-bottom: 30px;">
          <label>Destination Page</label>
          <select id="route-funnel-id" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
            ${mockFunnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
          <small style="color: #64748b; margin-top: 4px; display: block;">Which page should load at this path?</small>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn-outline" onclick="document.getElementById('route-modal').remove()">Cancel</button>
          <button class="btn-primary" onclick="window.saveRoute('${websiteId}')">Create Route</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

(window as any).saveRoute = async (websiteId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Route creation is temporarily unavailable.', 'error'); return; }
  const pathInput = document.getElementById('route-path') as HTMLInputElement;
  const funnelSelect = document.getElementById('route-funnel-id') as HTMLSelectElement;
  
  if (!pathInput || !funnelSelect) return;
  
  const path = pathInput.value.trim().replace(/^\/+/, '');
  const funnelId = funnelSelect.value;
  
  if (!path) {
    alert('Please enter a valid path.');
    return;
  }

  const normalizedPath = '/' + path;

  // Check for duplicates
  if (mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === normalizedPath)) {
    alert('This route path is already in use.');
    return;
  }

  const newRoute = {
    id: `r-${Date.now()}`,
    website_id: websiteId,
    path: normalizedPath,
    funnel_id: funnelId,
    created_at: new Date().toISOString()
  };

  mockWebsiteRoutes.push(newRoute);
  document.getElementById('route-modal')?.remove();
  renderWebsiteStructure();
  console.log('[UI: ROUTES] Added new route:', newRoute);
};

(window as any).deleteRoute = (id: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Route deletion is temporarily unavailable.', 'error'); return; }
  if (!confirm('Are you sure you want to delete this route? This path will no longer load its page.')) return;
  
  const index = mockWebsiteRoutes.findIndex(r => r.id === id);
  if (index !== -1) {
    mockWebsiteRoutes.splice(index, 1);
    renderWebsiteStructure();
  }
};

(window as any).updateSettingsField = async (field: string, value: string) => {
    const s = getWebsiteSettings();
    const previous = (s as any)[field];
    const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
    });
    const result = await response.json();
    if (!response.ok || result.success !== true || !result.data) {
      (s as any)[field] = previous;
      (window as any).showToast('Website setting could not be saved.', 'error');
      throw new Error('SETTINGS_UNAVAILABLE');
    }
    Object.assign(s, result.data);
    if (field === 'primary_color') {
      applyPrimaryColor((s as any)[field]);
      const colorDisplay = document.getElementById('settings-primary-color-display');
      if (colorDisplay) colorDisplay.textContent = (s as any)[field];
    }
    if (field === 'logo_url') {
      const logoImg = document.getElementById('settings-logo-img') as HTMLImageElement | null;
      if (logoImg) logoImg.src = (s as any)[field];
    }
    return result;
};

(window as any).handleLogoUpload = async (file: File) => {
    if (!file) return;
    const btn = document.getElementById('logo-upload-btn') as HTMLButtonElement | null;
    const status = document.getElementById('logo-upload-status') as HTMLDivElement | null;
    const preview = document.getElementById('logo-preview-container') as HTMLDivElement | null;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Uploading...</span>';
        btn.style.opacity = '0.7';
    }
    if (status) {
        status.style.color = '#3b82f6';
        status.textContent = 'Uploading to secure storage...';
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'logo');

        const res = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData
        });

        const json = await res.json();

        if (json.success && json.public_url) {
            if (status) {
                status.style.color = '#10b981';
                status.textContent = 'Upload completed! Saving settings...';
            }
            if (preview) {
                preview.innerHTML = `<img id="settings-logo-img" src="${json.public_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            const input = document.getElementById('settings-logo-url-input') as HTMLInputElement | null;
            if (input) {
                input.value = json.public_url;
            }

            await window.updateSettingsField('logo_url', json.public_url);

            setTimeout(() => {
                if (status) status.textContent = 'Upload completed!';
            }, 1000);
        } else {
            throw new Error(json.error || 'UPLOAD_FAILED');
        }
    } catch (err: any) {
        console.error('[LOGO UPLOAD ERROR]:', err);
        if (status) {
            status.style.color = '#ef4444';
            const errorMsg = err.message === 'FILE_TOO_LARGE'
                ? 'File too large (max 5MB)'
                : err.message === 'INVALID_FILE_TYPE'
                    ? 'Invalid image type (only PNG/JPG/WEBP allowed)'
                    : 'Server error';
            status.textContent = `Upload failed: ${errorMsg}`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Upload Logo File</span>';
            btn.style.opacity = '1';
        }
    }
};

function renderQuickstart() {
  renderAppWithShell({
    activeView: 'quickstart',
    title: 'Quickstart Guide',
    contentVariant: 'standard',
    contentHtml: `
      <ul class="guide-list">
        <li class="guide-step"><input type="checkbox" checked> <span>Complete your Business Profile</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Connect your Domain</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Create your first Pressure Washing Funnel</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Import existing Client List</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Set up Stripe for Automated Billing</span></li>
      </ul>
    `
  });
}

function renderLeadCapture() {
  (window as any).internalLeadRequestKey ||= crypto.randomUUID();
  renderAppWithShell({
    activeView: 'lead-capture',
    title: 'Lead Capture Form',
    subtitle: 'Complete the form below to register a new lead and create a sales opportunity.',
    contentVariant: 'standard',
    contentHtml: `
      <div class="lead-form-container">
        <form id="lead-form">
          <div class="form-group">
            <label for="lead_name">Full Name</label>
            <input type="text" id="lead_name" placeholder="John Doe" required>
          </div>
          <div class="form-group">
            <label for="lead_phone">Phone Number</label>
            <input type="tel" id="lead_phone" placeholder="555-012-3456" required>
          </div>
          <div class="form-group">
            <label for="lead_email">Email Address</label>
            <input type="email" id="lead_email" placeholder="john@example.com" required>
          </div>
          <div class="form-group">
            <label for="lead_address">Service Address</label>
            <input type="text" id="lead_address" placeholder="123 Main St, Anytown" required>
          </div>
          <div class="form-group">
            <label for="lead_service_type">Service Type</label>
            <select id="lead_service_type" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: white;">
              <option value="">Select a service...</option>
              <option value="Residential Pressure Washing">Residential Pressure Washing</option>
              <option value="Commercial Exterior Cleaning">Commercial Exterior Cleaning</option>
              <option value="Roof & Gutter Cleaning">Roof & Gutter Cleaning</option>
              <option value="Driveway & Walkway Restore">Driveway & Walkway Restore</option>
              <option value="Deck & Patio Wash">Deck & Patio Wash</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lead_message">Message / Details</label>
            <textarea id="lead_message" placeholder="Description of what needs cleaning..." required></textarea>
          </div>
          <div class="form-footer">
            <button type="submit" class="btn-primary">Submit Lead Info</button>
          </div>
        </form>
      </div>
    `
  });

  document.getElementById('lead-form')?.addEventListener('submit', handleLeadCaptureSubmission);
}

async function handleLeadCaptureSubmission(e: Event) {
  e.preventDefault();
  const name = (document.getElementById('lead_name') as HTMLInputElement).value;
  const phone = (document.getElementById('lead_phone') as HTMLInputElement).value;
  const email = (document.getElementById('lead_email') as HTMLInputElement).value;
  const address = (document.getElementById('lead_address') as HTMLInputElement).value;
  const service_type = (document.getElementById('lead_service_type') as HTMLSelectElement).value;
  const message = (document.getElementById('lead_message') as HTMLTextAreaElement).value;

  if (!name) {
    alert('Please provide at least a name.');
    return;
  }

  try {
    (window as any).showToast('Creating lead...', 2000);
    const result = await createLead({
      name,
      phone,
      email,
      address,
      service_type,
      message,
      source: 'internal',
      request_key: (window as any).internalLeadRequestKey
    });

    console.log("Internal Lead Created:", result);
    (window as any).internalLeadRequestKey = '';
    alert(`Success! Lead created for ${name}.`);
    window.navigateTo('clients');

  } catch (error: any) {
    console.error("Internal Lead Submission Error:", error);
    alert(`Failed to create lead: ${error.message}`);
  }
}

function renderOpportunities() {
  const userId = getActingUserId();
  const defaultPipeline = mockPipelines[0];
  renderAppWithShell({
    activeView: 'opportunities',
    title: `Sales Pipeline: ${defaultPipeline.name}`,
    contentVariant: 'wide',
    contentHtml: renderOpportunitiesContent({ userId, pipeline: defaultPipeline, opportunities: mockOpportunities, contacts: mockContacts, editable: !editorUsesSupabase() })
  });
}

function renderQuotes() {
  const tableRows = mockQuotes.map(quote => {
    const contact = mockContacts.find(c => c.id === quote.contact_id);
    return `
      <tr onclick="window.navigateTo('contact-detail', '${quote.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${quote.id}</td>
        <td>${escapeHtmlText(contact ? contact.name : 'Unknown')}</td>
        <td><span class="badge badge-${quote.status}">${quote.status}</span></td>
        <td style="font-weight: 600;">$${quote.total_amount.toLocaleString()}</td>
        <td>${new Date(quote.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${quote.id}')">Preview</button>
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${quote.contact_id}')">View</button>
            ${quote.status === 'draft' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${quote.id}')">Send</button>` : ''}
            ${quote.status === 'sent' ? `
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${quote.id}')">Approve</button>
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${quote.id}')">Reject</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderAppWithShell({
    activeView: 'quotes',
    title: 'Quotes',
    headerActionsHtml: `<button class="btn-primary" onclick="window.navigateTo('new-quote')">+ New Quote</button>`,
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0; min-width: 700px;">
          <thead>
            <tr>
              <th>Quote #</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No quotes found</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

function renderInvoices() {
  if (editorUsesSupabase()) {
    renderAppWithShell({
      activeView: 'invoices',
      title: 'Invoices',
      contentVariant: 'wide',
      contentHtml: `
        <section class="card" role="status">
          <h3>Invoices are not available yet.</h3>
          <p>Production invoice persistence has not been implemented. No invoice changes will be stored until that backend is available.</p>
        </section>
      `
    });
    return;
  }
  const filteredInvoices = mockInvoices.filter(i => {
    if (invoiceStatusFilter === 'all') return true;
    return i.status === invoiceStatusFilter;
  });

  const tableRows = filteredInvoices.map(invoice => {
    const contact = mockContacts.find(c => c.id === invoice.contact_id);
    return `
      <tr onclick="window.navigateTo('contact-detail', '${invoice.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">INV-${invoice.id}</td>
        <td>${escapeHtmlText(contact ? contact.name : 'Unknown')}</td>
        <td style="font-weight: 600;">$${invoice.amount.toLocaleString()}</td>
        <td><span class="badge badge-${invoice.status}">${invoice.status}</span></td>
        <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${invoice.contact_id}')">View</button>
            ${invoice.status !== 'paid' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${invoice.id}')">Mark as Paid</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderAppWithShell({
    activeView: 'invoices',
    title: 'Invoices',
    headerActionsHtml: `
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <select onchange="window.updateInvoiceFilter(this.value)" style="padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd; background: white; font-family: inherit;">
          <option value="all" ${invoiceStatusFilter === 'all' ? 'selected' : ''}>All Invoices</option>
          <option value="unpaid" ${invoiceStatusFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
          <option value="paid" ${invoiceStatusFilter === 'paid' ? 'selected' : ''}>Paid</option>
          <option value="overdue" ${invoiceStatusFilter === 'overdue' ? 'selected' : ''}>Overdue</option>
        </select>
        <button class="btn-primary" onclick="alert('Create Invoice from Quote or Client Detail page')">+ New Invoice</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0; min-width: 700px;">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Contact Name</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices match your selection</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

(window as any).updateInvoiceFilter = (status: string) => {
  invoiceStatusFilter = status;
  renderInvoices();
};

function renderNewQuote() {
  const contacts = mockContacts;
  const nqcId = (window as any).newQuoteContactId;
  const nqoId = (window as any).newQuoteOpportunityId;
  const nqItems = (window as any).newQuoteLineItems;
  const opportunities = nqcId
    ? mockOpportunities.filter(o => o.contact_id === nqcId)
    : [];

  const renderTierGroup = (tier: 'basic' | 'standard' | 'premium') => {
    const tierItems = nqItems.map((item: any, idx: number) => ({ ...item, index: idx })).filter((item: any) => item.tier === tier);
    const tierTotal = tierItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

    return `
      <div class="card" style="flex: 1; min-width: 280px; display: flex; flex-direction: column; justify-content: space-between; border-top: 4px solid ${tier === 'premium' ? 'var(--primary-color)' : '#cbd5e1'};">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; text-transform: capitalize;">${tier} Option</h3>
            <button class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.addLineItem('${tier}')">+ Add Item</button>
          </div>

          ${tierItems.map((item: any) => `
            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <input type="text" placeholder="Service Name" value="${escapeHtmlText(item.service)}" style="width: 70%; font-weight: 600; border: none; background: transparent; border-bottom: 1px solid #ccc; padding: 2px;" onchange="window.updateLineItem(${item.index}, 'service', this.value)">
                <button onclick="window.removeLineItem(${item.index})" style="background: none; border: none; color: #ef4444; cursor: pointer;">&times;</button>
              </div>
              <textarea placeholder="Description" style="width: 100%; font-size: 0.8rem; border: 1px solid #eee; border-radius: 4px; padding: 4px; resize: none;" rows="2" onchange="window.updateLineItem(${item.index}, 'description', this.value)">${escapeHtmlText(item.description)}</textarea>
              <div style="display: flex; gap: 10px; margin-top: 5px; align-items: center;">
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">QTY</label>
                  <input type="number" value="${item.quantity}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${item.index}, 'quantity', this.value, true)">
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">PRICE</label>
                  <input type="number" value="${item.price}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${item.index}, 'price', this.value, true)">
                </div>
                <div style="flex: 1; text-align: right;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">TOTAL</label>
                  <span id="line-total-${item.index}" style="font-weight: 700; color: var(--primary-color);">$${(item.quantity * item.price).toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
          ${tierItems.length === 0 ? '<div style="text-align: center; color: #ccc; padding: 20px; font-style: italic; border: 1px dashed #eee; border-radius: 8px;">No items in this tier</div>' : ''}
        </div>
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #f1f5f9; text-align: right;">
          <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">Option Total</div>
          <div id="tier-total-${tier}" style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">$${tierTotal.toLocaleString()}</div>
        </div>
      </div>
    `;
  };

  renderAppWithShell({
    activeView: 'new-quote',
    title: 'Create Multi-Tier Quote',
    headerActionsHtml: `
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="window.navigateTo('quotes')" class="btn-primary" style="background: #eee; color: #333; padding: 6px 12px;">← Back</button>
        <button class="btn-primary" style="padding: 8px 20px;" onclick="window.saveQuote()">Create Quote</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      <div>
        <div class="card" style="margin-bottom: 24px; padding: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div class="form-group" style="margin: 0;">
              <label>Select Contact</label>
              <select id="quote-contact" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.updateNewQuoteContact(this.value)">
                <option value="">-- Choose Contact --</option>
                ${contacts.map(c => `<option value="${escapeHtmlText(c.id)}" ${nqcId === c.id ? 'selected' : ''}>${escapeHtmlText(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Select Opportunity (Optional)</label>
              <select id="quote-opportunity" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.newQuoteOpportunityId = this.value">
                <option value="">-- No Opportunity --</option>
                ${opportunities.map(o => `<option value="${escapeHtmlText(o.id)}" ${nqoId === o.id ? 'selected' : ''}>$${o.value} - ${escapeHtmlText(o.pipeline_stage)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 10px;">
          ${renderTierGroup('basic')}
          ${renderTierGroup('standard')}
          ${renderTierGroup('premium')}
        </div>

        <div class="card" style="margin-top: 24px; padding: 20px;">
           <label>Add internal notes or terms</label>
           <textarea id="quote-notes" style="width: 100%; height: 80px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit;" placeholder="e.g. Terms & conditions or specific project details..."></textarea>
        </div>
      </div>
    `
  });
}

(window as any).updateNewQuoteContact = (id: string) => {
  (window as any).newQuoteContactId = id;
  (window as any).newQuoteOpportunityId = '';
  renderNewQuote();
};

(window as any).addLineItem = (tier: 'basic' | 'standard' | 'premium' = 'basic') => {
  (window as any).newQuoteLineItems.push({ service: '', description: '', quantity: 1, price: 0, tier });
  renderNewQuote();
};

(window as any).removeLineItem = (index: number) => {
  (window as any).newQuoteLineItems.splice(index, 1);
  renderNewQuote();
};

(window as any).updateLineItem = (index: number, field: string, value: string | number, shouldUpdateTotals: boolean) => {
  const nqItems = (window as any).newQuoteLineItems;
  const item = nqItems[index] as any;
  if (field === 'quantity' || field === 'price') {
    item[field] = parseFloat(value as string) || 0;
  } else {
    item[field] = value;
  }

  if (shouldUpdateTotals) {
    const lineTotalEl = document.getElementById(`line-total-${index}`);
    if (lineTotalEl) {
      lineTotalEl.textContent = `$${(item.quantity * item.price).toLocaleString()}`;
    }

    // Update the tier total
    const tier = item.tier;
    const tierTotal = nqItems
      .filter((i: any) => i.tier === tier)
      .reduce((sum: number, i: any) => sum + (i.quantity * i.price), 0);

    const tierTotalEl = document.getElementById(`tier-total-${tier}`);
    if (tierTotalEl) {
      tierTotalEl.textContent = `$${tierTotal.toLocaleString()}`;
    }
  }
};

(window as any).saveQuote = async () => {
  const nqcId = (window as any).newQuoteContactId;
  const nqoId = (window as any).newQuoteOpportunityId;
  const nqItems = (window as any).newQuoteLineItems;

  if (!nqcId) {
    alert("Please select a contact.");
    return;
  }

  const notes = (document.getElementById('quote-notes') as HTMLTextAreaElement)?.value || '';
  const selectedTier = 'basic' as const;
  const tierValidation = validateSelectedQuoteTier(nqItems, selectedTier);
  if (!tierValidation.success) {
    alert(tierValidation.message);
    return;
  }

  if (editorUsesSupabase()) {
    const requestKey = (window as any).newQuoteRequestKey || crypto.randomUUID();
    (window as any).newQuoteRequestKey = requestKey;
    const userId = getActingUserId();
    const navigationOperation = currentView === 'new-quote'
      ? protectedAsyncOperationGuard.captureCurrent('application-navigation', userId)
      : null;
    if (!navigationOperation) return;
    const quoteOperation = protectedAsyncOperationGuard.begin(`quote-ui:${requestKey}`, userId);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_key: requestKey,
          contact_id: nqcId,
          opportunity_id: nqoId || null,
          selected_tier: selectedTier,
          notes,
          items: nqItems.map((item: any) => ({ serviceName: String(item.service).trim(), description: item.description || '', quantity: item.quantity, unitPrice: item.price, tier: item.tier }))
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Quote creation failed.');
      const saved = payload.data;
      const committed = protectedAsyncOperationGuard.commitIfCurrent(quoteOperation, getActingUserId(), () => {
        const quoteIndex = mockQuotes.findIndex(quote => quote.id === saved.quote.id);
        if (quoteIndex >= 0) mockQuotes[quoteIndex] = saved.quote;
        else mockQuotes.push(saved.quote);
        for (const item of saved.items) {
          const itemIndex = mockQuoteItems.findIndex(existing => existing.id === item.id);
          if (itemIndex >= 0) mockQuoteItems[itemIndex] = item;
          else mockQuoteItems.push(item);
        }
        if (saved.opportunity) {
          const opportunityIndex = mockOpportunities.findIndex(opportunity => opportunity.id === saved.opportunity.id);
          if (opportunityIndex >= 0) mockOpportunities[opportunityIndex] = saved.opportunity;
        }
      });
      if (!committed) return;
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())
        || currentView !== 'new-quote') return;
      (window as any).newQuoteLineItems = [{ service: '', description: '', quantity: 1, price: 0, tier: 'basic' }];
      (window as any).newQuoteContactId = '';
      (window as any).newQuoteOpportunityId = '';
      (window as any).newQuoteRequestKey = '';
      (window as any).showToast('Quote created successfully.', 'success');
      await (window as any).navigateTo('quotes');
    } catch (error: any) {
      if (isSupersededOperationError(error)
        || !protectedAsyncOperationGuard.isCurrent(quoteOperation, getActingUserId())
        || !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())
        || currentView !== 'new-quote') return;
      (window as any).showToast(error?.message || 'Quote creation is temporarily unavailable.', 'error');
    }
    return;
  }

  const quoteId = 'q' + (mockQuotes.length + 1) + '-' + Math.floor(Math.random() * 100);

  const basicTotal = tierValidation.selectedTotal;

  mockQuotes.push({
    id: quoteId,
    user_id: getActingUserId(),
    contact_id: nqcId,
    opportunity_id: nqoId || '',
    status: 'draft',
    total_amount: basicTotal,
    selected_tier: selectedTier,
    notes: notes,
    created_at: new Date().toISOString()
  });

  // Sync with Opportunity value
  if (nqoId) {
    const opportunity = mockOpportunities.find(o => o.id === nqoId);
    if (opportunity) {
      opportunity.value = basicTotal;
    }
  }

  nqItems.forEach((item: any, idx: number) => {
    mockQuoteItems.push({
      id: 'qi-' + quoteId + '-' + idx,
      user_id: getActingUserId(),
      quote_id: quoteId,
      service_name: item.service,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.price,
      total: item.quantity * item.price,
      tier: item.tier
    });
  });

  (window as any).newQuoteLineItems = [{ service: '', description: '', quantity: 1, price: 0, tier: 'basic' }];
  (window as any).newQuoteContactId = '';
  (window as any).newQuoteOpportunityId = '';

  (window as any).navigateTo('quotes');
};

function updateOpportunityStage(opportunity_id: string, new_stage: string) {
  if (editorUsesSupabase()) { (window as any).showToast('Opportunity updates are temporarily unavailable.', 'error'); return; }
  const opp = mockOpportunities.find(o => o.user_id === getActingUserId() && o.id === opportunity_id);
  if (opp) {
    opp.pipeline_stage = new_stage;

    // Simple logic to update status based on stage
    if (new_stage === 'Completed' || new_stage === 'Paid') {
      opp.status = 'won';
    } else if (new_stage === 'Lost') {
      opp.status = 'lost';
    } else {
      opp.status = 'open';
    }

    // UI Refresh without reload
    (window as any).navigateTo(currentView, selectedContactId || undefined);
    console.log(`Opportunity ${opportunity_id} updated: Stage=[${new_stage}], Status=[${opp.status}]`);

    // Trigger Automation
    runAutomations('OPPORTUNITY_STAGE_UPDATED', opp);
  }
}

(window as any).updateOpportunityStage = updateOpportunityStage;

// Drag & Drop Handlers
(window as any).allowDrop = (ev: DragEvent) => {
  ev.preventDefault();
};

(window as any).drag = (ev: DragEvent, id: string) => {
  ev.dataTransfer?.setData("text", id);
};

(window as any).drop = (ev: DragEvent, stage: string) => {
  ev.preventDefault();
  const id = ev.dataTransfer?.getData("text");
  if (id) {
    updateOpportunityStage(id, stage);
  }
};

function renderSkeleton(type: 'pages' | 'templates' | 'builder' | 'generic') {
  if (type === 'pages') {
    return `
      <div class="skeleton-pages-list">
        ${Array(8).fill(0).map(() => `<div class="skeleton skeleton-row"></div>`).join('')}
      </div>
    `;
  }
  if (type === 'templates') {
    return `
      <div class="skeleton-card-grid">
        ${Array(6).fill(0).map(() => `
          <div class="card" style="padding: 0; overflow: hidden; height: 350px;">
            <div class="skeleton skeleton-rect" style="height: 180px;"></div>
            <div style="padding: 20px;">
              <div class="skeleton skeleton-title" style="width: 80%;"></div>
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text" style="width: 40%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  return `<div class="skeleton skeleton-rect" style="height: 100%; border-radius: 12px;"></div>`;
}


function dashboardUsesSupabase(): boolean {
  return editorUsesSupabase();
}

function renderApplicationUnavailable(): void {
  currentView = 'login';
  app.innerHTML = `
    <main class="application-auth-shell">
      <section class="application-auth-card" role="alert">
        <div class="application-auth-brand">PressurePro</div>
        <h1>The application is temporarily unavailable.</h1>
        <p>We could not start the secure sign-in service. Please try again later.</p>
        <button type="button" class="btn-primary" onclick="window.retryApplicationBootstrap()">Try again</button>
      </section>
    </main>
  `;
}

type ApplicationAuthViewMode = 'sign-in' | 'create-account';

function renderApplicationLogin(
  returnTo?: string,
  message?: string,
  mode: ApplicationAuthViewMode = 'sign-in',
  awaitingConfirmation = false
): void {
  currentView = 'login';
  const safeReturnTo = sanitizeApplicationReturnRoute(returnTo);
  const creatingAccount = mode === 'create-account';
  const heading = awaitingConfirmation
    ? 'Check your email'
    : creatingAccount
      ? 'Create your CRM account'
      : 'Sign in to your CRM';
  const description = awaitingConfirmation
    ? 'Check your email to confirm your account. After confirmation, return here and sign in.'
    : creatingAccount
      ? 'Create the secure owner account for your pressure-washing business.'
      : 'Use your authorized account to manage customers and websites.';
  app.innerHTML = `
    <main class="application-auth-shell">
      <section class="application-auth-card" aria-labelledby="application-login-heading">
        <div class="application-auth-brand">PressurePro</div>
        <h1 id="application-login-heading">${heading}</h1>
        <p>${description}</p>
        ${message ? `<div class="application-auth-error" role="status" aria-live="polite">${escapeBuilderInspectorHtml(message)}</div>` : ''}
        ${awaitingConfirmation ? `
          <button id="application-auth-return-sign-in" type="button" class="btn-primary">Return to sign in</button>
        ` : `
          <form id="application-login-form" novalidate aria-describedby="application-auth-guidance">
            <label for="application-login-email">Email</label>
            <input id="application-login-email" name="email" type="email" autocomplete="${creatingAccount ? 'email' : 'username'}" maxlength="254" required>
            <label for="application-login-password">Password</label>
            <input id="application-login-password" name="password" type="password" autocomplete="${creatingAccount ? 'new-password' : 'current-password'}" ${creatingAccount ? 'minlength="6" maxlength="128"' : ''} required>
            ${creatingAccount ? `
              <label for="application-login-confirm-password">Confirm password</label>
              <input id="application-login-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" maxlength="128" required>
              <p id="application-auth-guidance" class="application-auth-guidance">Use at least 6 characters. Longer, unique passwords are safer.</p>
            ` : '<span id="application-auth-guidance" class="sr-only">Enter your authorized account credentials.</span>'}
            <button id="application-login-submit" type="submit" class="btn-primary">${creatingAccount ? 'Create account' : 'Sign in'}</button>
          </form>
          <div class="application-auth-switch">
            <span>${creatingAccount ? 'Already have an account?' : 'New to PressurePro?'}</span>
            <button id="application-auth-mode-switch" type="button" class="application-auth-link">${creatingAccount ? 'Sign in' : 'Create an account'}</button>
          </div>
        `}
      </section>
    </main>
  `;
  document.querySelector<HTMLButtonElement>('#application-auth-return-sign-in')?.addEventListener('click', () => {
    renderApplicationLogin(safeReturnTo);
  });
  document.querySelector<HTMLButtonElement>('#application-auth-mode-switch')?.addEventListener('click', () => {
    renderApplicationLogin(safeReturnTo, undefined, creatingAccount ? 'sign-in' : 'create-account');
  });
  const form = document.querySelector<HTMLFormElement>('#application-login-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const emailInput = document.querySelector<HTMLInputElement>('#application-login-email');
    const passwordInput = document.querySelector<HTMLInputElement>('#application-login-password');
    const confirmPasswordInput = document.querySelector<HTMLInputElement>('#application-login-confirm-password');
    const submit = document.querySelector<HTMLButtonElement>('#application-login-submit');
    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (!creatingAccount && (!email || !password)) {
      renderApplicationLogin(safeReturnTo, 'Enter your email and password.');
      return;
    }
    if (submit) {
      submit.disabled = true;
      submit.textContent = creatingAccount ? 'Creating account…' : 'Signing in…';
    }
    if (creatingAccount) {
      const emailRedirectTo = createApplicationSignupRedirect(window.location.origin);
      applicationAuthFormSubmissionInProgress = true;
      const pending = applicationAuthController.signUp({
        email,
        password,
        confirmPassword: confirmPasswordInput?.value ?? '',
        emailRedirectTo: emailRedirectTo ?? ''
      });
      if (passwordInput) passwordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
      const result = await pending;
      applicationAuthFormSubmissionInProgress = false;
      if (!result.success) {
        const signupMessage = result.reason === 'invalid-input'
          ? result.issues[0]?.message ?? 'Check the account details and try again.'
          : result.reason === 'in-progress'
            ? 'Account creation is already in progress.'
            : result.reason === 'unavailable'
              ? 'Account creation is temporarily unavailable. Please try again.'
              : 'We could not create the account. Check your details or try signing in.';
        renderApplicationLogin(safeReturnTo, signupMessage, 'create-account');
        return;
      }
      if (result.status === 'awaiting-confirmation') {
        renderApplicationLogin(safeReturnTo, undefined, 'create-account', true);
        return;
      }
      applyApplicationAuthState(result.state);
      window.history.replaceState({}, '', safeReturnTo ?? '#/dashboard');
      await bootRouter();
      return;
    }
    applicationAuthFormSubmissionInProgress = true;
    const result = await applicationAuthController.signIn(email, password);
    applicationAuthFormSubmissionInProgress = false;
    if (passwordInput) passwordInput.value = '';
    if (!result.success) {
      renderApplicationLogin(
        safeReturnTo,
        result.reason === 'invalid-credentials'
          ? 'The email or password is incorrect.'
          : result.reason === 'email-not-confirmed'
            ? 'Confirm your email address before signing in.'
            : 'Sign-in is temporarily unavailable. Please try again.'
      );
      return;
    }
    applyApplicationAuthState(result.state);
    window.history.replaceState({}, '', safeReturnTo ?? '#/dashboard');
    await bootRouter();
  });
}

(window as any).retryApplicationBootstrap = async () => {
  applicationAuthInitialization = null;
  applicationAuthHasInitialized = false;
  await bootRouter();
};

(window as any).handleBuilderCanvasSectionClick = (event: MouseEvent, id: string) => {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const section = event.currentTarget.closest<HTMLElement>('.pb-section-preview[data-builder-section-id]');
  if (section?.dataset.builderSectionId !== id) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  const preserveInteraction = Boolean(target?.closest('input, textarea, select, button, a, label, [contenteditable="true"]'));
  (window as any).selectSectionForBuilder(id, false, preserveInteraction);
};

(window as any).handleBuilderCanvasSectionKeydown = (event: KeyboardEvent, id: string) => {
  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  (window as any).selectSectionForBuilder(id);
};

(window as any).signOutApplication = async () => {
  applicationAuthFormSubmissionInProgress = true;
  const success = await applicationAuthController.signOut();
  applicationAuthFormSubmissionInProgress = false;
  if (!success) {
    (window as any).showToast?.('Sign out is temporarily unavailable.', 'error');
    return;
  }
  clearProtectedRuntimeData();
  (window as any).currentUser = undefined;
  window.history.replaceState({}, '', '#/login');
  renderApplicationLogin();
};

function replaceOwnedDashboardRows<T extends { user_id: string }>(target: T[], rows: readonly T[], userId: string): void {
  for (let index = target.length - 1; index >= 0; index -= 1) if (target[index].user_id === userId) target.splice(index, 1);
  target.push(...rows.map(row => ({ ...row })));
}

async function loadWebsiteDashboardCore(request: { actingUserId: string }): Promise<WebsiteDashboardCoreData> {
  const userId = request.actingUserId.trim();
  if (!userId) throw new Error('UNAVAILABLE');
  if (!dashboardUsesSupabase()) {
    PagesRepo.hydrateLocalPages(userId);
    return { websites: mockWebsites.map(item => ({ ...item })), routes: mockWebsiteRoutes.map(item => ({ ...item })), funnels: mockFunnels.map(item => ({ ...item })), pages: mockPages.map(item => ({ ...item })) };
  }
  const hydrationToken = protectedAsyncOperationGuard.begin('website-dashboard-core', userId);
  const client = await getBuilderPublicationSupabaseClient();
  if (!client) throw new Error('UNAVAILABLE');
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('UNAVAILABLE');
  const websitesResult = await client.from('websites').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (websitesResult.error) throw new Error('UNAVAILABLE');
  const websites = ((websitesResult.data ?? []) as Website[])
    .filter(item => typeof item.id === 'string' && item.id.length > 0 && item.user_id === userId);
  const websiteIds = websites.map(item => item.id);
  const layoutHydration = websiteLayoutHydrator.hydrate(userId, websites);
  const [routesResult, funnelsResult, pagesResult] = await Promise.all([
    websiteIds.length ? client.from('website_routes').select('*').in('website_id', websiteIds).order('path', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    client.from('funnels').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    client.from('pages').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  ]);
  const layoutState = await layoutHydration;
  protectedAsyncOperationGuard.requireCurrent(hydrationToken, getActingUserId());
  if (layoutState.status === 'error') throw new Error('UNAVAILABLE');
  if (routesResult.error || funnelsResult.error || pagesResult.error) throw new Error('UNAVAILABLE');
  const ownedWebsiteIds = new Set(websites.map(item => item.id));
  const routes = ((routesResult.data ?? []) as WebsiteRoute[])
    .filter(item => typeof item.id === 'string' && ownedWebsiteIds.has(item.website_id));
  const funnels = ((funnelsResult.data ?? []) as Funnel[])
    .filter(item => typeof item.id === 'string' && item.user_id === userId);
  const pages = ((pagesResult.data ?? []) as Page[])
    .filter(item => typeof item.id === 'string' && item.user_id === userId);
  const committed = protectedAsyncOperationGuard.commitIfCurrent(hydrationToken, getActingUserId(), () => {
    replaceOwnedDashboardRows(mockWebsites, websites, userId);
    replaceOwnedDashboardRows(mockFunnels, funnels, userId);
    replaceOwnedDashboardRows(mockPages, pages, userId);
    for (let index = mockWebsiteRoutes.length - 1; index >= 0; index -= 1) if (ownedWebsiteIds.has(mockWebsiteRoutes[index].website_id)) mockWebsiteRoutes.splice(index, 1);
    mockWebsiteRoutes.push(...routes.map(item => ({ ...item })));
  });
  if (!committed) throw new SupersededOperationError();
  return { websites, routes, funnels, pages };
}

async function countDashboardMediaAssets(websiteId: string, userId: string): Promise<number> {
  const runtime = await createBuilderMediaRuntime({
    configuredMode: builderPublicationEnvironment.VITE_BUILDER_MEDIA_PERSISTENCE,
    production: builderPublicationProduction,
    userId,
    supabaseConfigured: builderPublicationSupabaseConfigured,
    getLocalDatabase: () => new IndexedDbBuilderMediaDatabase(),
    getSupabaseClient: getBuilderPublicationSupabaseClient,
    createLocalRepository: (database, actingUserId) => new LocalBuilderMediaRepository({ database, userId: actingUserId }),
    createSupabaseRepository: client => new SupabaseBuilderMediaRepository({ client })
  });
  if (!runtime.success) throw new Error('UNAVAILABLE');
  let count = 0;
  let cursor: string | undefined;
  do {
    const result = await runtime.repository.listAssets(websiteId, { limit: 100, ...(cursor ? { cursor } : {}) });
    count += result.items.length;
    cursor = result.nextCursor;
  } while (cursor);
  runtime.repository.dispose?.();
  return count;
}

async function loadWebsiteDashboardSummary(input: { actingUserId: string; website: Website; model: WebsiteDashboardModel }): Promise<WebsiteDashboardSummaryInput> {
  const pageId = input.model.currentPage?.id;
  const [publication, media, settings] = await Promise.allSettled([
    (async () => {
      if (!pageId) return { publicationState: 'never-published' as const };
      const runtime = await resolveBuilderPublicationRuntime(input.actingUserId);
      if (!runtime.success) throw new Error('UNAVAILABLE');
      const repository = runtime.persistence.repository;
      const [target, revision] = await Promise.all([repository.getPublicationTarget(input.website.id, pageId, input.actingUserId), repository.getPublishedRevisionForPage(input.website.id, pageId, input.actingUserId)]);
      if (!target.success || !revision.success) throw new Error('UNAVAILABLE');
      if (!target.data || !revision.data) return { publicationState: 'never-published' as const };
      const draft = dashboardUsesSupabase() ? null : getCurrentBuilderDocument(pageId);
      return { publicationState: draft && hasBuilderUnpublishedChanges(draft, revision.data) ? 'unpublished-changes' as const : 'published' as const, lastPublishedAt: target.data.publishedAt };
    })(),
    countDashboardMediaAssets(input.website.id, input.actingUserId),
    (async () => {
      if (!dashboardUsesSupabase()) {
        const brief = parseBuilderSetupBrief(mockWebsiteSettings.build_brief);
        return { settingsAvailable: true, setupBriefVersion: brief?.schemaVersion };
      }
      const client = await getBuilderPublicationSupabaseClient();
      if (!client) throw new Error('UNAVAILABLE');
      const result = await client.from('website_settings').select('build_brief').eq('website_id', input.website.id).eq('user_id', input.actingUserId).limit(1).maybeSingle();
      if (result.error) throw new Error('UNAVAILABLE');
      const brief = parseBuilderSetupBrief(result.data?.build_brief);
      return { settingsAvailable: !!result.data, setupBriefVersion: brief?.schemaVersion };
    })()
  ]);
  if (publication.status === 'rejected' && media.status === 'rejected' && settings.status === 'rejected') throw new Error('UNAVAILABLE');
  return { ...(publication.status === 'fulfilled' ? publication.value : { publicationState: 'unavailable' as const }), ...(media.status === 'fulfilled' ? { mediaAssetCount: media.value } : {}), ...(settings.status === 'fulfilled' ? settings.value : {}) };
}

function getWebsiteDashboardRouteContext(): { websiteId?: string; pageId?: string } {
  const hash = window.location.hash.startsWith('#/') ? window.location.hash.slice(2) : window.location.hash.replace(/^#/, '');
  const [route, query = ''] = hash.split('?');
  if (route !== 'website-dashboard') return {};
  const params = new URLSearchParams(query);
  return { websiteId: params.get('websiteId') || undefined, pageId: params.get('pageId') || undefined };
}

function publicationDashboardLabel(state: WebsiteDashboardModel['homepage']['publicationState']): string {
  return ({ loading: 'Checking publication…', 'never-published': 'Not published yet', published: 'Live version published', 'unpublished-changes': 'Changes waiting to be published', unavailable: 'Publication status unavailable' })[state];
}

function dashboardActionButton(model: WebsiteDashboardModel, action: BuilderNavigationAction, label: string, key: keyof WebsiteDashboardModel['actions'], pageId?: string | null): string {
  const availability = model.actions[key];
  const reason = availability.reason ? ` aria-describedby="dashboard-${key}-reason" title="${escapeBuilderInspectorHtml(availability.reason)}"` : '';
  const pageArgument = pageId ? `, ${builderInspectorJsArgument(pageId)}` : '';
  return `<div class="website-dashboard-action-wrap"><button type="button" class="website-dashboard-action" onclick='window.openDashboardBuilder(${builderInspectorJsArgument(action)}${pageArgument})' ${availability.enabled ? '' : 'disabled'}${reason}>${escapeBuilderInspectorHtml(label)}</button>${availability.reason ? `<span id="dashboard-${key}-reason" class="website-dashboard-action-reason">${escapeBuilderInspectorHtml(availability.reason)}</span>` : ''}</div>`;
}

(window as any).openDashboardBuilder = (action: BuilderNavigationAction, requestedPageId?: string) => {
  const state = websiteDashboardController?.state;
  if (!state || (state.status !== 'ready' && state.status !== 'partial') || !state.model.currentPage) return;
  const pageId = requestedPageId ?? (action === 'edit' ? state.model.homepage.id : state.model.currentPage.id);
  if (!pageId) return;
  if (action === 'preview') {
    const page = mockPages.find(candidate => candidate.id === pageId);
    const route = mockWebsiteRoutes.find(candidate => (
      candidate.website_id === state.model.website.id
      && candidate.funnel_id === page?.funnel_id
    ));
    const path = pageId === state.model.homepage.id
      ? state.model.homepage.path || '/'
      : route?.path || `/${page?.slug || ''}`;
    window.history.pushState({}, '', buildAuthenticatedPreviewUrl({
      websiteId: state.model.website.id,
      pageId,
      path
    }));
    void bootRouter();
    return;
  }
  const target = { websiteId: state.model.website.id, pageId, action };
  void (window as any).navigateTo('builder', undefined, { builderContext: target });
};

(window as any).selectDashboardWebsite = (websiteId: string) => {
  if (!websiteId) return;
  websiteSettingsHydrator.clear();
  activeBuilderWebsiteId = null;
  activeDashboardWebsiteId = websiteId;
  window.history.pushState({}, '', `#/website-dashboard?websiteId=${encodeURIComponent(websiteId)}`);
  void renderWebsiteDashboard();
};

(window as any).openWebsiteSettings = () => {
  const userId = getActingUserId();
  const preferredWebsiteId = currentView === 'website-settings'
    ? activeSettingsWebsiteId
    : currentView === 'website-dashboard'
      ? activeDashboardWebsiteId
      : currentView === 'builder'
        ? activeBuilderWebsiteId
        : activeSettingsWebsiteId || activeDashboardWebsiteId || activeBuilderWebsiteId;
  const ownedWebsiteId = preferredWebsiteId && mockWebsites.some(site => site.id === preferredWebsiteId && site.user_id === userId)
    ? preferredWebsiteId
    : null;
  const route: WebsiteSettingsRouteSelection = ownedWebsiteId
    ? { status: 'valid', websiteId: ownedWebsiteId }
    : { status: 'none' };
  void (window as any).navigateTo('website-settings', undefined, { websiteSettingsRoute: route });
};

(window as any).selectWebsiteForSettings = (websiteId: string) => {
  const route: WebsiteSettingsRouteSelection = websiteId
    ? { status: 'valid', websiteId }
    : { status: 'none' };
  void (window as any).navigateTo('website-settings', undefined, { websiteSettingsRoute: route });
};

(window as any).openWebsiteManagementView = (view: WebsiteManagementView) => {
  const userId = getActingUserId();

  const preferredWebsiteId = currentView === 'website-settings'
    ? activeSettingsWebsiteId
    : currentView === 'website-dashboard'
      ? activeDashboardWebsiteId
      : currentView === 'builder'
        ? activeBuilderWebsiteId
        : activeSettingsWebsiteId || activeDashboardWebsiteId || activeBuilderWebsiteId;

  const ownedWebsiteId = preferredWebsiteId && mockWebsites.some(site => site.id === preferredWebsiteId && site.user_id === userId)
    ? preferredWebsiteId
    : null;

  const route: WebsiteSettingsRouteSelection = ownedWebsiteId
    ? { status: 'valid', websiteId: ownedWebsiteId }
    : { status: 'none' };

  void (window as any).navigateTo(view, undefined, {
    websiteManagementRoute: route
  });
};

(window as any).selectWebsiteForManagement = (view: WebsiteManagementView, websiteId: string) => {
  const route: WebsiteSettingsRouteSelection = websiteId
    ? { status: 'valid', websiteId }
    : { status: 'none' };
  void (window as any).navigateTo(view, undefined, { websiteManagementRoute: route });
};

(window as any).refreshWebsiteDashboard = () => void renderWebsiteDashboard(true);

async function renderWebsiteDashboard(force = false) {
  const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
  const route = getWebsiteDashboardRouteContext();
  if (!websiteDashboardController || force) websiteDashboardController = new WebsiteDashboardController({ loadCore: loadWebsiteDashboardCore, loadSummary: loadWebsiteDashboardSummary });
  renderAppWithShell({
    activeView: 'website-dashboard',
    title: 'Website Dashboard',
    contentVariant: 'wide',
    contentHtml: `<div class="website-dashboard-loading" role="status">Loading website dashboard…</div>`
  });
  const state = await websiteDashboardController.load({ actingUserId: userId, explicitWebsiteId: route.websiteId, explicitPageId: route.pageId, previousWebsiteId: activeDashboardWebsiteId });
  if (currentView !== 'website-dashboard') return;
  if (state.status === 'selection-required') {
    renderAppWithShell({
      activeView: 'website-dashboard',
      title: 'Website Dashboard',
      contentVariant: 'wide',
      contentHtml: `<section class="card website-dashboard-state"><h2>Choose a website</h2><label for="dashboard-website-select">Website</label><select id="dashboard-website-select" onchange="window.selectDashboardWebsite(this.value)"><option value="">Select a website</option>${state.resolution.ownedWebsites.map(site => `<option value="${escapeBuilderInspectorHtml(site.id)}">${escapeBuilderInspectorHtml(site.name)}${site.domain ? ` — ${escapeBuilderInspectorHtml(site.domain)}` : ''}</option>`).join('')}</select></section>`
    });
    return;
  }
  if (state.status === 'error') {
    renderAppWithShell({
      activeView: 'website-dashboard',
      title: 'Website Dashboard',
      contentVariant: 'wide',
      contentHtml: `<section class="card website-dashboard-state" role="alert"><h2>Website information could not be loaded.</h2><p>Please try again.</p><button type="button" class="btn-outline" onclick="window.refreshWebsiteDashboard()">Retry</button></section>`
    });
    return;
  }
  if (state.status === 'empty' || state.status === 'unavailable') {
    const empty = state.status === 'empty';
    renderAppWithShell({
      activeView: 'website-dashboard',
      title: 'Website Dashboard',
      contentVariant: 'wide',
      contentHtml: `<section class="card website-dashboard-state" role="${empty ? 'status' : 'alert'}"><h2>${empty ? 'Create your first website.' : 'This website is not available.'}</h2><p>${empty ? 'Add your business details and we will create an editable homepage and site structure.' : 'Check your access or choose another owned website.'}</p>${empty ? '<button type="button" class="btn-primary" onclick="window.showOnboardingModal()">Create your website</button>' : ''}<button type="button" class="btn-outline" onclick="window.refreshWebsiteDashboard()">Retry</button></section>`
    });
    return;
  }
  if (state.status !== 'ready' && state.status !== 'partial') return;
  const model = state.model;
  activeDashboardWebsiteId = model.website.id;
  const selected = state.websites.find(item => item.id === model.website.id);
  const warning = state.status === 'partial' ? `<div class="website-dashboard-warning" role="alert">${escapeBuilderInspectorHtml(state.warning)} <button type="button" onclick="window.refreshWebsiteDashboard()">Retry</button></div>` : '';
  const liveLink = model.publicUrl ? `<a class="btn-primary website-dashboard-live" href="${escapeBuilderInspectorHtml(model.publicUrl)}" target="_blank" rel="noopener noreferrer">View Live Site <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>` : `<button type="button" class="btn-outline website-dashboard-live" disabled title="${escapeBuilderInspectorHtml(model.actions.viewLive.reason)}">View Live Site</button>`;
  renderAppWithShell({
    activeView: 'website-dashboard',
    title: 'Website Dashboard',
    subtitle: 'Manage the draft and published experience for this website.',
    headerActionsHtml: `<button type="button" class="btn-outline" onclick="window.refreshWebsiteDashboard()">Refresh</button>`,
    contentVariant: 'wide',
    contentHtml: `
      ${warning}
      ${state.websites.length > 1 ? `<div class="website-dashboard-selector"><label for="dashboard-website-select">Active website</label><select id="dashboard-website-select" onchange="window.selectDashboardWebsite(this.value)">${state.websites.map(site => `<option value="${escapeBuilderInspectorHtml(site.id)}" ${site.id === model.website.id ? 'selected' : ''}>${escapeBuilderInspectorHtml(site.name)}${site.domain ? ` — ${escapeBuilderInspectorHtml(site.domain)}` : ''}</option>`).join('')}</select></div>` : ''}
      <section class="card website-dashboard-identity" aria-labelledby="dashboard-site-heading"><div><span class="website-dashboard-eyebrow">Active website</span><h2 id="dashboard-site-heading">${escapeBuilderInspectorHtml(model.website.name)}</h2><p>${escapeBuilderInspectorHtml(model.website.publicHost ?? selected?.subdomain ?? 'Public domain not configured')}</p></div>${liveLink}</section>
      <div class="website-dashboard-grid"><section class="card website-dashboard-home" aria-labelledby="dashboard-home-heading"><div class="website-dashboard-card-heading"><div><span class="website-dashboard-eyebrow">Homepage</span><h2 id="dashboard-home-heading">${escapeBuilderInspectorHtml(model.homepage.name ?? 'No editable homepage found')}</h2></div><span class="website-dashboard-status status-${model.homepage.publicationState}">${escapeBuilderInspectorHtml(publicationDashboardLabel(model.homepage.publicationState))}</span></div>
      ${model.homepage.name ? `<dl class="website-dashboard-facts"><div><dt>Path</dt><dd>${escapeBuilderInspectorHtml(model.homepage.path)}</dd></div><div><dt>Page row status</dt><dd>${escapeBuilderInspectorHtml(model.homepage.legacyPageStatus)}</dd></div><div><dt>Last published</dt><dd>${model.homepage.lastPublishedAt ? escapeBuilderInspectorHtml(new Date(model.homepage.lastPublishedAt).toLocaleString()) : 'Not available'}</dd></div></dl>` : `<p>No editable homepage was found for this website. Open Pages to review the website structure.</p>`}
      <div class="website-dashboard-primary-actions">${dashboardActionButton(model, 'edit', 'Edit Home Page', 'edit', model.homepage.id)}${dashboardActionButton(model, 'preview', 'Preview Draft', 'preview', model.homepage.id)}${dashboardActionButton(model, 'publish', 'Publish', 'publish', model.homepage.id)}</div></section>
      <aside class="card website-dashboard-quick" aria-labelledby="dashboard-quick-heading"><h2 id="dashboard-quick-heading">Quick actions</h2>${dashboardActionButton(model, 'pages', 'Manage Pages', 'pages')}${dashboardActionButton(model, 'guided-setup', 'Guided Setup', 'guidedSetup')}${dashboardActionButton(model, 'assets', 'Assets', 'assets')}${dashboardActionButton(model, 'settings', 'Page Settings', 'settings')}</aside></div>
      <section class="website-dashboard-summary" aria-label="Website summary"><article class="card"><strong>${model.counts.pages}</strong><span>Website pages</span></article><article class="card"><strong>${model.counts.draftPages}</strong><span>Draft page rows</span></article><article class="card"><strong>${model.counts.mediaAssets ?? '—'}</strong><span>${model.counts.mediaAssets === null ? 'Media count unavailable' : 'Media assets'}</span></article><article class="card"><strong>${model.readiness.setupBriefVersion ? `v${model.readiness.setupBriefVersion}` : '—'}</strong><span>Guided setup brief</span></article></section>
    `
  });
}

function renderFunnels(mode: 'website' | 'marketing' = 'website') {
  currentView = 'funnels';
  (window as any).funnelMode = mode;
  const userId = getActingUserId();
  const ownedWebsiteIds = new Set(mockWebsites.filter(w => w.user_id === userId).map(w => w.id));
  const website = mockWebsites.find(w => w.user_id === userId && w.id === activeDashboardWebsiteId);
  if (mode === 'website' && !website) {
    renderWebsiteRepositoryUnavailable('funnels');
    return;
  }
  const siteRoutes = mode === 'website'
    ? mockWebsiteRoutes.filter(r => r.website_id === website!.id)
    : mockWebsiteRoutes.filter(r => ownedWebsiteIds.has(r.website_id));
  const routedFunnelIds = new Set(siteRoutes.map(r => r.funnel_id));
  
  const allFunnels = mockFunnels.filter(f => f.user_id === userId);
  
  const displayFunnels = mode === 'website'
    ? allFunnels.filter(f => routedFunnelIds.has(f.id))
    : allFunnels.filter(f => !routedFunnelIds.has(f.id));

  const viewTitle = mode === 'website' ? 'Site Pages' : 'Marketing Pages';
  const viewDesc = mode === 'website' 
    ? 'Manage the core pages that make up your business website.' 
    : 'Standalone lead-capture pages for ads and seasonal marketing.';

  const rowsHtml = displayFunnels.map(funnel => {
    const route = siteRoutes.find(r => r.funnel_id === funnel.id);
    return `
      <tr class="clickable-row" onclick="window.navigateTo('funnel-detail', '${funnel.id}')">
        <td style="font-weight: 600; color: var(--primary-color); padding-left: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2rem;">${mode === 'website' ? '📄' : '🎯'}</span>
            ${funnel.name || 'Untitled Page'}
          </div>
        </td>
        <td><code>${route ? route.path : '(Standalone)'}</code></td>
        <td><span class="badge badge-${funnel.status}">${funnel.status}</span></td>
        <td style="text-align: right; padding-right: 20px;">
           <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem;" onclick="event.stopPropagation(); window.navigateTo('funnel-detail', '${funnel.id}')">Manage</button>
           ${route && route.path !== '/' ? `<button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; background: #ef4444; border: none; margin-left: 5px;" onclick="event.stopPropagation(); window.deletePage('${route.id}', '${funnel.id}')">Delete</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  renderAppWithShell({
    activeView: mode === 'website' ? 'funnels' : 'marketing-funnels',
    title: viewTitle,
    subtitle: viewDesc,
    headerActionsHtml: `
      <div style="display: flex; gap: 12px;">
        ${mode === 'website'
          ? `<button class="btn-primary" onclick="window.showAddPageModal('${website!.id}')">+ New Website Page</button>`
          : `<button class="btn-primary" style="background: #4f46e5; border: none;" onclick="window.openNewPageModal('template')">+ New Marketing Page</button>`
        }
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      ${mode === 'website' ? renderWebsiteManagementSwitcher('funnels') : ''}
      
      <div id="pages-list-container" style="padding: 10px 0;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="clients-table" style="box-shadow: none; margin-top: 0;">
            <thead>
              <tr>
                <th style="padding-left: 20px;">${mode === 'website' ? 'Page Name' : 'Page Name'}</th>
                <th>Web Address</th>
                <th>Status</th>
                <th style="text-align: right; padding-right: 20px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="4" style="text-align: center; padding: 60px; color: #94a3b8;">No ${mode === 'website' ? 'pages' : 'funnels'} found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `
  });
}




async function renderFunnelDetail(funnelId: string) {
  const userId = getActingUserId();
  const funnelMode = resolveFunnelDetailMode({
    funnelId,
    userId,
    websites: mockWebsites,
    routes: mockWebsiteRoutes
  });
  const backTarget = funnelMode === 'marketing' ? 'marketing-funnels' : 'funnels';
  const activeNav = funnelMode === 'marketing' ? 'marketing-funnels' : 'funnels';

  renderAppWithShell({
    activeView: 'funnel-detail',
    activeNavId: activeNav,
    title: 'Loading page details…',
    contentVariant: 'wide',
    contentHtml: `
      <div id="funnel-detail-container" style="padding: 20px;">
        <div class="loading">Loading page details...</div>
      </div>
    `
  });

  try {
    const res = await fetch(`/api/funnels/${funnelId}`).then(r => r.json());
    if (!res.success) throw new Error(res.error || 'Failed to load');

    const funnel = res.data;
    const steps = funnel.steps || [];

    // 📊 WB.7.1: Calculate Metrics
    const [oppsAll, logsAll] = await Promise.all([
      fetch('/api/opportunities').then(r => r.json()),
      fetch('/api/events/logs').then(r => r.json())
    ]);

    const funnelOpps = (oppsAll.data || []).filter((o: any) => o.funnel_id === funnelId);
    const totalLeads = funnelOpps.length;
    const todayLeads = funnelOpps.filter((o: any) => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
    
    // Average Response Time calculation
    const logs = logsAll.data || [];
    const leadLogs = logs.filter((l: any) => l.event_name === 'lead_captured' && (l.payload?.funnel_id === funnelId || l.funnel_id === funnelId));
    
    let totalRespTime = 0;
    let respCount = 0;
    leadLogs.forEach((lead: any) => {
       const contactId = lead.payload?.contact_id || lead.contact_id;
       const smsLog = logs.find((l: any) => l.event_name === 'auto_sms_sent' && (l.payload?.contact_id === contactId || l.contact_id === contactId));
       if (smsLog) {
         const diff = new Date(smsLog.created_at).getTime() - new Date(lead.created_at).getTime();
         totalRespTime += Math.max(0, diff);
         respCount++;
       }
    });
    
    const avgRespTimeSec = respCount > 0 ? Math.round((totalRespTime / respCount) / 1000) : 0;
    const respTimeStr = avgRespTimeSec === 0 ? 'No data yet' : (avgRespTimeSec < 60 ? `${avgRespTimeSec}s` : `${Math.round(avgRespTimeSec/60)}m`);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyLeads = funnelOpps.filter((o: any) => new Date(o.created_at) >= oneWeekAgo).length;

    const stepsHtml = steps.map((step: any, index: number) => `
      <div class="step-card" style="display: flex; gap: 24px; align-items: flex-start; margin-bottom: 24px;">
        <div style="flex-shrink: 0; width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">${index + 1}</div>
        <div class="card" style="flex: 1; padding: 24px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eef2f6;">
          <div>
            <div style="font-size: 0.75rem; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">${step.step_type}</div>
            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">${step.name}</h4>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Path: <span style="font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">/${step.slug}</span></div>
          </div>
          <button class="btn-primary" style="background: white; color: var(--primary-color); border: 1px solid var(--primary-color); padding: 8px 16px; font-weight: 600;" onclick="window.openBuilderFromFunnel('${step.id}', '${funnelId}')">Edit Section</button>
        </div>
      </div>
      ${index < steps.length - 1 ? `<div style="width: 2px; height: 30px; background: #e2e8f0; margin-left: 19px; margin-top: -24px; margin-bottom: 4px;"></div>` : ''}
    `).join('');

    const routes = mockWebsiteRoutes
      .filter(route => route.funnel_id === funnelId)
      .map(route => {
        const website = mockWebsites.find(site => site.id === route.website_id && site.user_id === userId);
        if (!website) return null;
        const siteUrlBase = website.domain ? `https://${website.domain}` : `https://${website.subdomain}.pressurepro.io`;
        return { ...route, path: `${siteUrlBase}${route.path}` };
      })
      .filter((route): route is WebsiteRoute => Boolean(route));
    const siteUrlBase = '';

    renderAppWithShell({
      activeView: 'funnel-detail',
      activeNavId: activeNav,
      title: funnel.name || 'Page Details',
      subtitle: `Status: ${funnel.status} · Configure your sections and layout`,
      headerActionsHtml: `
        <button onclick="window.navigateTo('${backTarget}')" class="btn-primary" style="background: #f1f5f9; color: #475569; padding: 8px 12px; border-radius: 8px; border: none;">← Back</button>
      `,
      contentVariant: 'wide',
      contentHtml: `
        <!-- Website Attachment Card (W6.7) -->
        <div id="website-attachment-card" class="card" style="background: ${routes.length > 0 ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${routes.length > 0 ? '#bbf7d0' : '#fde68a'}; padding: 25px; margin-bottom: 32px; border-left: 6px solid ${routes.length > 0 ? '#10b981' : '#f59e0b'};">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: ${routes.length > 0 ? '0' : '20px'};">
            <div style="display: flex; align-items: center; gap: 15px;">
              <span style="font-size: 2rem;">${routes.length > 0 ? '🌐' : '🔗'}</span>
              <div>
                <div style="font-size: 0.75rem; color: ${routes.length > 0 ? '#166534' : '#92400e'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                  ${routes.length > 0 ? 'Connected to Website' : 'Not Connected to Website'}
                </div>
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; font-family: 'Inter', sans-serif;">
                  ${routes.length > 0
                    ? routes.map(r => `<a href="${siteUrlBase}${r.path}" target="_blank" style="color: inherit; text-decoration: none; border-bottom: 2px dashed #bbf7d0;">${siteUrlBase}${r.path} ↗</a>`).join(', ')
                    : 'Standalone Funnel (Not on Website)'}
                </h3>
              </div>
            </div>
            <button class="btn-primary" style="background: #1e293b; color: white; border: none; padding: 12px 24px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" onclick="window.showAttachToWebsiteModal('${funnelId}')">
              ${routes.length > 0 ? 'Manage Connection' : 'Attach to Website Page'}
            </button>
          </div>

          ${routes.length === 0 ? `
             <div style="font-size: 0.9rem; color: #92400e; font-weight: 600; background: rgba(255,255,255,0.4); padding: 14px; border-radius: 10px; margin-top: 15px; border: 1px dashed #fde68a;">
                💡 This page is currently a standalone project. Connecting it to your website allows it to appear in your site navigation and use your custom domain URL.
             </div>
          ` : ''}
        </div>

        <div style="margin-bottom: 12px; font-size: 0.9rem; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span style="color: #10b981;">📈</span>
          <span>${weeklyLeads} leads this week</span>
        </div>

        <div id="funnel-metrics" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px;">
          <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
            <div style="font-size: 2.5rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">${totalLeads}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Total Leads</div>
          </div>
          <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
            <div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6; margin-bottom: 4px;">${todayLeads}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Leads Today</div>
          </div>
          <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
            <div style="font-size: ${respTimeStr === 'No data yet' ? '1.5rem' : '2.5rem'}; font-weight: 800; color: #10b981; margin-bottom: 4px;">${respTimeStr}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Avg. response time</div>
            <div style="font-size: 0.7rem; color: #059669; font-weight: 600; margin-top: 8px;">Faster responses = more bookings</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; max-width: 1200px;">
          <div id="steps-section">
            <h3 style="margin-bottom: 24px; color: #1e293b; font-size: 1.25rem;">Page Sections</h3>
            <div class="steps-flow">
              ${stepsHtml}
            </div>

            <div style="margin-top: 32px; text-align: center; padding: 32px; border: 2px dashed #e2e8f0; border-radius: 12px;">
              <button class="btn-primary" style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;">+ Add New Step</button>
            </div>
          </div>

          <div id="activity-section">
            <div class="card" style="padding: 24px; position: sticky; top: 20px;">
              <h3 style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-size: 1.15rem; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.25rem;">⚡</span> Recent Activity
              </h3>
              <div id="activity-feed-container">
                 <div id="activity-feed-list"></div>
              </div>
            </div>
          </div>
        </div>
      `
    });

    // 🌿 WB.5.6: Populate activity feed
    const activityList = document.getElementById('activity-feed-list');
    if (activityList) {
      const contactIds = new Set(funnelOpps.map((o: any) => o.contact_id));
      const rawLogs = (logsAll.data || []).filter((l: any) => 
        contactIds.has(l.payload?.contact_id || l.contact_id) || 
        (l.payload?.funnel_id === funnelId)
      );

      const sortedLogs = rawLogs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15);

      if (sortedLogs.length === 0) {
        activityList.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">No activity yet. Share your page to start seeing leads!</div>';
      } else {
        activityList.innerHTML = sortedLogs.map((l: any) => {
          let icon = '📝';
          let label = l.event_name.replace(/_/g, ' ');
          let color = '#64748b';

          if (l.event_name.includes('lead')) { icon = '👤'; color = '#3b82f6'; label = 'Lead Captured'; }
          if (l.event_name.includes('sms')) { icon = '💬'; color = '#10b981'; label = 'SMS Sent'; }
          if (l.event_name.includes('call')) { icon = '📞'; color = '#f59e0b'; label = 'Missed Call'; }

          const timeStr = new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const contactName = l.payload?.name || 'Lead';

          return `
            <div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; display: flex; gap: 12px; align-items: flex-start;">
              <div style="background: ${color}15; color: ${color}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.9rem;">${icon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-weight: 700; color: #1e293b; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contactName}</span>
                  <span style="font-size: 0.75rem; color: #94a3b8;">${timeStr}</span>
                </div>
                <div style="font-size: 0.8rem; color: #64748b; text-transform: capitalize;">${label}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err: any) {
    console.error('Failed to load page detail:', err);
    renderAppWithShell({
      activeView: 'funnel-detail',
      activeNavId: activeNav,
      title: 'Page Details',
      headerActionsHtml: `
        <button onclick="window.navigateTo('${backTarget}')" class="btn-primary" style="background: #f1f5f9; color: #475569; padding: 8px 12px; border-radius: 8px; border: none;">← Back</button>
      `,
      contentVariant: 'wide',
      contentHtml: `<div class="error">Failed to load page: ${escapeHtmlText(err.message)}</div>`
    });
  }
}

(window as any).showAddPageModal = (websiteId: string) => {
    const modal = document.createElement('div');
    modal.id = 'page-modal';
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div class="card" style="width: 100%; max-width: 480px; padding: 30px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0; margin-bottom: 24px; font-size: 1.5rem;">Add New Website Page</h3>
                
                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; display: block;">Page Name</label>
                    <input type="text" id="new-page-name" placeholder="e.g. Roof Cleaning" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
                </div>

                <div class="form-group" style="margin-bottom: 30px;">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 12px; display: block;">Page Type</label>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="service" checked style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Service Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Pre-built sections for showcasing specific services.</div>
                            </div>
                        </label>
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="contact" style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Contact & Quote Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Optimized for lead capture and quote requests.</div>
                            </div>
                        </label>
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="custom" style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Custom Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Start with a blank canvas for complete control.</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 8px;" onclick="document.getElementById('page-modal').remove()">Cancel</button>
                    <button class="btn-primary" style="padding: 12px 24px; border-radius: 8px; font-weight: 700;" onclick="window.saveNewPage('${websiteId}')">Create & Publish</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

(window as any).saveNewPage = async (websiteId: string) => {
    if (blockUnsupportedProductionWebsiteMutation('Legacy page creation')) return;
    const nameInput = document.getElementById('new-page-name') as HTMLInputElement;
    if (!nameInput?.value) {
        alert('Please enter a page name.');
        return;
    }

    const name = nameInput.value.trim();
    // Auto-generate slug and path
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const path = '/' + slug;

    try {
        (window as any).showToast('Auto-generating page structure...', 3000);
        
        // 1. Create Page (Funnel) via API
        const res = await fetch('/api/funnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }).then(r => r.json());

        if (res.success) {
            const funnelId = res.data.id;

            // 2. Create Route in mock data
            if (!mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === path)) {
              const newRoute = {
                  id: `r-${Date.now()}`,
                  website_id: websiteId,
                  path: path,
                  funnel_id: funnelId,
                  created_at: new Date().toISOString()
              };
              mockWebsiteRoutes.push(newRoute as any);
            }
            
            // 3. Add to Website Navigation automatically
            const layout = mockWebsiteLayouts.find(l => l.website_id === websiteId) || mockWebsiteLayouts[0];
            if (layout && layout.header_config) {
                if (!layout.header_config.nav_items) layout.header_config.nav_items = [];
                // Check if already in nav
                if (!layout.header_config.nav_items.some(item => item.path === path)) {
                    layout.header_config.nav_items.push({ label: name, path: path, visible: true });
                }
            }

            (window as any).showToast('Page Created & Added to Menu!', 2000);
            document.getElementById('page-modal')?.remove();
            
            // Jump to the detail view immediately for customization
            window.navigateTo('funnel-detail', funnelId);
        } else {
            alert('Error: ' + res.error);
        }
    } catch (err: any) {
        alert('Failed to automate page creation: ' + err.message);
    }
};

(window as any).deletePage = (routeId: string, funnelId: string) => {
    if (blockUnsupportedProductionWebsiteMutation('Page deletion')) return;
    if (!confirm('Are you sure? This will delete the page and its URL path.')) return;

    // 1. Remove Route
    const rIdx = mockWebsiteRoutes.findIndex(r => r.id === routeId);
    if (rIdx !== -1) mockWebsiteRoutes.splice(rIdx, 1);

    // 2. Remove Funnel
    const fIdx = mockFunnels.findIndex(f => f.id === funnelId);
    if (fIdx !== -1) mockFunnels.splice(fIdx, 1);

    (window as any).showToast('Page deleted', 2000);
    renderFunnels();
};

async function hydrateAuthenticatedPreviewSections(
  pageId: string,
  userId: string,
  operation: ProtectedAsyncOperationToken
): Promise<void> {
  const client = await getBuilderPublicationSupabaseClient();
  if (!client) throw new Error('UNAVAILABLE');
  const sectionsResult = await client.from('page_sections')
    .select('id,page_id,type,content,order_index,styles')
    .eq('page_id', pageId)
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (sectionsResult.error) throw new Error('UNAVAILABLE');
  const sections = (sectionsResult.data ?? []).map((row: any): PageSection => {
    const rawContent = row.content && typeof row.content === 'object' ? structuredClone(row.content) : {};
    const variant = typeof rawContent.__builder_variant === 'string' ? rawContent.__builder_variant : undefined;
    if ('__builder_variant' in rawContent) delete rawContent.__builder_variant;
    return {
      id: String(row.id),
      page_id: String(row.page_id),
      type: String(row.type),
      content: rawContent,
      order: Number(row.order_index),
      styles: row.styles && typeof row.styles === 'object' ? structuredClone(row.styles) : {},
      ...(variant ? { variant } : {})
    };
  });
  protectedAsyncOperationGuard.requireCurrent(operation, getActingUserId());
  for (let index = mockPageSections.length - 1; index >= 0; index -= 1) {
    if (mockPageSections[index].page_id === pageId) mockPageSections.splice(index, 1);
  }
  mockPageSections.push(...sections);
}

async function initializeBuilderNavigation(context: BuilderContext | null): Promise<boolean> {
  builderRouteUnavailableReason = null;
  const parsedRoute = parseBuilderNavigationTarget(window.location.hash);
  if ((context?.websiteId || context?.action) && parsedRoute.status !== 'valid') {
    builderRouteUnavailableReason = 'The Builder link is invalid.';
    return false;
  }
  if (!context?.websiteId || !context.pageId) return applyBuilderContext(context);
  const userId = typeof (window as any).currentUser === 'string' ? (window as any).currentUser.trim() : '';
  const builderOperation = protectedAsyncOperationGuard.begin('builder-navigation', userId);
  try {
    if (dashboardUsesSupabase()) await loadWebsiteDashboardCore({ actingUserId: userId });
    const target = { websiteId: context.websiteId, pageId: context.pageId, action: context.action ?? 'edit' as BuilderNavigationAction };
    const resolution = resolveBuilderNavigationTarget({ actingUserId: userId, target, websites: mockWebsites, routes: mockWebsiteRoutes, funnels: mockFunnels, pages: mockPages });
    if (resolution.status !== 'resolved') throw new Error('UNAVAILABLE');
    activeBuilderWebsiteId = resolution.website.id;
    if (dashboardUsesSupabase()) {
      const settingsState = await websiteSettingsHydrator.hydrate(userId, resolution.website);
      if (settingsState.status === 'error') throw new Error('UNAVAILABLE');
      protectedAsyncOperationGuard.requireCurrent(builderOperation, getActingUserId());
      applyPrimaryColor(mockWebsiteSettings.primary_color);
      await hydrateAuthenticatedPreviewSections(resolution.page.id, userId, builderOperation);
    }
    protectedAsyncOperationGuard.requireCurrent(builderOperation, getActingUserId());
    applyBuilderContext(context);
    builderHistoryController = null;
    builderPageSettingsController = null;
    builderMediaController = null;
    builderMediaControllerIdentity = '';
    return true;
  } catch (error) {
    if (isSupersededOperationError(error)) throw error;
    builderRouteUnavailableReason = 'The selected page is no longer available.';
    return false;
  }
}

function prepareBuilderInitialAction(context: BuilderContext | null): boolean {
  if (!context?.websiteId || !context.action) return false;
  const key = `${context.websiteId}:${context.pageId}:${context.action}`;
  if (consumedBuilderInitialAction === key) return false;
  consumedBuilderInitialAction = key;
  builderMode = context.action === 'preview' ? 'preview' : 'edit';
  if (context.action === 'pages' || context.action === 'settings') {
    builderLeftPanelTab = 'pages';
    builderPagesPanelView = context.action === 'settings' ? 'settings' : 'list';
  } else if (context.action === 'assets') {
    builderLeftPanelTab = 'assets';
  } else if (context.action === 'navigation') {
    builderLeftPanelTab = 'navigation';
  }
  return true;
}

async function finishBuilderInitialAction(context: BuilderContext | null, prepared: boolean): Promise<void> {
  if (!prepared || !context?.action) return;
  if (context.action === 'assets') await ensureBuilderMediaController();
  if (context.action === 'guided-setup') (window as any).openBuilderSetup('.pb-guided-setup-button');
  if (context.action === 'publish') {
    await loadBuilderPublicationState(context.pageId, true);
    await (window as any).openBuilderPublishModal();
  }
}

const WEBSITE_DATA_VIEWS = new Set([
  'funnels', 'marketing-funnels', 'funnel-detail', 'pages', 'page-sections',
  'pages-seo', 'website-settings', 'website-navigation', 'seo-pages', 'website-structure'
]);

const EXPLICIT_WEBSITE_MANAGEMENT_VIEWS = new Set<WebsiteManagementView>([
  'funnels', 'website-navigation', 'website-structure', 'seo-pages'
]);

function isExplicitWebsiteManagementView(view: string): view is WebsiteManagementView {
  return EXPLICIT_WEBSITE_MANAGEMENT_VIEWS.has(view as WebsiteManagementView);
}

function renderWebsiteRepositoryUnavailable(view: string): void {
  currentView = view;
  const contentHtml = `
    <section class="card website-dashboard-state" role="alert">
      <p>Please try again.</p>
      <button type="button" class="btn-outline" onclick="window.navigateTo('${escapeBuilderInspectorHtml(view)}')">Retry</button>
    </section>
  `;

  renderAppWithShell({
    activeView: view,
    title: 'Website information could not be loaded.',
    contentVariant: 'standard',
    user: getCurrentShellUser(),
    contentHtml
  });
}

(window as any).navigateTo = async (view: string, id?: string, context?: any) => {
  const navigationInvocation = protectedAsyncOperationGuard.beginUnbound('application-navigation');
  let navigationOperation: ProtectedAsyncOperationToken;
  publicSiteRenderSequence += 1;
  if (view !== 'site') {
    publicSiteAbortController?.abort();
    publicSiteAbortController = null;
  }
  if (view !== 'site') {
    const authState = await ensureApplicationAuth();
    const boundNavigation = protectedAsyncOperationGuard.bindCurrent(navigationInvocation, getActingUserId());
    if (!boundNavigation) return;
    navigationOperation = boundNavigation;
    if (authState.status === 'initializing' || authState.status === 'unavailable') {
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
      renderApplicationUnavailable();
      return;
    }
    if (view === 'login') {
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
      const returnTo = getLoginReturnRoute(window.location.hash);
      if (authState.status === 'authenticated') {
        window.history.replaceState({}, '', returnTo ?? '#/dashboard');
        await bootRouter();
      } else {
        const loginHash = buildApplicationLoginHash(returnTo);
        if (window.location.hash !== loginHash) window.history.replaceState({}, '', loginHash);
        renderApplicationLogin(returnTo);
      }
      return;
    }
    if (authState.status === 'unauthenticated') {
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
      const currentHash = sanitizeApplicationReturnRoute(window.location.hash);
      const requestedHash = currentHash && currentHash.slice(2).split(/[/?]/, 1)[0] === view
        ? currentHash
        : sanitizeApplicationReturnRoute(id ? `#/${view}/${encodeURIComponent(id)}` : `#/${view}`);
      const loginHash = buildApplicationLoginHash(requestedHash);
      window.history.replaceState({}, '', loginHash);
      renderApplicationLogin(requestedHash);
      return;
    }
    await ensureProductionCrmData(authState.user.id, view);
    if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
    if (editorUsesSupabase() && WEBSITE_DATA_VIEWS.has(view)) {
      try {
        const core = await loadWebsiteDashboardCore({ actingUserId: authState.user.id });
        protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
        if (core.websites.length === 0) {
          window.history.replaceState({}, '', '#/website-dashboard');
          currentView = 'website-dashboard';
          await renderWebsiteDashboard(true);
          return;
        }
      } catch (error) {
        if (isSupersededOperationError(error)
          || !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
        renderWebsiteRepositoryUnavailable(view);
        return;
      }
    }
  } else {
    const boundNavigation = protectedAsyncOperationGuard.bindCurrent(navigationInvocation, getActingUserId());
    if (!boundNavigation) return;
    navigationOperation = boundNavigation;
  }
  const previousView = currentView;
  currentView = view;
  if (view !== 'builder') consumedBuilderInitialAction = null;
  if (id) selectedContactId = id;

  checkOverdueInvoices();

  // Show skeleton if switching to major data-heavy views
  if (view !== previousView && ['pages', 'templates', 'builder'].includes(view)) {
    if (view === 'builder') {
      currentShellController?.destroy();
      currentShellController = null;
      app.innerHTML = `
        <main>
          <header class="view-header">
            <div class="skeleton skeleton-title" style="width: 300px; margin: 0;"></div>
          </header>
          ${renderSkeleton(view as any)}
        </main>
      `;
    } else {
      renderAppWithShell({
        activeView: view,
        title: view === 'pages' ? 'All Website Sections' : 'Website Templates',
        contentVariant: 'wide',
        contentHtml: renderSkeleton(view as any)
      });
    }
    setTimeout(() => {
      if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
      void executeNavigation(view, id, context, navigationOperation).catch(error => {
        if (!isSupersededOperationError(error)) console.error('[Navigation] Deferred render failed:', error);
      });
    }, 350);
  } else {
    try {
      await executeNavigation(view, id, context, navigationOperation);
    } catch (error) {
      if (isSupersededOperationError(error)
        || !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
      throw error;
    }
  }
  if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
  renderCrmHydrationNotice();

  // Update URL for standard CRM navigation (Hash based)
  if (!['site', 'preview'].includes(view)) {
    let newHash = id ? `#/${view}/${id}` : `#/${view}`;
    if (view === 'website-settings' && activeSettingsWebsiteId) {
      newHash = buildWebsiteSettingsRoute(activeSettingsWebsiteId);
    } else if (view === 'website-settings' && window.location.hash.startsWith('#/website-settings?')) {
      // Preserve an invalid deep link while the fail-closed selector is shown.
      newHash = window.location.hash;
    } else if (isExplicitWebsiteManagementView(view) && activeDashboardWebsiteId) {
      newHash = buildWebsiteManagementRoute(view, activeDashboardWebsiteId);
    } else if (isExplicitWebsiteManagementView(view) && window.location.hash.startsWith(`#/${view}?`)) {
      newHash = window.location.hash;
    }
    if (view === 'builder' && context?.builderContext?.pageId) {
      const builderContext = context.builderContext as BuilderContext;
      if (builderContext.websiteId && builderContext.action) {
        newHash = buildBuilderNavigationTarget({ websiteId: builderContext.websiteId, pageId: builderContext.pageId, action: builderContext.action });
      } else {
      const params = new URLSearchParams();
      params.set('pageId', builderContext.pageId);
      if (builderContext.sectionId) params.set('sectionId', builderContext.sectionId);
      if (builderContext.path) params.set('path', builderContext.path);
      if (builderContext.label) params.set('label', builderContext.label);
      if (builderContext.returnTo) params.set('returnTo', builderContext.returnTo);
      if (builderContext.funnelId) params.set('funnelId', builderContext.funnelId);
      newHash = `#/builder?${params.toString()}`;
      }
    }
    if (window.location.hash !== newHash) {
       window.history.pushState({}, "", newHash);
    }
  } else {
    // Phase W6.9: Real URLs for Public Site (No Hashes)
    let newPath = '';
    if (view === 'site') {
      newPath = id ? `/site${id.startsWith('/') ? id : '/' + id}` : '/site/';
    } else if (view === 'preview') {
      newPath = id ? `/preview/${id}` : '/preview/';
    }
    
    if (newPath && window.location.pathname !== newPath) {
      window.history.pushState({}, "", newPath);
    }
  }
};

async function executeNavigation(
  view: string,
  id?: string,
  context?: any,
  navigationOperation?: ProtectedAsyncOperationToken
) {
  if (navigationOperation) protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
  if (['builder', 'site', 'preview'].includes(view)) {
    currentShellController?.destroy();
    currentShellController = null;
  }
  if (isExplicitWebsiteManagementView(view)) {
    const selection = resolveWebsiteSettingsSelection({
      actingUserId: getActingUserId(),
      websites: mockWebsites,
      route: context?.websiteManagementRoute ?? parseWebsiteManagementRoute(window.location.hash, view)
    });
    if (selection.status === 'empty') {
      window.history.replaceState({}, '', '#/website-dashboard');
      currentView = 'website-dashboard';
      await renderWebsiteDashboard(true);
      return;
    }
    if (selection.status === 'selection-required' || selection.status === 'invalid') {
      activeDashboardWebsiteId = null;
      renderWebsiteManagementSelector(view, selection.ownedWebsites, selection.status === 'invalid');
      return;
    }
    activeDashboardWebsiteId = selection.website.id;
  }
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'clients': await renderClients(); break;
    case 'contact-detail': if (id) await renderContactDetail(id); break;
    case 'opportunities': renderOpportunities(); break;
    case 'quotes': renderQuotes(); break;
    case 'new-quote': 
      (window as any).newQuoteContactId = id || '';
      (window as any).newQuoteOpportunityId = '';
      (window as any).newQuoteLineItems = [];
      (window as any).newQuoteRequestKey = crypto.randomUUID();
      renderNewQuote(); 
      break;
    case 'invoices': renderInvoices(); break;
    case 'lead-capture': renderLeadCapture(); break;
    case 'funnels': renderFunnels('website'); break;
    case 'marketing-funnels': renderFunnels('marketing'); break;
    case 'website-dashboard': await renderWebsiteDashboard(); break;
    case 'funnel-detail': if (id) renderFunnelDetail(id); break;
    case 'pages': renderPages(); break;
    case 'page-sections': if (id) renderPageSections(id); break;
    case 'builder': {
      const builderContext = (context?.builderContext ?? getBuilderContextFromHash()) as BuilderContext | null;
      await initializeBuilderNavigation(builderContext);
      if (navigationOperation) protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
      const prepared = prepareBuilderInitialAction(builderContext);
      renderBuilder();
      await finishBuilderInitialAction(builderContext, prepared);
      break;
    }
    case 'templates': renderTemplates(); break;
    case 'pages-seo': renderPagesSeoLanding(); break;
    case 'components': renderComponents(); break;
    case 'website-settings': {
      const selection = resolveWebsiteSettingsSelection({
        actingUserId: getActingUserId(),
        websites: mockWebsites,
        route: context?.websiteSettingsRoute ?? parseWebsiteSettingsRoute(window.location.hash)
      });
      if (selection.status === 'empty') {
        window.history.replaceState({}, '', '#/website-dashboard');
        currentView = 'website-dashboard';
        await renderWebsiteDashboard(true);
        return;
      }
      if (selection.status === 'selection-required' || selection.status === 'invalid') {
        activeSettingsWebsiteId = null;
        websiteSettingsHydrator.clear();
        applyPrimaryColor(mockWebsiteSettings.primary_color);
        renderWebsiteSettingsSelector(selection.ownedWebsites, selection.status === 'invalid');
        break;
      }
      if (activeSettingsWebsiteId !== selection.website.id) {
        websiteSettingsHydrator.clear();
      }
      activeSettingsWebsiteId = selection.website.id;
      try {
        const settingsRes = await fetch('/api/settings').then(r => r.json());
        if (!settingsRes.success || !settingsRes.data) throw new Error('UNAVAILABLE');
      } catch (err) {
        if (navigationOperation && !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
        renderWebsiteRepositoryUnavailable('website-settings');
        return;
      }
      if (navigationOperation) protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
      renderWebsiteSettings();
      break;
    }
    case 'website-navigation': renderWebsiteNavigation(); break;
    case 'seo-pages': (window as any).renderSeoPages(); break;
    case 'website-structure': renderWebsiteStructure(); break;
    case 'reports': renderReports(); break;
    case 'quickstart': renderQuickstart(); break;
    case 'event-logs': renderEventLogs(); break;
    case 'qa-tools': renderQATools(); break;
    case 'quote-preview': if (id) renderQuotePreview(id); break;
    case 'site':
      await renderConfiguredPublicSite(normalizePreviewPath(id || '/'));
      break;
    case 'preview': 
      if (id && context) renderSitePage(id, context, true); 
      else if (id) {
         const result = await resolveWebsiteRequest(window.location.hostname, id);
         if (result && result.funnel_id) {
           renderSitePage(
             result.funnel_id,
             createResolvedWebsiteRenderContext(result, normalizePreviewPath(id)),
             true
           );
         } else {
           render404('Preview target not found.');
         }
      }
      break;
    default: renderDashboard();
  }

  if (!['site', 'preview'].includes(view)) {
    document.title = 'Hansveer CRM';
    updateMetaTag('description', 'Professional CRM for Handyman Businesses');
    updateMetaTag('keywords', 'crm, handyman, pressure washing');
  }
}

(window as any).downloadSitemap = () => {
  const publishedPages = mockPages.filter(p => p.status === 'published');
  const baseUrl = 'https://hanssays.com/site'; // Hypothetical production base URL

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publishedPages.map(page => `  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${new Date(page.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.slug === 'home' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  const blob = new Blob([sitemapContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sitemap.xml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert('Dynamic Sitemap generated and downloaded for ' + publishedPages.length + ' published pages.');
};

(window as any).selectQuoteTier = (quoteId: string, tier: 'basic' | 'standard' | 'premium') => {
  if (editorUsesSupabase()) { (window as any).showToast('Quote option updates are temporarily unavailable.', 'error'); return; }
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.selected_tier = tier;
    const tierItems = mockQuoteItems.filter(i => i.quote_id === quoteId && i.tier === tier);
    quote.total_amount = tierItems.reduce((sum, item) => sum + item.total, 0);

    // Update linked opportunity value
    if (quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.value = quote.total_amount;
      }
    }

    renderQuotePreview(quoteId);
  }
};

function renderQuotePreview(quoteId: string) {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (!quote) return;
  const contact = mockContacts.find(c => c.id === quote.contact_id);
  const allItems = mockQuoteItems.filter(i => i.quote_id === quoteId);

  const renderTierColumn = (tier: 'basic' | 'standard' | 'premium') => {
    // items that match tier or have no tier (defaulting old items to basic)
    const tierItems = allItems.filter(i => i.tier === tier || (!i.tier && tier === 'basic'));
    const tierTotal = tierItems.reduce((sum, item) => sum + item.total, 0);
    const isSelected = quote.selected_tier === tier;

    return `
      <div style="flex: 1; min-width: 280px; border: 2px solid ${isSelected ? 'var(--primary-color)' : '#eef2f6'}; border-radius: 16px; padding: 30px; background: ${isSelected ? '#f0f7ff' : '#fff'}; display: flex; flex-direction: column; transition: all 0.2s; position: relative; ${isSelected ? 'box-shadow: 0 10px 25px -5px rgba(0, 123, 255, 0.1);' : ''}">
        ${isSelected ? '<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--primary-color); color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</div>' : ''}
        
        <h3 style="text-align: center; text-transform: capitalize; margin: 0 0 10px 0; color: #1e293b; font-size: 1.25rem;">${tier}</h3>
        
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px dashed ${isSelected ? '#d0e5ff' : '#f1f5f9'};">
          <div style="font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 20px;">$${tierTotal.toLocaleString()}</div>
          <button class="btn-primary no-print" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; background: ${isSelected ? '#28a745' : 'var(--primary-color)'}; color: white; border: none; cursor: pointer;" onclick="window.selectQuoteTier('${quote.id}', '${tier}')">
            ${isSelected ? '✓ Selected' : 'Choose ' + tier}
          </button>
        </div>

        <div style="flex: 1;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${tierItems.map(item => `
              <li style="padding: 12px 0; border-bottom: 1px solid ${isSelected ? '#d0e5ff' : '#f8fafc'};">
                <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b; margin-bottom: 2px;">${escapeHtmlText(item.service_name)}</div>
                <div style="font-size: 0.85rem; color: #64748b; line-height: 1.4;">${escapeHtmlText(item.description)}</div>
                <div style="text-align: right; font-weight: 700; color: #1e293b; margin-top: 8px; font-size: 0.95rem;">$${item.total.toLocaleString()}</div>
              </li>
            `).join('')}
            ${tierItems.length === 0 ? '<li style="text-align: center; color: #94a3b8; padding: 40px 0; font-style: italic;">No items included</li>' : ''}
          </ul>
        </div>
      </div>
    `;
  };

  renderAppWithShell({
    activeView: 'quote-preview',
    title: 'Quote Preview',
    headerActionsHtml: `
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="window.navigateTo('quotes')" class="btn-primary no-print" style="background: #eee; color: #333; padding: 6px 12px;">← Back</button>
        <button class="btn-primary no-print" onclick="window.print()">Print Selected Option</button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: `
      <div class="card quote-preview" style="padding: 60px; max-width: 1100px; margin: 0 auto; background: white; border-radius: 0; min-height: 1000px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 60px; border-bottom: 3px solid #f1f5f9; padding-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: var(--primary-color); font-size: 2rem; letter-spacing: -0.5px;">Handyman Hans Pressure Washing</h1>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 1.1rem;">Professional Exterior Cleaning Services</p>
          </div>
          <div style="text-align: right;">
            <div style="text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px;">Quote Number</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">#Q-${quote.id}</div>
          </div>
        </div>

        <div style="margin-bottom: 60px; background: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="display: flex; gap: 60px;">
            <div>
              <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 12px;">Client Details</div>
              <div style="font-weight: 700; font-size: 1.25rem; color: #1e293b; margin-bottom: 8px;">${escapeHtmlText(contact ? contact.name : 'Valued Customer')}</div>
              <div style="color: #64748b; line-height: 1.5;">
                ${escapeHtmlText(contact ? contact.address : '')}<br>
                ${escapeHtmlText(contact ? contact.email || '' : '')}<br>
                ${escapeHtmlText(contact ? formatContactPhone(contact.phone) : '')}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; color: #1e293b; margin-bottom: 25px; text-align: center;">Choose Your Service Level</h2>
          <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px; align-items: stretch;">
            ${renderTierColumn('basic')}
            ${renderTierColumn('standard')}
            ${renderTierColumn('premium')}
          </div>
        </div>

        ${quote.notes ? `
          <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 40px;">
            <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 15px;">Additional Terms & Notes</div>
            <div style="color: #475569; line-height: 1.8; font-size: 1rem; white-space: pre-wrap;">${escapeHtmlText(quote.notes)}</div>
          </div>
        ` : ''}

        <div style="margin-top: 100px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <div style="font-size: 1.1rem; color: #1e293b; font-weight: 600; margin-bottom: 10px;">Ready to proceed?</div>
          <p style="color: #64748b; font-size: 0.95rem;">Select your preferred option above. We look forward to working with you!</p>
        </div>
      </div>
    `
  });
}

/**
 * Simulated API for CRM Activity Timeline
 * GET /api/contacts/:id/timeline
 */
async function loadTimeline(contactId: string) {
  const response = await fetch(`/api/contacts/${contactId}/timeline`);
  const result = await response.json();
  const timeline = result.data || result;
  contactTimelineState = timeline;

  const timelineContainer = document.getElementById('api-timeline-list');
  if (timelineContainer) {
    timelineContainer.innerHTML = contactTimelineState.map(group => `
            <section class="wo-contact-detail-timeline-group">
                <h3 class="wo-contact-detail-timeline-label">${escapeHtmlText(group.label)}</h3>
                <div class="wo-contact-detail-timeline-items">
                    ${group.items.map((item: any) => {
      const isMissed = item.type === 'call_missed';

      return `
                            <div class="wo-contact-detail-timeline-item${isMissed ? ' wo-contact-detail-timeline-item--missed' : ''}">
                                <div>${escapeHtmlText(item.content)}</div>
                                <time>${escapeHtmlText(item.created_at)}</time>
                            </div>
                        `;
    }).join('')}
                    ${group.items.length === 0 ? '<p class="wo-contact-detail-empty">No activities recorded.</p>' : ''}
                </div>
            </section>
        `).join('') || '<p class="wo-contact-detail-empty">No timeline entries found.</p>';
  }
}

(window as any).loadTimeline = loadTimeline;

async function sendQuickSMS(contactId: string) {
  (window as any).openSmsComposer(contactId);
}

(window as any).sendQuickSMS = sendQuickSMS;

async function renderContactDetail(contactId: string) {
  renderAppWithShell({
    activeView: 'contact-detail',
    title: 'Loading contact details…',
    contentVariant: 'standard',
    contentHtml: renderContactDetailLoading()
  });

  const response = await fetch(`/api/contacts/${contactId}`);
  const result = await response.json();
  const contact: Contact | null = result.data || result;
  const userId = getActingUserId();

  if (!contact || response.status === 404 || contact.user_id !== userId) {
    (window as any).showToast('Contact not found.', 3000);
    window.navigateTo('clients');
    return;
  }

  const contactOpps = mockOpportunities.filter(opp => opp.user_id === userId && opp.contact_id === contactId);
  const contactQuotes = mockQuotes.filter(q => q.user_id === userId && q.contact_id === contactId);
  renderAppWithShell({
    activeView: 'contact-detail',
    title: contact.name,
    subtitle: `Status: ${contact.status}`,
    headerActionsHtml: `
      <div class="wo-contact-header-actions">
        <button type="button" class="wo-button wo-button--ghost wo-button--sm" onclick="window.navigateTo('clients')" aria-label="Back to clients">← <span class="wo-contact-header-label">Back</span></button>
        <button type="button" class="wo-button wo-button--secondary wo-button--sm" onclick="window.addNote('${contactId}')" aria-label="Add note">📝 <span class="wo-contact-header-label">Note</span></button>
        <button type="button" class="wo-button wo-button--primary wo-button--sm" onclick="window.createOpportunity('${contactId}')" aria-label="Create new opportunity">💰 <span class="wo-contact-header-label">New opportunity</span></button>
      </div>
    `,
    contentVariant: 'wide',
    contentHtml: renderContactDetailContent({ contact, opportunities: contactOpps, quotes: contactQuotes })
  });

  loadTimeline(contactId);
}

(window as any).logCall = (contactId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Activity creation is temporarily unavailable.', 'error'); return; }
  const note = prompt("Enter call summary:");
  if (note) {
    mockActivities.push({
      id: 'act-' + Date.now(),
      user_id: getActingUserId(),
      contact_id: contactId,
      type: 'call',
      description: note,
      due_date: new Date().toISOString(),
      completed: true
    });
    renderContactDetail(contactId);
  }
};

(window as any).addNote = (contactId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Activity creation is temporarily unavailable.', 'error'); return; }
  const note = prompt("Enter your note:");
  if (note) {
    mockActivities.push({
      id: 'act-' + Date.now(),
      user_id: getActingUserId(),
      contact_id: contactId,
      type: 'note',
      description: note,
      due_date: new Date().toISOString(),
      completed: true
    });
    renderContactDetail(contactId);
  }
};

(window as any).completeTask = (activityId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Activity updates are temporarily unavailable.', 'error'); return; }
  const activity = mockActivities.find(a => a.id === activityId);
  if (activity) {
    activity.completed = true;
    if (selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).createOpportunity = (contactId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Opportunity creation is temporarily unavailable.', 'error'); return; }
  const valueInput = prompt("Enter Opportunity value (e.g. 500):", "0");
  const value = parseFloat(valueInput || "0");

  const newOpp = {
    id: 'o' + (mockOpportunities.length + 1) + '-' + Math.floor(Math.random() * 100),
    user_id: 'system',
    contact_id: contactId,
    pipeline_stage: 'New Lead',
    value: isNaN(value) ? 0 : value,
    assigned_to: 'Hansveer',
    status: 'open' as any,
    created_at: new Date().toISOString()
  };

  mockOpportunities.push(newOpp);

  // Trigger automation
  runAutomations('OPPORTUNITY_CREATED', newOpp);

  renderContactDetail(contactId);
};

(window as any).updateOpportunityField = (oppId: string, field: string, value: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Opportunity updates are temporarily unavailable.', 'error'); return; }
  const opp = mockOpportunities.find(o => o.user_id === getActingUserId() && o.id === oppId);
  if (opp) {
    if (field === 'value') {
      opp.value = parseFloat(value) || 0;
    } else {
      (opp as any)[field] = value;
    }
    (window as any).navigateTo(currentView, selectedContactId || undefined);
  }
};

(window as any).updateContactField = (contactId: string, field: string, value: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Contact updates are temporarily unavailable.', 'error'); return; }
  const contact = mockContacts.find(c => c.id === contactId);
  if (contact) {
    if (field === 'phone') {
      const phoneNorm = normalizePhone(value);
      contact.phone = phoneNorm.normalized;
      contact.invalid_phone = phoneNorm.invalid || undefined;
    } else if (field === 'email') {
      contact.email = normalizeEmail(value);
    } else if (field === 'name') {
      contact.name = normalizeName(value);
    } else {
      (contact as any)[field] = value;
    }
    (window as any).navigateTo(currentView, selectedContactId || undefined);
  }
};

(window as any).createQuote = (contactId: string) => {
  (window as any).newQuoteContactId = contactId;

  // Try to find the latest open opportunity for this contact
  const activeOpp = mockOpportunities
    .filter(o => o.contact_id === contactId && o.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  (window as any).newQuoteOpportunityId = activeOpp ? activeOpp.id : '';
  (window as any).newQuoteLineItems = [{ service: '', description: '', quantity: 1, price: 0, tier: 'basic' }];
  (window as any).navigateTo('new-quote');
};

(window as any).markAsPaid = (invoiceId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Invoice persistence is not available yet.', 'error'); return; }
  const invoice = mockInvoices.find(i => i.id === invoiceId);
  if (invoice) {
    invoice.status = 'paid';

    // Update linked opportunity
    const quote = mockQuotes.find(q => q.id === invoice.quote_id);
    if (quote && quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.pipeline_stage = 'Paid';
      }
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
      contact_id: invoice.contact_id,
      type: 'note',
      description: `Invoice ${invoice.id} marked as Paid.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'invoices') renderInvoices();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).convertToInvoice = (quoteId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Invoice persistence is not available yet.', 'error'); return; }
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    // Check for existing invoice
    if (mockInvoices.some(i => i.quote_id === quoteId)) {
      alert("Invoice already exists for this quote.");
      return;
    }

    const invoiceId = 'inv-' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    mockInvoices.push({
      id: invoiceId,
      user_id: getActingUserId(),
      contact_id: quote.contact_id,
      quote_id: quote.id,
      amount: quote.total_amount,
      status: 'unpaid',
      due_date: dueDate.toISOString(),
      created_at: new Date().toISOString()
    });

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Invoice ${invoiceId} created from Quote Q-${quote.id}`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).approveQuote = (quoteId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Quote status updates are temporarily unavailable.', 'error'); return; }
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'approved';
    const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
    if (opportunity) {
      opportunity.status = 'won';
      opportunity.pipeline_stage = 'Scheduled';
      opportunity.value = quote.total_amount; // Update value to reflect actual quote
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} approved! Opportunity marked as Won.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    // Automatically create Invoice if one doesn't exist
    if (!mockInvoices.some(i => i.quote_id === quote.id)) {
      const invoiceId = 'inv-' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      mockInvoices.push({
        id: invoiceId,
        user_id: getActingUserId(),
        contact_id: quote.contact_id,
        quote_id: quote.id,
        amount: quote.total_amount,
        status: 'unpaid',
        due_date: dueDate.toISOString(),
        created_at: new Date().toISOString()
      });

      mockActivities.push({
        id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
        contact_id: quote.contact_id,
        type: 'note',
        description: `Invoice ${invoiceId} automatically created from Quote Q-${quote.id}`,
        due_date: new Date().toISOString(),
        completed: true
      });
    }

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).rejectQuote = (quoteId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Quote status updates are temporarily unavailable.', 'error'); return; }
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'rejected';
    const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
    if (opportunity) {
      opportunity.status = 'lost';
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} was rejected. Opportunity marked as Lost.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).sendQuote = (quoteId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Quote sending is temporarily unavailable.', 'error'); return; }
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'sent';
    console.log(`Sending Quote Q-${quote.id} to client...`);

    // Log Activity
    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      user_id: getActingUserId(),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} sent to customer`,
      due_date: new Date().toISOString(),
      completed: true
    });

    // Update Opportunity stage and value
    if (quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.pipeline_stage = 'Quote Sent';
        opportunity.value = quote.total_amount;
        // Trigger automated follow-up
        runAutomations('OPPORTUNITY_STAGE_UPDATED', opportunity);
      }
    }

    // Refresh view
    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).createInvoice = (contactId: string) => {
  if (editorUsesSupabase()) { (window as any).showToast('Invoice persistence is not available yet.', 'error'); return; }
  const contactQuotes = mockQuotes.filter(q => q.contact_id === contactId);
  if (contactQuotes.length === 0) {
    alert("Please create a Quote first.");
    return;
  }

  // Use the most recent quote by default for simulation
  const latestQuote = contactQuotes[contactQuotes.length - 1];

  const amountStr = prompt("Enter Invoice Amount:", latestQuote.total_amount.toString());
  const amount = parseFloat(amountStr || "0");
  if (isNaN(amount)) return;

  const invoiceId = 'i' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

  mockInvoices.push({
    id: invoiceId,
    user_id: getActingUserId(),
    contact_id: contactId,
    quote_id: latestQuote.id,
    amount: amount,
    status: 'unpaid',
    due_date: dueDate.toISOString(),
    created_at: new Date().toISOString()
  });

  renderContactDetail(contactId);
};

function renderEventLogs() {
  const sortedLogs = [...getEvents()].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const tableRows = sortedLogs.map(log => {
    return `
      <tr>
        <td style="font-weight: 600; color: var(--primary-color);">${log.event_name}</td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
        <td><span class="badge badge-${log.status === 'processed' ? 'approved' : 'draft'}">${log.status}</span></td>
        <td>
          <div style="font-size: 0.8rem; color: #666;">
            <strong>Contact:</strong> ${log.payload.contact_id || 'N/A'}<br>
            <strong>Opp:</strong> ${log.payload.opportunity_id || 'N/A'}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderAppWithShell({
    activeView: 'event-logs',
    title: 'System Event Logs',
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0; min-width: 700px;">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Key Payload Info</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">No system events recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
  });
}

function renderQATools() {
  renderAppWithShell({
    activeView: 'qa-tools',
    title: 'QA & Debug Tools',
    contentVariant: 'wide',
    contentHtml: `
      <div class="card" style="padding: 24px; margin-bottom: 24px; background: #fdf2f2; border: 1px solid #fee2e2;">
        <h3 style="margin-top: 0; color: #991b1b;">Multi-User Isolation Simulation</h3>
        <p style="color: #b91c1c; font-size: 0.9rem; margin-bottom: 16px;">Switches the UI context to simulate different logged-in users. Verify that User B cannot see User A's data.</p>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <button class="btn-${(window as any).currentUser === 'user_a' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('user_a')">Simulate User A</button>
          <button class="btn-${(window as any).currentUser === 'user_b' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('user_b')">Simulate User B</button>
          <button class="btn-${(window as any).currentUser === 'system' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('system')">System Context</button>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #7f1d1d; font-weight: 600;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 2s infinite;"></div>
          Active ID: ${(window as any).currentUser}
        </div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0;">Call Workflow Simulations</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">Manually trigger inbound call events to verify automated follow-ups and timeline logging.</p>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          ${!pendingSimulationCallId ? `
            <button class="btn-primary" onclick="window.startSimulationCall()" style="background: #10b981; border: none;">📞 Simulate Inbound Call</button>
          ` : `
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; width: 100%; display: flex; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0; flex-wrap: wrap; gap: 12px;">
              <div>
                <span style="display: block; font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 800;">Pending Call ID</span>
                <span style="font-weight: 700; color: #1e293b;">${pendingSimulationCallId}</span>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-primary" 
                        onclick="window.completeSimulationCall(false)" 
                        style="background: #ef4444; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>📵 Mark as Missed</button>
                <button class="btn-primary" 
                        onclick="window.completeSimulationCall(true)" 
                        style="background: #10b981; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>✅ Answered</button>
                <button class="btn-primary" 
                        onclick="window.cancelSimulationCall()" 
                        style="background: #64748b; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>Cancel</button>
              </div>
            </div>
          `}
        </div>
      </div>

      ${lastSimulationResult ? `
      <div class="card" style="margin-top: 24px; padding: 24px; border-left: 4px solid #3b82f6;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; color: #1e293b;">Simulation Result</h3>
          <button onclick="window.clearSimulationResult()" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.8rem; text-decoration: underline;">Clear Results</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Contact</div>
            <div style="font-weight: 700; color: #1e293b;">${lastSimulationResult.contact?.name || 'Unknown'}</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">ID: ${lastSimulationResult.contact?.id || 'N/A'}</div>
            ${lastSimulationResult.contact?.id ? `
              <button onclick="window.navigateTo('contact-detail', '${lastSimulationResult.contact.id}')" style="margin-top: 10px; font-size: 0.75rem; color: #2563eb; background: none; border: none; padding: 0; cursor: pointer; font-weight: 600;">View Profile →</button>
            ` : ''}
          </div>

          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Opportunity</div>
            <div style="font-weight: 700; color: #1e293b;">${lastSimulationResult.opportunity ? 'Created Successfully' : '<span style="color: #64748b;">Not Created</span>'}</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">Stage: ${lastSimulationResult.opportunity?.pipeline_stage || 'N/A'}</div>
          </div>

          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Automated SMS</div>
            <div style="font-weight: 700; color: ${lastSimulationResult.sms?.status === 'sent' ? '#10b981' : '#f59e0b'};">
              ${lastSimulationResult.sms ? (lastSimulationResult.sms.status === 'sent' ? 'Sent' : 'Failed/Skipped') : 'No SMS Logged'}
            </div>
            <div style="font-size: 0.75rem; color: #475569; margin-top: 6px; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${lastSimulationResult.sms?.content || 'No automated reply triggered.'}
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="card" style="margin-top: 24px; padding: 24px; background: #f8fafc;">
        <h4 style="margin: 0; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Testing Notes</h4>
        <ul style="margin: 10px 0 0 0; font-size: 0.85rem; color: #64748b; line-height: 1.6;">
          <li>Simulating a missed call will trigger the "call_received" then "call_missed" sequence.</li>
          <li>If the phone number matches an existing lead, it will update their timeline.</li>
          <li>If the phone number is new, it will result in a generic event log.</li>
        </ul>
      </div>
    `
  });
}

(window as any).startSimulationCall = async () => {
  const phone = prompt("Enter phone number to simulate inbound call from:", "+15550109999");
  if (!phone) return;
  
  try {
    (window as any).showToast('Initiating mock inbound call...', 2000);
    const inbound = await (window as any).handleInboundCall({ phone });
    pendingSimulationCallId = inbound.callId;
    renderQATools();
    (window as any).showToast('Call active! Mark status below.', 3000);
  } catch (err: any) {
    console.error('Simulation Error:', err);
    alert('Simulation failed: ' + err.message);
  }
};

(window as any).completeSimulationCall = async (answered: boolean) => {
  if (!pendingSimulationCallId || isProcessingSimulation) return;
  
  try {
    isProcessingSimulation = true;
    renderQATools(); // Show disabled states

    const callId = pendingSimulationCallId;
    (window as any).showToast(answered ? 'Marking as Answered...' : 'Marking as Missed...', 2000);
    
    // Call endCall API (already has status guards: answered/missed)
    const result = await (window as any).endCall({ call_id: callId, answered });
    
    if (result.status === 'ignored') {
      console.warn(`[SIMULATION] ${result.message}`);
      (window as any).showToast('Call was already processed.', 3000);
    } else {
      // In a real system, we'd fetch the updated contact/timeline to show results
      // Transitioning away from direct mock peaking for security. 
      lastSimulationResult = { 
          status: 'success', 
          call_id: callId, 
          type: answered ? 'answered' : 'missed',
          message: 'Backend workflow triggered successfully.'
      };
    }

    pendingSimulationCallId = null;
    isProcessingSimulation = false;
    renderQATools();
    (window as any).showToast(`Call status updated to ${answered ? 'answered' : 'missed'}!`, 3000);
  } catch (err: any) {
    isProcessingSimulation = false;
    renderQATools();
    console.error('Simulation Error:', err);
    alert('Failed to update call: ' + err.message);
  }
};

(window as any).clearSimulationResult = () => {
  lastSimulationResult = null;
  renderQATools();
};

(window as any).cancelSimulationCall = () => {
  pendingSimulationCallId = null;
  renderQATools();
};

checkOverdueInvoices();

// 🌿 WB.6.4 INTEGRATED ROUTING RESOLVER (Step 2 & 3)
async function bootRouter() {
  publicSiteRenderSequence += 1;
  publicSiteAbortController?.abort();
  publicSiteAbortController = null;
  const host = window.location.hostname;
  const rawPath = window.location.pathname;
  const hostRoute = resolveApplicationHostRoute({ hostname: host, pathname: rawPath });
  if (hostRoute.kind === 'public-site') {
    await renderConfiguredPublicSite(hostRoute.pathname);
    return;
  }
  const targetPath = resolveWebsitePathFromBrowserPath(rawPath);
  const isPreviewRoute = rawPath === '/preview' || rawPath.startsWith('/preview/');
  // Explicit /site simulation remains public on CRM application hosts.
  if (targetPath && !isPreviewRoute) {
    await renderConfiguredPublicSite(targetPath);
    return;
  }

  const navigationInvocation = protectedAsyncOperationGuard.beginUnbound('application-navigation');
  const authState = await ensureApplicationAuth();
  const navigationOperation = protectedAsyncOperationGuard.bindCurrent(navigationInvocation, getActingUserId());
  if (!navigationOperation) return;
  const decision = resolveApplicationBootstrap({
    pathname: rawPath,
    hash: window.location.hash,
    authState
  });
  if (decision.action === 'unavailable') {
    if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
    renderApplicationUnavailable();
    return;
  }
  if (decision.action === 'login') {
    if (!protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
    const loginHash = buildApplicationLoginHash(decision.returnTo);
    if (window.location.hash !== loginHash) window.history.replaceState({}, '', loginHash);
    renderApplicationLogin(decision.returnTo);
    return;
  }
  if (decision.action !== 'authenticated') return;
  if (authState.status !== 'authenticated') return;

  if (isPreviewRoute && targetPath) {
    if (dashboardUsesSupabase()) {
      try {
        const core = await loadWebsiteDashboardCore({ actingUserId: authState.user.id });
        protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
        const params = new URLSearchParams(window.location.search);
        const resolution = resolveAuthenticatedPreview({
          actingUserId: authState.user.id,
          path: targetPath,
          explicitWebsiteId: params.get('websiteId'),
          explicitPageId: params.get('pageId'),
          ...core
        });
        if (resolution.status !== 'resolved') {
          protectedAsyncOperationGuard.requireCurrent(navigationOperation, getActingUserId());
          render404('Preview target not found.');
          return;
        }
        const { target } = resolution;
        const previewOperation = {
          navigation: navigationOperation,
          userId: authState.user.id,
          websiteId: target.website.id,
          pageId: target.page.id
        };
        const settingsState = await websiteSettingsHydrator.hydrate(authState.user.id, target.website);
        if (settingsState.status === 'error') throw new Error('UNAVAILABLE');
        protectedAsyncOperationGuard.requireCurrent(previewOperation.navigation, getActingUserId());
        applyPrimaryColor(mockWebsiteSettings.primary_color);
        await hydrateAuthenticatedPreviewSections(previewOperation.pageId, previewOperation.userId, previewOperation.navigation);
        protectedAsyncOperationGuard.requireCurrent(previewOperation.navigation, getActingUserId());
        await renderSitePage(target.funnel.id, {
          ...target.website,
          route: target.route,
          route_id: target.route.id,
          path: target.path,
          slug: target.page.slug,
          is_seo_page: target.path !== '/',
          city: target.route.city || '',
          service: target.route.service || '',
          route_type: target.path === '/' ? 'homepage' : 'service',
          funnel_id: target.funnel.id,
          page_id: target.page.id
        }, true, undefined, target.page);
        return;
      } catch (error) {
        if (isSupersededOperationError(error)
          || !protectedAsyncOperationGuard.isCurrent(navigationOperation, getActingUserId())) return;
        renderPublicPublicationUnavailable();
        return;
      }
    }
    const result = await resolveWebsiteRequest(host, targetPath);
    if (result && result.funnel_id) {
       const resolvedRoutePath = normalizePreviewPath(result.route?.path || '/');
       const requestedRoutePath = normalizePreviewPath(targetPath);
       if (resolvedRoutePath !== requestedRoutePath) {
         render404('Preview target not found.');
         return;
       }
       const mergedContext = createResolvedWebsiteRenderContext(result, targetPath);
       await renderSitePage(result.funnel_id, mergedContext, true);
       return;
    }
    render404('Preview target not found.');
    return;
  }

  if (window.location.hash !== decision.hash) {
    window.history.replaceState({}, '', decision.hash);
  }

  // Authenticated CRM hash routes.
  if (decision.hash) {
     const hashContent = decision.hash.replace(/^#\/?/, '');
     if (hashContent) {
       const [routePart, query = ''] = hashContent.split('?');
       const parts = routePart.split('/');
       const routeContext = parts[0] === 'builder' && query
         ? { builderContext: getBuilderContextFromHash() }
         : parts[0] === 'website-settings'
           ? { websiteSettingsRoute: parseWebsiteSettingsRoute(decision.hash) }
           : isExplicitWebsiteManagementView(parts[0])
             ? { websiteManagementRoute: parseWebsiteManagementRoute(decision.hash, parts[0]) }
           : undefined;
       await (window as any).navigateTo(parts[0], parts[1], routeContext);
       return;
     }
  }
  (window as any).navigateTo('dashboard');
}

bootRouter();

window.addEventListener('popstate', () => {
    bootRouter();
});

window.addEventListener('hashchange', () => {
    bootRouter();
});

// Auto-refresh Sidebar Counts & New Lead Alerts (PROMPT 8, 9, 10)
setInterval(() => {
  let changeDetected = false;

  // 🌿 1. Detect New Leads (Global Alert - WB.5.4)
  if (mockContacts.length > lastContactCount) {
    const newLeads = mockContacts.slice(lastContactCount);

    // Detailed toast for the most recent lead
    if (newLeads.length === 1) {
      const lead = newLeads[0];
      (window as any).showToast(`New lead: ${lead.name} (${lead.phone})`, 'info');
    } else {
      (window as any).showToast(`${newLeads.length} new leads received`, 'info');
    }

    lastContactCount = mockContacts.length;
    changeDetected = true;
  }

  // 2. Refresh UI (only in standard app views)
  if (!['builder', 'preview', 'site'].includes(currentView) && changeDetected) {
    if (currentView === 'clients') void renderClients();
    if (currentView === 'dashboard') renderDashboard();
  }
}, 5000);

// ── WB.6.1 Onboarding Modal & Flow ──────────────────────────────────
let onboardingState = { 
    businessName: '', 
    phone: '', 
    city: '', 
    services: [] as string[] 
};
let websiteGenerationInFlight = false;
let lastGeneratedWebsiteData: WebsiteGenerationData | null = null;

function reconcileGeneratedWebsite(data: WebsiteGenerationData, userId: string): void {
    lastGeneratedWebsiteData = data;
    replaceOwnedDashboardRows(mockWebsites, [data.website], userId);
    replaceOwnedDashboardRows(mockFunnels, [data.funnel], userId);
    replaceOwnedDashboardRows(mockPages, [data.page], userId);
    for (let index = mockWebsiteRoutes.length - 1; index >= 0; index -= 1) {
        if (mockWebsiteRoutes[index].website_id === data.website.id) mockWebsiteRoutes.splice(index, 1);
    }
    mockWebsiteRoutes.push({ ...data.route });
    for (let index = mockPageSections.length - 1; index >= 0; index -= 1) {
        if (mockPageSections[index].page_id === data.page.id) mockPageSections.splice(index, 1);
    }
    mockPageSections.push(...data.sections.map(section => ({ ...section })));
    Object.assign(mockWebsiteSettings, data.settings);
    activeDashboardWebsiteId = data.website.id;
}

function setOnboardingError(message: string): void {
    const region = document.getElementById('onboarding-error');
    if (region) {
        region.textContent = message;
        region.hidden = !message;
    }
}

function websiteGenerationClient(): WebsiteGenerationClient {
    return new WebsiteGenerationClient({
        auth: {
            getAccessToken: async () => {
                if (browserFixturesEnabled && editorUsesLocalData()) return 'local-browser-fixture-token';
                const client = await getBuilderPublicationSupabaseClient();
                if (!client) return null;
                const session = await client.auth.getSession();
                return session.data.session?.access_token ?? null;
            }
        }
    });
}

(window as any).showOnboardingModal = () => {
    const existingModal = document.getElementById('website-onboarding-modal');
    if (existingModal) {
        (existingModal.querySelector('#ob-business-name') as HTMLInputElement | null)?.focus();
        return;
    }
    // Reset state
    onboardingState = { 
        businessName: '', 
        phone: '', 
        city: '', 
        services: [] 
    };
    
    // Check if session has captured data
    const saved = window.sessionStorage.getItem('onboarding_capture');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            onboardingState = { ...onboardingState, ...parsed };
        } catch {}
    }
    
    const modal = document.createElement('div');
    modal.id = 'website-onboarding-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'onboarding-title');
    modal.innerHTML = `
        <div id="onboarding-backdrop"></div>
        <div class="onboarding-card">
            <h1 class="onboarding-title" id="onboarding-title">Let's build your site</h1>
            <p class="onboarding-subtitle">Tell us about your business to generate your premium website.</p>
            
            <div id="onboarding-form-container">
                <div class="onboarding-form-group">
                    <label for="ob-business-name">Business Name</label>
                    <input type="text" id="ob-business-name" class="onboarding-input" maxlength="120" placeholder="e.g. PressurePro Cleaning" value="${escapeBuilderInspectorHtml(onboardingState.businessName)}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label for="ob-city">Service City</label>
                    <input type="text" id="ob-city" class="onboarding-input" maxlength="120" placeholder="e.g. Austin, TX" value="${escapeBuilderInspectorHtml(onboardingState.city)}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label for="ob-phone">Phone Number</label>
                    <input type="tel" id="ob-phone" class="onboarding-input" maxlength="40" placeholder="e.g. (555) 000-0000" value="${escapeBuilderInspectorHtml(onboardingState.phone)}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label>Services Offered (Multi-select)</label>
                    <div class="services-grid">
                        ${['Driveway Cleaning', 'House Washing', 'Patio Cleaning', 'Other'].map(service => `<button type="button" class="service-chip ${onboardingState.services.includes(service) ? 'selected' : ''}" aria-pressed="${onboardingState.services.includes(service)}" onclick="window.toggleOnboardingService(this, '${service}')">${service}</button>`).join('')}
                    </div>
                </div>
                <div id="onboarding-error" class="onboarding-error" role="alert" aria-live="assertive" hidden></div>
                <div class="onboarding-footer">
                    <button type="button" id="onboarding-submit" class="btn-primary btn-onboarding" onclick="window.submitWebsiteOnboarding()">
                        <span id="onboarding-submit-label">Generate My Website</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                    </button>
                    <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">By continuing, you agree to our terms of service.</p>
                </div>
            </div>
            
            <div id="onboarding-success" style="display: none; text-align: center; padding: 40px 0;">
                <div style="font-size: 4rem; margin-bottom: 12px;">🚀</div>
                <h2 class="onboarding-title" style="margin-bottom: 8px;">Your website is live!</h2>
                <p class="onboarding-subtitle" style="margin-bottom: 32px;">We've generated your full funnel structure and local SEO pages. You're ready to start receiving leads.</p>
                
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 24px;">
                    <button class="btn-primary" style="width: 100%; padding: 18px; font-weight: 600;" onclick="window.openGeneratedHomepage()">
                        Edit Homepage
                    </button>
                    <button class="btn-secondary" style="width: 100%; padding: 18px; border: 1px solid #e2e8f0; background: white; font-weight: 600;" onclick="window.showWebsiteDashboard()">
                        Manage Website
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Accessibility: focus the first field
    setTimeout(() => document.getElementById('ob-business-name')?.focus(), 100);
};

(window as any).showWebsiteDashboard = () => {
    document.getElementById('website-onboarding-modal')?.remove();
    (window as any).navigateTo('website-dashboard');
};

(window as any).openGeneratedHomepage = () => {
    if (!lastGeneratedWebsiteData) return;
    document.getElementById('website-onboarding-modal')?.remove();
    void (window as any).navigateTo('builder', undefined, {
        builderContext: {
            websiteId: lastGeneratedWebsiteData.website.id,
            pageId: lastGeneratedWebsiteData.page.id,
            action: 'edit'
        }
    });
};

(window as any).toggleOnboardingService = (el: HTMLElement, service: string) => {
    if (websiteGenerationInFlight) return;
    const index = onboardingState.services.indexOf(service);
    if (index > -1) {
        onboardingState.services.splice(index, 1);
        el.classList.remove('selected');
    } else {
        onboardingState.services.push(service);
        el.classList.add('selected');
    }
    el.setAttribute('aria-pressed', String(el.classList.contains('selected')));
    // Update temp storage as we change chips
    window.sessionStorage.setItem('onboarding_capture', JSON.stringify(onboardingState));
};

(window as any).submitWebsiteOnboarding = async () => {
    if (websiteGenerationInFlight) return;
    const name = (document.getElementById('ob-business-name') as HTMLInputElement).value;
    const city = (document.getElementById('ob-city') as HTMLInputElement).value;
    const phone = (document.getElementById('ob-phone') as HTMLInputElement).value;
    
    onboardingState.businessName = name;
    onboardingState.city = city;
    onboardingState.phone = phone;
    
    window.sessionStorage.setItem('onboarding_capture', JSON.stringify(onboardingState));
    const validation = validateWebsiteGenerationInput({
        business_name: onboardingState.businessName,
        phone_number: onboardingState.phone,
        city: onboardingState.city,
        services: onboardingState.services
    });
    if (!validation.success) {
        setOnboardingError(Object.values(validation.fields)[0] ?? 'Check the form and try again.');
        return;
    }
    const button = document.getElementById('onboarding-submit') as HTMLButtonElement | null;
    const label = document.getElementById('onboarding-submit-label');
    websiteGenerationInFlight = true;
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-busy', 'true');
    }
    if (label) label.textContent = 'Creating your website…';
    setOnboardingError('');
    let idempotencyKey = window.sessionStorage.getItem('website_generation_idempotency_key');
    if (!idempotencyKey) {
        idempotencyKey = createWebsiteGenerationIdempotencyKey();
        window.sessionStorage.setItem('website_generation_idempotency_key', idempotencyKey);
    }
    const usesProductionAuthority = editorUsesSupabase();
    const generationAuthority: WebsiteGenerationAuthorityToken | null = usesProductionAuthority
        ? websiteGenerationAuthority.begin(getActingUserId(), idempotencyKey)
        : null;
    if (usesProductionAuthority && !generationAuthority) {
        websiteGenerationInFlight = false;
        if (button) {
            button.disabled = false;
            button.setAttribute('aria-disabled', 'false');
            button.removeAttribute('aria-busy');
        }
        if (label) label.textContent = 'Generate My Website';
        setOnboardingError('Website creation is unavailable. Refresh and try again.');
        return;
    }
    try {
        const data = await websiteGenerationClient().generate(validation.data, idempotencyKey);
        if (generationAuthority) {
            const committed = websiteGenerationAuthority.commitGraph(
                generationAuthority,
                getActingUserId(),
                data,
                () => reconcileGeneratedWebsite(data, generationAuthority.userId)
            );
            if (committed === 'stale') return;
            if (committed === 'invalid') throw new Error('INVALID_GENERATED_WEBSITE_GRAPH');
            if (!websiteGenerationAuthority.isViewCurrent(generationAuthority, getActingUserId())) return;
        } else {
            reconcileGeneratedWebsite(data, getActingUserId());
        }
        if (browserFixturesEnabled) {
            window.localStorage.setItem('browser_fixture_generated_website', JSON.stringify({ success: true, data }));
        }
        window.localStorage.setItem('onboarding_seen', 'true');
        window.sessionStorage.removeItem('website_generation_idempotency_key');
        window.sessionStorage.removeItem('onboarding_capture');
        const form = document.getElementById('onboarding-form-container');
        const success = document.getElementById('onboarding-success');
        if (form && success) {
            form.style.display = 'none';
            success.style.display = 'block';
            
            (window as any).updateGlobalSettings('businessName', name);
            (window as any).updateGlobalSettings('phone', phone);
        }
    } catch (error) {
        if (generationAuthority
            && !websiteGenerationAuthority.isViewCurrent(generationAuthority, getActingUserId())) return;
        const message = error instanceof WebsiteGenerationClientError
            ? error.message
            : 'Website creation failed. Try again.';
        setOnboardingError(`${message} Reference: ${idempotencyKey.slice(-8)}.`);
    } finally {
        if (generationAuthority
            && !websiteGenerationAuthority.isOperationCurrent(generationAuthority, getActingUserId())) return;
        websiteGenerationInFlight = false;
        if (generationAuthority
            && !websiteGenerationAuthority.isViewCurrent(generationAuthority, getActingUserId())) return;
        if (button) {
            button.disabled = false;
            button.setAttribute('aria-disabled', 'false');
            button.removeAttribute('aria-busy');
        }
        if (label) label.textContent = 'Generate My Website';
    }
};

(window as any).closeOnboarding = () => {
    document.getElementById('website-onboarding-modal')?.remove();
    // Redirect to website structure as a way to show "site is ready"
    window.navigateTo('website-structure');
};

// ── WB.6.4 Funnel Dashboard Checklist ────────────────────────────────
(window as any).renderFunnelsChecklist = () => {
  if (window.localStorage.getItem('funnels_checklist_dismissed')) return '';
  
  const state = JSON.parse(window.localStorage.getItem('funnels_checklist_state') || '{"copy":false,"share":false,"test":false}');
  
  return `
    <div id="funnels-checklist" class="card" style="background: #fffbeb; border: 1px solid #fde68a; padding: 20px; margin-bottom: 24px; position: relative;">
      <button onclick="window.dismissFunnelChecklist()" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #92400e; cursor: pointer; font-size: 1.2rem;">&times;</button>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 1.25rem;">📝</span>
        <h3 style="margin: 0; font-size: 1rem; color: #92400e;">Get Your First Lead Checklist</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-copy" ${state.copy ? 'checked' : ''} onchange="window.toggleCheckItem('copy')">
          <label for="check-copy" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Copy your page link</label>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-share" ${state.share ? 'checked' : ''} onchange="window.toggleCheckItem('share')">
          <label for="check-share" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Share it (FB / WhatsApp)</label>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-test" ${state.test ? 'checked' : ''} onchange="window.toggleCheckItem('test')">
          <label for="check-test" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Test the form yourself</label>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #fef3c7; display: flex; gap: 12px;">
         <a href="https://www.facebook.com/sharer/sharer.php?u=https://app.pressurepro.io" target="_blank" style="font-size: 0.8rem; color: #b45309; text-decoration: none; border: 1px solid #fcd34d; padding: 4px 10px; border-radius: 4px; background: white;">Share on Facebook</a>
         <a href="https://api.whatsapp.com/send?text=Check out my new business page: https://app.pressurepro.io" target="_blank" style="font-size: 0.8rem; color: #b45309; text-decoration: none; border: 1px solid #fcd34d; padding: 4px 10px; border-radius: 4px; background: white;">WhatsApp</a>
      </div>
    </div>
  `;
};

(window as any).toggleCheckItem = (item: string) => {
  const state = JSON.parse(window.localStorage.getItem('funnels_checklist_state') || '{"copy":false,"share":false,"test":false}');
  state[item] = !state[item];
  window.localStorage.setItem('funnels_checklist_state', JSON.stringify(state));
};

(window as any).dismissFunnelChecklist = () => {
  window.localStorage.setItem('funnels_checklist_dismissed', 'true');
  document.getElementById('funnels-checklist')?.remove();
};
// ── WB.4.1 Scroll Handler for Sticky CTA Bar ──
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const bar = document.getElementById('site-cta-bar');
  if (!bar) return;

  const st = window.pageYOffset || document.documentElement.scrollTop;
  if (st > lastScrollTop && st > 100) {
    // Scrolling down -> hide
    bar.classList.add('cta-bar-offscreen');
  } else {
    // Scrolling up -> show
    bar.classList.remove('cta-bar-offscreen');
  }
  lastScrollTop = st <= 0 ? 0 : st;
}, false);

// ── WB.6.5 Social Sharing Helpers ────────────────────────────────────
(window as any).copyFunnelUrl = () => {
  const url = document.getElementById('funnel-public-url')?.textContent;
  if (url) {
    (window as any).copyToClipboard(url);
    // Auto-check the checklist
    (window as any).toggleCheckItem('copy');
  }
};

(window as any).shareToSocial = async (funnelId: string, platform: string) => {
  const url = `https://${(window as any).userSlug || 'app'}.pressurepro.io/${funnelId}`;
  const city = (window as any).userCity || 'your area';
  const text = `Now offering professional driveway cleaning in ${city}. Get a free quote here: ${url}`;

  if (platform === 'native' && navigator.share) {
    try {
      await navigator.share({ title: 'Professional Cleaning Quote', text, url });
      (window as any).toggleCheckItem('share');
      return;
    } catch (e) { console.warn('Native share failed', e); }
  }

  let shareUrl = '';
  if (platform === 'facebook') {
    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
  } else if (platform === 'whatsapp') {
    shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  } else {
    // Fallback to native or copy
    return (window as any).copyFunnelUrl();
  }

  window.open(shareUrl, '_blank');
  (window as any).toggleCheckItem('share');
};

(window as any).testFunnel = (funnelId: string) => {
  // In a real app, this would be the live URL with a test flag
  // In our prototype, we show the "Public" page view with a ?test=true hint
  const url = `https://${(window as any).userSlug || 'app'}.pressurepro.io/${funnelId}?test=true`;
  console.log('[TEST MODE] Opening funnel:', url);
  window.localStorage.setItem('test_mode_active', 'true');
  
  // For the prototype, we navigate to the first page of the funnel
  fetch(`/api/funnels/${funnelId}`).then(r => r.json()).then(res => {
     if (res.success && res.data.steps.length > 0) {
       const landingPage = res.data.steps[0];
       window.open(`/?page=${landingPage.slug}&test=true`, '_blank');
     }
  });

  (window as any).toggleCheckItem('test');
};

let seoWizardState = {
    mode: 'list' as 'list' | 'wizard',
    step: 1,
    services: [] as string[],
    cities: [] as string[]
};

(window as any).renderSeoPages = async () => {
    const userId = getActingUserId();
    const website = mockWebsites.find(site => site.user_id === userId && site.id === activeDashboardWebsiteId);
    if (!website) {
        renderWebsiteRepositoryUnavailable('seo-pages');
        return;
    }
    const seoPages = mockWebsiteRoutes.filter(r => r.website_id === website.id && r.is_seo_page);
    
    // Auto-switch to wizard if empty
    if (seoPages.length === 0 && seoWizardState.mode !== 'wizard') {
        seoWizardState.mode = 'wizard';
        seoWizardState.step = 1;
    }

    if (seoWizardState.mode === 'wizard') {
        renderSeoWizard();
        return;
    }

    renderAppWithShell({
        activeView: 'seo-pages',
        title: 'Local SEO Hub',
        subtitle: 'Target specific neighborhoods and service types to dominate local search results.',
        headerActionsHtml: `
            <div style="display: flex; gap: 12px;">
                <button class="btn-primary" onclick="window.startSeoWizard()" style="background: #10b981; border: none; padding: 10px 20px;">+ Batch Generate Pages</button>
            </div>
        `,
        contentVariant: 'wide',
        contentHtml: `
            ${renderWebsiteManagementSwitcher('seo-pages')}

            <div class="card" style="margin-bottom: 30px; padding: 24px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 16px;">
                <div style="display: flex; gap: 24px; align-items: center;">
                    <div style="font-size: 3rem; background: white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">📈</div>
                    <div>
                        <h4 style="margin: 0; color: #0369a1; font-size: 1.25rem;">Organic Search Strategy</h4>
                        <p style="margin: 6px 0 0 0; color: #0c4a6e; font-size: 1rem; line-height: 1.5;">
                            Generated pages target <strong>Service + City</strong> combinations to capture high-intent local traffic.
                        </p>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow-x: auto; border-radius: 16px;">
                <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0; min-width: 700px;">
                    <thead style="background: #f8fafc;">
                        <tr>
                            <th style="padding: 16px 24px;">Service & Region</th>
                            <th>Calculated URL Slug</th>
                            <th>Live Status</th>
                            <th style="text-align: right; padding: 16px 24px;">Management</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${seoPages.map(page => `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 16px 24px;">
                                    <div style="font-weight: 700; color: #1e293b; font-size: 1rem;">${page.service}</div>
                                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">${page.city}</div>
                                </td>
                                <td>
                                    <code style="background: #f1f5f9; padding: 6px 10px; border-radius: 8px; font-size: 0.9rem; color: #475569; border: 1px solid #e2e8f0;">/${page.slug}</code>
                                </td>
                                <td>
                                    <span class="badge" style="background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; padding: 4px 10px; font-size: 0.75rem; font-weight: 700;">ACTIVE</span>
                                </td>
                                <td style="text-align: right; padding: 16px 24px;">
                                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                        <button class="btn-primary" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 8px 16px; font-size: 0.85rem; font-weight: 600;" onclick="window.open('/${page.slug}', '_blank')">View Live</button>
                                        <button class="btn-primary" style="background: #fff5f5; color: #ef4444; border: 1px solid #fee2e2; padding: 8px 12px;" onclick="window.deleteSeoPage('${page.id}')">
                                            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 80px; color: #94a3b8;">No SEO pages found. Use the Batched Generator to get started.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `
    });
};

(window as any).startSeoWizard = () => {
    seoWizardState.mode = 'wizard';
    seoWizardState.step = 1;
    (window as any).renderSeoPages();
};

function renderSeoWizard() {
    let content = '';
    const progress = (seoWizardState.step / 3) * 100;

    if (seoWizardState.step === 1) {
        content = `
            <div style="max-width: 600px; margin: 40px auto;">
                <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Step 1: What services do you offer?</h3>
                <p style="color: #64748b; margin-bottom: 24px;">Enter the services you want to rank for locally. Use commas to separate them.</p>
                <textarea id="wizard-services" placeholder="e.g. Driveway Cleaning, Roof Cleaning, House Washing" style="width: 100%; height: 120px; padding: 15px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'">${seoWizardState.services.join(', ')}</textarea>
                <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
                    <button class="btn-primary" style="padding: 12px 32px; border-radius: 12px; font-weight: 800;" onclick="window.nextSeoStep(2)">Next: Location Selection →</button>
                </div>
            </div>
        `;
    } else if (seoWizardState.step === 2) {
        content = `
            <div style="max-width: 600px; margin: 40px auto;">
                <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Step 2: Where do you offer them?</h3>
                <p style="color: #64748b; margin-bottom: 24px;">Enter the cities or neighborhoods you target. Use commas to separate them.</p>
                <textarea id="wizard-cities" placeholder="e.g. Seattle, Bellevue, Kirkland, Redmond" style="width: 100%; height: 120px; padding: 15px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'">${seoWizardState.cities.join(', ')}</textarea>
                <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 12px; font-weight: 700;" onclick="window.nextSeoStep(1)">← Back</button>
                    <button class="btn-primary" style="padding: 12px 32px; border-radius: 12px; font-weight: 800;" onclick="window.nextSeoStep(3)">Next: Preview Generation →</button>
                </div>
            </div>
        `;
    } else if (seoWizardState.step === 3) {
        const previews: string[] = [];
        seoWizardState.services.forEach(s => {
            seoWizardState.cities.forEach(c => {
                const slug = (s + '-' + c).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                previews.push(`/${slug}`);
            });
        });

        content = `
            <div style="max-width: 800px; margin: 40px auto;">
                <header style="text-align: center; margin-bottom: 40px;">
                    <h3 style="font-size: 1.75rem; margin-bottom: 12px;">Step 3: Preview Local Strategy</h3>
                    <p style="color: #64748b; font-size: 1.1rem;">We are about to generate <strong>${previews.length}</strong> targeted landing pages.</p>
                </header>

                <div class="card" style="background: #f8fafc; border: 2px dashed #e2e8f0; padding: 30px; margin-bottom: 40px;">
                    <h4 style="margin-top: 0; color: #475569; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; margin-bottom: 15px;">URL Structure Previews</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${previews.slice(0, 10).map(p => `<div style="color: var(--primary-color); font-weight: 600; font-family: monospace;">${p}</div>`).join('')}
                        ${previews.length > 10 ? `<div style="color: #94a3b8; font-style: italic;">...and ${previews.length - 10} more pages</div>` : ''}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 15px; background: #fffbeb; border: 1px solid #fde68a; padding: 20px; border-radius: 12px; margin-bottom: 40px;">
                   <div style="display: flex; gap: 12px; align-items: flex-start;">
                      <span style="font-size: 1.25rem;">💡</span>
                      <p style="margin: 0; color: #92400e; font-size: 0.95rem;"><strong>Pro Tip:</strong> These pages will automatically be added to your Sitemap and linked within your website to boost search ranking.</p>
                   </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 12px; font-weight: 700;" onclick="window.nextSeoStep(2)">← Change Inputs</button>
                    <button class="btn-primary" style="padding: 15px 40px; border-radius: 12px; font-weight: 800; font-size: 1.1rem; background: #10b981; border: none; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);" onclick="window.finalizeSeoGen()">🚀 Generate & Go Live</button>
                </div>
            </div>
        `;
    }

    renderAppWithShell({
        activeView: 'seo-pages',
        title: 'Build Your Local Presence',
        subtitle: `Step ${seoWizardState.step} of 3`,
        headerActionsHtml: `
            <div style="width: 200px; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; position: relative;">
                <div style="width: ${progress}%; height: 100%; background: var(--primary-color); transition: width 0.4s ease-out;"></div>
            </div>
        `,
        contentVariant: 'wide',
        contentHtml: `
            ${renderWebsiteManagementSwitcher('seo-pages')}
            ${content}
        `
    });
}

(window as any).nextSeoStep = (step: number) => {
    if (seoWizardState.step === 1 && step === 2) {
        const text = (document.getElementById('wizard-services') as HTMLTextAreaElement).value;
        seoWizardState.services = text.split(',').map(s => s.trim()).filter(s => s);
        if (seoWizardState.services.length === 0) { alert('Please enter at least one service.'); return; }
    } else if (seoWizardState.step === 2 && step === 3) {
        const text = (document.getElementById('wizard-cities') as HTMLTextAreaElement).value;
        seoWizardState.cities = text.split(',').map(c => c.trim()).filter(c => c);
        if (seoWizardState.cities.length === 0) { alert('Please enter at least one city.'); return; }
    }
    
    seoWizardState.step = step;
    (window as any).renderSeoPages();
};

(window as any).finalizeSeoGen = async () => {
    (window as any).showToast(`Broadcasting Local Authority...`, 'info');
    
    try {
        const res = await fetch('/api/websites/bulk-seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ services: seoWizardState.services, cities: seoWizardState.cities })
        }).then(r => r.json());
        
        if (res.success) {
            (window as any).showToast(`Mission Accomplished: ${res.count} SEO pages are now live!`, 'success');
            seoWizardState.mode = 'list';
            seoWizardState.services = [];
            seoWizardState.cities = [];
            (window as any).renderSeoPages();
        } else {
            alert('Generation error: ' + res.error);
        }
    } catch (err: any) {
        alert('Exception: ' + err.message);
    }
};

function renderPagesSeoLanding() {
  renderAppWithShell({
    activeView: 'pages-seo',
    title: 'Pages & SEO',
    subtitle: 'Organize your site architecture, menus, and search engine optimization.',
    contentVariant: 'wide',
    contentHtml: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 10px;">
        <!-- Card 1: Site Pages -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.openWebsiteManagementView('funnels')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #eff6ff; color: #3b82f6; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">📄</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Site Pages</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Manage your main website pages and landing pages.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Pages ➔
          </div>
        </div>

        <!-- Card 2: Local Service Pages -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.openWebsiteManagementView('seo-pages')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #f0fdf4; color: #22c55e; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🔍</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Local Service Pages</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Create specialized pages to help your business rank higher on Google in the cities and services you cover.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Local Service Pages ➔
          </div>
        </div>

        <!-- Card 3: Site Structure -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.openWebsiteManagementView('website-structure')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #faf5ff; color: #a855f7; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🌐</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Site Structure</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Review how your website pages and routes are organized.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Structure ➔
          </div>
        </div>

        <!-- Card 4: Navigation -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.openWebsiteManagementView('website-navigation')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #fff7ed; color: #f97316; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🗺️</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Navigation</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Manage website menus and visitor navigation.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Navigation ➔
          </div>
        </div>
      </div>
    `
  });
}

(window as any).deleteSeoPage = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this SEO page? It will be removed from your public website instantly.')) return;
    
    try {
        const res = await fetch(`/api/websites/routes/${routeId}`, { method: 'DELETE' }).then(r => r.json());
        if (res.success) {
            (window as any).showToast('SEO page removed successfully.');
            (window as any).renderSeoPages();
        } else {
            alert('Removal failed: ' + res.error);
        }
    } catch (err: any) {
        alert('Error: ' + err.message);
    }
};

