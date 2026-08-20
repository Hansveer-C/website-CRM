import {
  NavigationMenuScope,
  NavigationTargetKind,
  ResolvedNavigationItem,
  SiteNavigationItem,
  validateExternalUrl,
  validateNavigationLabel,
  validatePhoneTarget,
  validateEmailTarget,
  validateAndNormalizeNavigationItems,
  resolveEffectiveNavigation
} from './builder_site_navigation_domain';
import type { EffectiveRoute } from './builder_route_lifecycle';
import type { Funnel, Page, Website, WebsiteLayout } from './types';
import { escapeHtmlText } from './crm_html_output';
import { BuilderSiteNavigationController, SiteNavigationUiState } from './builder_site_navigation_controller';
import { BuilderSiteNavigationPublishController, NavigationPublishState } from './builder_site_navigation_publish_controller';

export interface LegacyNavigationAdoptionCandidate {
  id: string;
  label: string;
  originalTarget: string;
  visible: boolean;
  sourceType: 'header_item' | 'footer_item';
  proposedItem: SiteNavigationItem | null;
  status: 'ready' | 'needs_attention';
  reason?: string;
}

export interface LegacyAdoptionReviewState {
  isOpen: boolean;
  scope: NavigationMenuScope;
  candidates: LegacyNavigationAdoptionCandidate[];
  standaloneCta: {
    text: string;
    link: string;
  } | null;
  isSubmitting: boolean;
  errorMessage: string | null;
}

export interface NavigationItemModalState {
  isOpen: boolean;
  mode: 'add' | 'edit' | 'resolve_legacy';
  itemId: string;
  candidateId?: string | null;
  label: string;
  targetKind: NavigationTargetKind;
  targetValue: string;
  visible: boolean;
  isCta: boolean;
  isSaving: boolean;
  errorMessage: string | null;
}

export interface NavigationPublishDiffSummary {
  totalCount: number;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  reorderedCount: number;
  visibilityChangedCount: number;
  ctaChangedCount: number;
  isExplicitEmpty: boolean;
  isFirstAdoptionFromLegacy: boolean;
  changeDescriptions: string[];
}

export interface NavigationPublishModalState {
  isOpen: boolean;
  menuScope: NavigationMenuScope;
  summary: NavigationPublishDiffSummary | null;
  isPublishing: boolean;
  errorMessage: string | null;
}

export interface NavigationPublicationReadiness {
  ready: boolean;
  blockingReason?: 'unrouted' | 'draft_route' | 'pending_deletion' | 'invalid_target';
  message?: string;
  blockingItems: Array<{ id: string; label: string; reason: string }>;
}

export interface NavigationUiContext {
  website: Website;
  pages: readonly Page[];
  funnels: readonly Funnel[];
  effectiveRoutes: readonly EffectiveRoute[];
  layout?: WebsiteLayout | null;
  actingUserId: string;
}

export function generateNavigationUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Genuinely loss-aware legacy candidate evaluation.
 * Never fabricates replacement destinations.
 * Strict homepage rule: only exact root "/" is automatically homepage.
 * Standalone legacy header CTA is kept separate and not cloned into nav items.
 */
export function evaluateLegacyNavigationCandidates(
  scope: NavigationMenuScope,
  layout: WebsiteLayout | null | undefined,
  context: {
    effectiveRoutes: readonly EffectiveRoute[];
    funnels: readonly Funnel[];
    pages: readonly Page[];
  },
  uuidFactory: () => string = generateNavigationUuid
): {
  candidates: LegacyNavigationAdoptionCandidate[];
  standaloneCta: { text: string; link: string } | null;
  hasAttentionItems: boolean;
  attentionCount: number;
} {
  const candidates: LegacyNavigationAdoptionCandidate[] = [];
  let hasAttentionItems = false;
  let attentionCount = 0;
  let standaloneCta: { text: string; link: string } | null = null;

  if (scope === 'primary') {
    const headerConfig = layout?.header_config as any;
    const rawNavItems = Array.isArray(headerConfig?.nav_items) ? headerConfig.nav_items : [];

    rawNavItems.forEach((raw: any, index: number) => {
      const id = uuidFactory();
      const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : `Item ${index + 1}`;
      const path = typeof raw.path === 'string' ? raw.path.trim() : '';
      const visible = raw.visible !== false;

      let proposedItem: SiteNavigationItem | null = null;
      let status: 'ready' | 'needs_attention' = 'needs_attention';
      let reason: string | undefined;

      if (!path) {
        // Missing or empty legacy destination
        status = 'needs_attention';
        reason = 'This legacy navigation item has no destination.';
      } else if (path === '/') {
        // Only exact root is automatically homepage
        proposedItem = {
          id,
          label,
          target_kind: 'homepage',
          target_value: '__homepage__',
          position: candidates.length,
          visible,
          is_cta: false
        };
        status = 'ready';
      } else if (path.startsWith('http://') || path.startsWith('https://')) {
        const extCheck = validateExternalUrl(path);
        if (extCheck.valid && extCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'external',
            target_value: extCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = extCheck.error || 'External URL format is not supported';
        }
      } else if (path.startsWith('tel:')) {
        const phoneCheck = validatePhoneTarget(path.slice(4));
        if (phoneCheck.valid && phoneCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'phone',
            target_value: phoneCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = phoneCheck.error || 'Phone number format is not supported';
        }
      } else if (path.startsWith('mailto:')) {
        const emailCheck = validateEmailTarget(path.slice(7));
        if (emailCheck.valid && emailCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'email',
            target_value: emailCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = emailCheck.error || 'Email address format is not supported';
        }
      } else {
        // Relative path: match against effective routes or page slugs (including /home and home)
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const matchingRoute = context.effectiveRoutes.find(r => r.path === cleanPath || r.live_path === cleanPath);
        if (matchingRoute && matchingRoute.funnel_id) {
          proposedItem = {
            id,
            label,
            target_kind: 'internal',
            target_value: matchingRoute.funnel_id,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          const slug = cleanPath.replace(/^\//, '');
          const matchingPage = context.pages.find(p => p.slug === slug);
          if (matchingPage && matchingPage.funnel_id) {
            proposedItem = {
              id,
              label,
              target_kind: 'internal',
              target_value: matchingPage.funnel_id,
              position: candidates.length,
              visible,
              is_cta: false
            };
            status = 'ready';
          } else {
            status = 'needs_attention';
            reason = `Destination path '${path}' does not match any existing page in this website`;
          }
        }
      }

      if (status === 'needs_attention') {
        hasAttentionItems = true;
        attentionCount++;
      }

      candidates.push({
        id,
        label,
        originalTarget: path,
        visible,
        sourceType: 'header_item',
        proposedItem,
        status,
        reason
      });
    });

    // Check standalone legacy header CTA
    const ctaText = typeof headerConfig?.cta_text === 'string' ? headerConfig.cta_text.trim() : '';
    const ctaLink = typeof headerConfig?.cta_link === 'string' ? headerConfig.cta_link.trim() : '';
    if (ctaText && ctaLink) {
      standaloneCta = { text: ctaText, link: ctaLink };
    }
  } else {
    // Footer scope
    const footerConfig = layout?.footer_config as any;
    const rawLinks = Array.isArray(footerConfig?.links)
      ? footerConfig.links
      : Array.isArray(footerConfig?.nav_items)
        ? footerConfig.nav_items
        : [];

    rawLinks.forEach((raw: any, index: number) => {
      const id = uuidFactory();
      const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : `Link ${index + 1}`;
      const path = typeof raw.path === 'string' ? raw.path.trim() : (typeof raw.url === 'string' ? raw.url.trim() : '');
      const visible = raw.visible !== false;

      let proposedItem: SiteNavigationItem | null = null;
      let status: 'ready' | 'needs_attention' = 'needs_attention';
      let reason: string | undefined;

      if (!path) {
        status = 'needs_attention';
        reason = 'This legacy navigation item has no destination.';
      } else if (path === '/') {
        proposedItem = {
          id,
          label,
          target_kind: 'homepage',
          target_value: '__homepage__',
          position: candidates.length,
          visible,
          is_cta: false
        };
        status = 'ready';
      } else if (path.startsWith('http://') || path.startsWith('https://')) {
        const extCheck = validateExternalUrl(path);
        if (extCheck.valid && extCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'external',
            target_value: extCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = extCheck.error || 'External URL format is not supported';
        }
      } else if (path.startsWith('tel:')) {
        const phoneCheck = validatePhoneTarget(path.slice(4));
        if (phoneCheck.valid && phoneCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'phone',
            target_value: phoneCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = phoneCheck.error || 'Phone number format is not supported';
        }
      } else if (path.startsWith('mailto:')) {
        const emailCheck = validateEmailTarget(path.slice(7));
        if (emailCheck.valid && emailCheck.normalized) {
          proposedItem = {
            id,
            label,
            target_kind: 'email',
            target_value: emailCheck.normalized,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          status = 'needs_attention';
          reason = emailCheck.error || 'Email address format is not supported';
        }
      } else {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const matchingRoute = context.effectiveRoutes.find(r => r.path === cleanPath || r.live_path === cleanPath);
        if (matchingRoute && matchingRoute.funnel_id) {
          proposedItem = {
            id,
            label,
            target_kind: 'internal',
            target_value: matchingRoute.funnel_id,
            position: candidates.length,
            visible,
            is_cta: false
          };
          status = 'ready';
        } else {
          const slug = cleanPath.replace(/^\//, '');
          const matchingPage = context.pages.find(p => p.slug === slug);
          if (matchingPage && matchingPage.funnel_id) {
            proposedItem = {
              id,
              label,
              target_kind: 'internal',
              target_value: matchingPage.funnel_id,
              position: candidates.length,
              visible,
              is_cta: false
            };
            status = 'ready';
          } else {
            status = 'needs_attention';
            reason = `Destination path '${path}' does not match any existing page in this website`;
          }
        }
      }

      if (status === 'needs_attention') {
        hasAttentionItems = true;
        attentionCount++;
      }

      candidates.push({
        id,
        label,
        originalTarget: path,
        visible,
        sourceType: 'footer_item',
        proposedItem,
        status,
        reason
      });
    });
  }

  return {
    candidates,
    standaloneCta,
    hasAttentionItems,
    attentionCount
  };
}

/**
 * Legacy conversion wrapper returning clean converted items (or null proposedItem for attention items).
 */
export function convertLegacyLayoutToCanonicalDraft(
  scope: NavigationMenuScope,
  layout: WebsiteLayout | null | undefined,
  context: {
    effectiveRoutes: readonly EffectiveRoute[];
    funnels: readonly Funnel[];
    pages: readonly Page[];
  },
  uuidFactory: () => string = generateNavigationUuid
): {
  items: SiteNavigationItem[];
  candidates: LegacyNavigationAdoptionCandidate[];
  hasAttentionItems: boolean;
  attentionCount: number;
  standaloneCta: { text: string; link: string } | null;
} {
  const result = evaluateLegacyNavigationCandidates(scope, layout, context, uuidFactory);
  const items = result.candidates
    .map((c, idx) => c.proposedItem ? { ...c.proposedItem, position: idx } : null)
    .filter((item): item is SiteNavigationItem => item !== null);

  return {
    items,
    candidates: result.candidates,
    hasAttentionItems: result.hasAttentionItems,
    attentionCount: result.attentionCount,
    standaloneCta: result.standaloneCta
  };
}

/**
 * Checks publication readiness for a list of navigation items.
 * Verifies that visible internal items do not point to draft-only routes or routes scheduled for deletion.
 */
export function checkNavigationPublicationReadiness(
  items: readonly SiteNavigationItem[],
  context: {
    effectiveRoutes: readonly EffectiveRoute[];
  }
): NavigationPublicationReadiness {
  const blockingItems: Array<{ id: string; label: string; reason: string }> = [];

  for (const item of items) {
    if (!item.visible) continue;

    if (item.target_kind === 'internal') {
      const funnelId = item.target_value;
      const matchingRoute = context.effectiveRoutes.find(r => r.funnel_id === funnelId);

      if (!matchingRoute) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: 'This destination has no assigned public route.'
        });
      } else if (matchingRoute.is_staged_delete) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: `The route '${matchingRoute.path}' is scheduled for removal.`
        });
      } else if (matchingRoute.is_new_draft || (matchingRoute.is_draft_override && matchingRoute.live_path !== matchingRoute.path)) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: `The route '${matchingRoute.path}' exists only as an unpublished draft. Publish the route first.`
        });
      }
    } else if (item.target_kind === 'external') {
      const ext = validateExternalUrl(item.target_value);
      if (!ext.valid) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: ext.error || 'Invalid external URL'
        });
      }
    } else if (item.target_kind === 'phone') {
      const phone = validatePhoneTarget(item.target_value);
      if (!phone.valid) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: phone.error || 'Invalid phone number'
        });
      }
    } else if (item.target_kind === 'email') {
      const email = validateEmailTarget(item.target_value);
      if (!email.valid) {
        blockingItems.push({
          id: item.id,
          label: item.label,
          reason: email.error || 'Invalid email address'
        });
      }
    }
  }

  if (blockingItems.length > 0) {
    const hasDraftRoute = blockingItems.some(i => i.reason.includes('unpublished draft'));
    const hasPendingDelete = blockingItems.some(i => i.reason.includes('scheduled for removal'));
    const blockingReason = hasDraftRoute ? 'draft_route' : hasPendingDelete ? 'pending_deletion' : 'unrouted';
    const message = hasDraftRoute
      ? 'Publish this page URL before publishing navigation.'
      : 'One or more navigation links are not publicly available yet.';

    return {
      ready: false,
      blockingReason,
      message,
      blockingItems
    };
  }

  return {
    ready: true,
    blockingItems: []
  };
}

/**
 * Computes difference summary between live and draft items for publication confirmation.
 * Compares against actual live items if liveRevision > 0; acknowledges first adoption if liveRevision == 0.
 */
export function computeNavigationPublishDiff(
  liveItems: readonly SiteNavigationItem[],
  draftItems: readonly SiteNavigationItem[],
  liveRevision = 0
): NavigationPublishDiffSummary {
  const isFirstAdoptionFromLegacy = liveRevision === 0;

  if (isFirstAdoptionFromLegacy) {
    const isExplicitEmpty = draftItems.length === 0;
    const changeDescriptions = draftItems.map(
      item => `Include "${item.label}" (${item.target_kind === 'homepage' ? '/' : item.target_value})`
    );

    return {
      totalCount: draftItems.length,
      addedCount: draftItems.length,
      removedCount: 0,
      updatedCount: 0,
      reorderedCount: 0,
      visibilityChangedCount: 0,
      ctaChangedCount: 0,
      isExplicitEmpty,
      isFirstAdoptionFromLegacy: true,
      changeDescriptions
    };
  }

  const liveMap = new Map(liveItems.map(i => [i.id, i]));
  const draftMap = new Map(draftItems.map(i => [i.id, i]));

  let addedCount = 0;
  let removedCount = 0;
  let updatedCount = 0;
  let reorderedCount = 0;
  let visibilityChangedCount = 0;
  let ctaChangedCount = 0;
  const changeDescriptions: string[] = [];

  for (const draftItem of draftItems) {
    const liveItem = liveMap.get(draftItem.id);
    if (!liveItem) {
      addedCount++;
      changeDescriptions.push(`Added item "${draftItem.label}"`);
    } else {
      let changed = false;
      if (liveItem.label !== draftItem.label || liveItem.target_kind !== draftItem.target_kind || liveItem.target_value !== draftItem.target_value) {
        updatedCount++;
        changed = true;
        changeDescriptions.push(`Updated target/label for "${draftItem.label}"`);
      }
      if (liveItem.visible !== draftItem.visible) {
        visibilityChangedCount++;
        changed = true;
        changeDescriptions.push(`Changed visibility for "${draftItem.label}" (${draftItem.visible ? 'Visible' : 'Hidden'})`);
      }
      if (liveItem.is_cta !== draftItem.is_cta) {
        ctaChangedCount++;
        changed = true;
        changeDescriptions.push(`Changed CTA status for "${draftItem.label}"`);
      }
      if (liveItem.position !== draftItem.position && !changed) {
        reorderedCount++;
        changeDescriptions.push(`Reordered item "${draftItem.label}"`);
      }
    }
  }

  for (const liveItem of liveItems) {
    if (!draftMap.has(liveItem.id)) {
      removedCount++;
      changeDescriptions.push(`Removed item "${liveItem.label}"`);
    }
  }

  const isExplicitEmpty = draftItems.length === 0;

  return {
    totalCount: draftItems.length,
    addedCount,
    removedCount,
    updatedCount,
    reorderedCount,
    visibilityChangedCount,
    ctaChangedCount,
    isExplicitEmpty,
    isFirstAdoptionFromLegacy: false,
    changeDescriptions
  };
}

export type NavigationScopeAuthority = 'legacy' | 'live' | 'draft' | 'unknown';

/**
 * Determine authority state for a given menu scope.
 */
export function getNavigationScopeAuthority(
  state: SiteNavigationUiState | null | undefined
): NavigationScopeAuthority {
  if (!state || state.status !== 'ready') return 'unknown';
  if (state.isDraft) return 'draft';
  if (state.liveRevision > 0) return 'live';
  return 'legacy';
}

/**
 * Main manager class for Builder Navigation UI state and actions.
 */
export class BuilderNavigationUiManager {
  private activeScope: NavigationMenuScope = 'primary';
  private adoptionReviewState: LegacyAdoptionReviewState = {
    isOpen: false,
    scope: 'primary',
    candidates: [],
    standaloneCta: null,
    isSubmitting: false,
    errorMessage: null
  };
  private itemModalState: NavigationItemModalState = {
    isOpen: false,
    mode: 'add',
    itemId: '',
    candidateId: null,
    label: '',
    targetKind: 'homepage',
    targetValue: '',
    visible: true,
    isCta: false,
    isSaving: false,
    errorMessage: null
  };
  private publishModalState: NavigationPublishModalState = {
    isOpen: false,
    menuScope: 'primary',
    summary: null,
    isPublishing: false,
    errorMessage: null
  };

  private lastFocusedElement: HTMLElement | null = null;
  private listeners: Array<() => void> = [];

  constructor(
    private readonly controller: BuilderSiteNavigationController,
    private readonly publishController: BuilderSiteNavigationPublishController
  ) {}

  public getActiveScope(): NavigationMenuScope {
    return this.activeScope;
  }

  public setActiveScope(scope: NavigationMenuScope) {
    if (this.activeScope !== scope) {
      this.activeScope = scope;
      this.adoptionReviewState.isOpen = false;
      this.notify();
    }
  }

  public getAdoptionReviewState(): LegacyAdoptionReviewState {
    return { ...this.adoptionReviewState };
  }

  public getItemModalState(): NavigationItemModalState {
    return { ...this.itemModalState };
  }

  public getPublishModalState(): NavigationPublishModalState {
    return { ...this.publishModalState };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private captureFocus() {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      this.lastFocusedElement = document.activeElement;
    }
  }

  private restoreFocus() {
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      try {
        this.lastFocusedElement.focus();
      } catch {
        // Ignore focus restore error
      }
      this.lastFocusedElement = null;
    }
  }

  public startLegacyAdoptionReview(
    layout: WebsiteLayout | null | undefined,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      funnels: readonly Funnel[];
      pages: readonly Page[];
    }
  ) {
    this.captureFocus();
    const evaluated = evaluateLegacyNavigationCandidates(this.activeScope, layout, context);
    this.adoptionReviewState = {
      isOpen: true,
      scope: this.activeScope,
      candidates: evaluated.candidates,
      standaloneCta: evaluated.standaloneCta,
      isSubmitting: false,
      errorMessage: null
    };
    this.notify();
  }

  public closeLegacyAdoptionReview() {
    this.adoptionReviewState = {
      ...this.adoptionReviewState,
      isOpen: false,
      errorMessage: null
    };
    this.restoreFocus();
    this.notify();
  }

  public removeAdoptionCandidate(candidateId: string) {
    this.adoptionReviewState.candidates = this.adoptionReviewState.candidates.filter(c => c.id !== candidateId);
    this.notify();
  }

  public openResolveCandidateModal(candidateId: string) {
    const candidate = this.adoptionReviewState.candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    this.captureFocus();
    this.itemModalState = {
      isOpen: true,
      mode: 'resolve_legacy',
      itemId: candidate.id,
      candidateId: candidate.id,
      label: candidate.label,
      targetKind: 'homepage',
      targetValue: '',
      visible: candidate.visible,
      isCta: false,
      isSaving: false,
      errorMessage: null
    };
    this.notify();
  }

  public openAddItemModal() {
    this.captureFocus();
    this.itemModalState = {
      isOpen: true,
      mode: 'add',
      itemId: generateNavigationUuid(),
      candidateId: null,
      label: '',
      targetKind: 'homepage',
      targetValue: '',
      visible: true,
      isCta: false,
      isSaving: false,
      errorMessage: null
    };
    this.notify();
  }

  public openEditItemModal(item: SiteNavigationItem) {
    this.captureFocus();
    this.itemModalState = {
      isOpen: true,
      mode: 'edit',
      itemId: item.id,
      candidateId: null,
      label: item.label,
      targetKind: item.target_kind,
      targetValue: item.target_kind === 'homepage' ? '' : item.target_value,
      visible: item.visible,
      isCta: item.is_cta,
      isSaving: false,
      errorMessage: null
    };
    this.notify();
  }

  public closeItemModal() {
    if (this.itemModalState.isSaving) return;
    this.itemModalState = {
      ...this.itemModalState,
      isOpen: false,
      errorMessage: null
    };
    this.restoreFocus();
    this.notify();
  }

  public setItemModalField<K extends keyof NavigationItemModalState>(field: K, value: NavigationItemModalState[K]) {
    this.itemModalState = {
      ...this.itemModalState,
      [field]: value,
      errorMessage: null
    };
    this.notify();
  }

  public async saveItemModal(context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }): Promise<boolean> {
    if (this.itemModalState.isSaving) return false;

    const { mode, itemId, candidateId, label, targetKind, targetValue, visible, isCta } = this.itemModalState;

    const labelCheck = validateNavigationLabel(label);
    if (!labelCheck.valid) {
      this.itemModalState.errorMessage = labelCheck.error || 'Invalid label';
      this.notify();
      return false;
    }

    let normalizedValue = '';
    if (targetKind === 'homepage') {
      normalizedValue = '__homepage__';
    } else if (targetKind === 'internal') {
      if (!targetValue || !targetValue.trim()) {
        this.itemModalState.errorMessage = 'Please select a destination page.';
        this.notify();
        return false;
      }
      normalizedValue = targetValue.trim();
    } else if (targetKind === 'external') {
      const ext = validateExternalUrl(targetValue);
      if (!ext.valid) {
        this.itemModalState.errorMessage = ext.error || 'Invalid external URL';
        this.notify();
        return false;
      }
      normalizedValue = ext.normalized!;
    } else if (targetKind === 'phone') {
      const phone = validatePhoneTarget(targetValue);
      if (!phone.valid) {
        this.itemModalState.errorMessage = phone.error || 'Invalid phone number';
        this.notify();
        return false;
      }
      normalizedValue = phone.normalized!;
    } else if (targetKind === 'email') {
      const email = validateEmailTarget(targetValue);
      if (!email.valid) {
        this.itemModalState.errorMessage = email.error || 'Invalid email address';
        this.notify();
        return false;
      }
      normalizedValue = email.normalized!;
    }

    // If resolving a candidate during legacy adoption review
    if (mode === 'resolve_legacy' && candidateId) {
      const idx = this.adoptionReviewState.candidates.findIndex(c => c.id === candidateId);
      if (idx >= 0) {
        const updatedCandidate: LegacyNavigationAdoptionCandidate = {
          ...this.adoptionReviewState.candidates[idx],
          label: labelCheck.normalized!,
          visible,
          status: 'ready',
          reason: undefined,
          proposedItem: {
            id: candidateId,
            label: labelCheck.normalized!,
            target_kind: targetKind,
            target_value: normalizedValue,
            position: idx,
            visible,
            is_cta: isCta
          }
        };
        this.adoptionReviewState.candidates[idx] = updatedCandidate;
      }
      this.itemModalState.isOpen = false;
      this.restoreFocus();
      this.notify();
      return true;
    }

    const state = this.controller.getState();
    if (state.status !== 'ready') return false;

    this.itemModalState.isSaving = true;
    this.notify();

    const currentItems = [...state.rawItems];
    if (mode === 'add') {
      currentItems.push({
        id: itemId,
        label: labelCheck.normalized!,
        target_kind: targetKind,
        target_value: normalizedValue,
        position: currentItems.length,
        visible,
        is_cta: isCta
      });
    } else {
      const idx = currentItems.findIndex(i => i.id === itemId);
      if (idx >= 0) {
        currentItems[idx] = {
          ...currentItems[idx],
          label: labelCheck.normalized!,
          target_kind: targetKind,
          target_value: normalizedValue,
          visible,
          is_cta: isCta
        };
      }
    }

    const res = await this.controller.stageDraft(currentItems, context);
    this.itemModalState.isSaving = false;

    if (res.success) {
      this.itemModalState.isOpen = false;
      this.restoreFocus();
      this.notify();
      return true;
    } else {
      this.itemModalState.errorMessage = res.error || 'Failed to save navigation item';
      this.notify();
      return false;
    }
  }

  public async commitLegacyAdoption(context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }): Promise<boolean> {
    if (this.adoptionReviewState.isSubmitting) return false;

    // Verify no unresolved candidates remain
    const unresolved = this.adoptionReviewState.candidates.filter(c => c.status === 'needs_attention');
    if (unresolved.length > 0) {
      this.adoptionReviewState.errorMessage = 'Please resolve or remove all items needing attention before creating the draft.';
      this.notify();
      return false;
    }

    this.adoptionReviewState.isSubmitting = true;
    this.adoptionReviewState.errorMessage = null;
    this.notify();

    const proposedItems: SiteNavigationItem[] = this.adoptionReviewState.candidates
      .map((c, idx) => ({ ...c.proposedItem!, position: idx }));

    const res = await this.controller.stageDraft(proposedItems, context);
    this.adoptionReviewState.isSubmitting = false;

    if (res.success) {
      this.adoptionReviewState.isOpen = false;
      this.restoreFocus();
      this.notify();
      return true;
    } else {
      this.adoptionReviewState.errorMessage = res.error || 'Failed to create navigation draft.';
      this.notify();
      return false;
    }
  }

  public async removeItem(
    itemId: string,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<boolean> {
    const state = this.controller.getState();
    if (state.status !== 'ready' || state.isSaving) return false;

    const filtered = state.rawItems.filter(i => i.id !== itemId);
    const res = await this.controller.stageDraft(filtered, context);
    return res.success;
  }

  public async toggleItemVisibility(
    itemId: string,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<boolean> {
    const state = this.controller.getState();
    if (state.status !== 'ready' || state.isSaving) return false;

    const updated = state.rawItems.map(item => {
      if (item.id === itemId) {
        return { ...item, visible: !item.visible };
      }
      return item;
    });

    const res = await this.controller.stageDraft(updated, context);
    return res.success;
  }

  public async moveItem(
    itemId: string,
    direction: 'up' | 'down',
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<boolean> {
    const state = this.controller.getState();
    if (state.status !== 'ready' || state.isSaving) return false;

    const items = [...state.rawItems];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return false;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const normalized = items.map((item, idx) => ({ ...item, position: idx }));
    const res = await this.controller.stageDraft(normalized, context);
    return res.success;
  }

  public openPublishModal() {
    const state = this.controller.getState();
    if (state.status !== 'ready' || !state.isDraft) return;

    this.captureFocus();
    const summary = computeNavigationPublishDiff(state.liveItems, state.rawItems, state.liveRevision);

    this.publishModalState = {
      isOpen: true,
      menuScope: this.activeScope,
      summary,
      isPublishing: false,
      errorMessage: null
    };
    this.notify();
  }

  public closePublishModal() {
    if (this.publishModalState.isPublishing) return;
    this.publishModalState = {
      ...this.publishModalState,
      isOpen: false,
      errorMessage: null
    };
    this.restoreFocus();
    this.notify();
  }

  public async confirmPublish(context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }): Promise<boolean> {
    const state = this.controller.getState();
    if (state.status !== 'ready' || !state.isDraft || this.publishModalState.isPublishing) return false;

    const readiness = checkNavigationPublicationReadiness(state.rawItems, context);
    if (!readiness.ready) {
      this.publishModalState.errorMessage = readiness.message || 'Navigation links cannot be published yet.';
      this.notify();
      return false;
    }

    // Capture scope and website before awaiting async operation
    const scopeToPublish = this.activeScope;
    const websiteIdToPublish = state.websiteId;
    const baseRevisionToPublish = state.baseRevision;
    const draftRevisionToPublish = state.draftRevision;

    this.publishModalState.isPublishing = true;
    this.publishModalState.errorMessage = null;
    this.notify();

    const res = await this.publishController.publish(
      websiteIdToPublish,
      baseRevisionToPublish,
      draftRevisionToPublish,
      scopeToPublish
    );

    this.publishModalState.isPublishing = false;

    if (res.success) {
      this.publishModalState.isOpen = false;
      this.restoreFocus();
      // Safe post-publish refresh that updates cache and only updates active state if scope is STILL active
      await this.controller.refreshScopeAfterPublish(
        websiteIdToPublish,
        scopeToPublish,
        res.data.items,
        res.data.live_revision,
        context
      );
      this.notify();
      return true;
    } else {
      let errorMsg = res.error;
      if (res.code === 'CONFLICT') {
        errorMsg = 'Navigation changed elsewhere. Reload before publishing.';
      } else if (res.code === 'NOT_FOUND') {
        errorMsg = 'A linked page or destination is no longer available.';
      } else if (res.code === 'INVALID_INPUT') {
        errorMsg = 'One or more navigation links are not publicly available yet.';
      }

      // Only display error on publish modal if user is still on the published scope
      if (this.publishModalState.isOpen && this.activeScope === scopeToPublish) {
        this.publishModalState.errorMessage = errorMsg;
      }
      this.notify();
      return false;
    }
  }
}

/**
 * Render the dedicated Builder Navigation workspace panel.
 */
export function renderBuilderNavigationPanel(
  state: SiteNavigationUiState,
  manager: BuilderNavigationUiManager,
  context: NavigationUiContext
): string {
  const activeScope = manager.getActiveScope();
  const authority = getNavigationScopeAuthority(state);
  const reviewState = manager.getAdoptionReviewState();

  // Multi-scope summary awareness
  const scopeSummary = context.website
    ? (manager as any).controller?.getScopeSummary?.(context.website.id)
    : null;

  let multiScopeBannerHtml = '';
  if (scopeSummary && scopeSummary.draftCount === 2) {
    multiScopeBannerHtml = `
      <div style="margin: 8px 16px 0 16px; padding: 6px 12px; background: #172554; border-radius: 6px; border: 1px solid #1e40af; color: #bfdbfe; font-size: 0.75rem; font-weight: 600;">
        ℹ️ Both Primary and Footer navigation menus have unpublished changes.
      </div>
    `;
  }

  // Authority Badge and Explanation
  let authorityBadgeHtml = '';
  let authorityCalloutHtml = '';

  if (authority === 'legacy') {
    authorityBadgeHtml = `<span class="pb-nav-badge pb-nav-badge-legacy">Legacy navigation</span>`;
    authorityCalloutHtml = `
      <div class="pb-nav-callout pb-nav-callout-legacy" role="status">
        <div style="font-weight: 700; margin-bottom: 4px;">Legacy Layout Active</div>
        <div>Your public site currently uses the fallback navigation layout. Convert to an editable navigation draft to customize menu links.</div>
      </div>
    `;
  } else if (authority === 'draft') {
    authorityBadgeHtml = `<span class="pb-nav-badge pb-nav-badge-draft">Unpublished changes</span>`;
    const draftExplanation = (state as any).liveRevision > 0
      ? `Public site still uses the currently published navigation (rev ${(state as any).liveRevision}).`
      : 'Public site still uses legacy navigation until published.';
    authorityCalloutHtml = `
      <div class="pb-nav-callout pb-nav-callout-draft" role="status">
        <div style="font-weight: 700; margin-bottom: 4px;">Draft in Progress</div>
        <div>${escapeHtmlText(draftExplanation)} Preview reflects your unpublished draft.</div>
      </div>
    `;
  } else if (authority === 'live') {
    authorityBadgeHtml = `<span class="pb-nav-badge pb-nav-badge-live">Live</span>`;
    authorityCalloutHtml = `
      <div class="pb-nav-callout pb-nav-callout-live" role="status">
        <div style="font-weight: 700; margin-bottom: 4px;">Live Navigation</div>
        <div>Canonical navigation is published and active on your public website (rev ${(state as any).liveRevision}).</div>
      </div>
    `;
  }

  // Standalone Header CTA Duplication Warning
  let ctaDuplicationWarningHtml = '';
  if (activeScope === 'primary' && state.status === 'ready' && state.items) {
    const hasCanonicalCta = state.items.some(i => i.visible && i.is_cta);
    const legacyCtaText = context.layout?.header_config?.cta_text?.trim();
    const legacyCtaLink = context.layout?.header_config?.cta_link?.trim();
    if (hasCanonicalCta && legacyCtaText && legacyCtaLink) {
      ctaDuplicationWarningHtml = `
        <div class="pb-nav-cta-warning" role="alert" style="margin: 10px 16px; padding: 10px 14px; border-radius: 8px; background: #451a03; border: 1px solid #b45309; color: #fde68a; font-size: 0.8rem; line-height: 1.4;">
          ⚠️ <b>Header CTA notice:</b> Your header layout also has a standalone CTA button ("${escapeHtmlText(legacyCtaText)}"). Publishing this menu may display both CTA buttons on your website.
        </div>
      `;
    }
  }

  // Conflict / Error Alert
  let errorBannerHtml = '';
  if (state.status === 'ready' && (state.isConflict || (state.errorMessage && (state.errorMessage.includes('modified elsewhere') || state.errorMessage.includes('stale'))))) {
    errorBannerHtml = `
      <div class="pb-nav-error-banner" role="alert" style="margin: 12px 16px; padding: 12px; border-radius: 8px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; font-size: 0.85rem;">
        <div style="font-weight: 700; margin-bottom: 4px;">⚠️ Concurrency Conflict</div>
        <div>Navigation changed in another tab. Reload the latest navigation before continuing.</div>
        <button type="button" class="btn-outline" style="margin-top: 8px; min-height: 38px; padding: 6px 14px; font-size: 0.8rem; font-weight: 700; background: #7f1d1d; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="window.reloadBuilderNavigation()">Reload Latest</button>
      </div>
    `;
  } else if (state.status === 'ready' && state.errorMessage) {
    errorBannerHtml = `
      <div class="pb-nav-error-banner" role="alert" style="margin: 12px 16px; padding: 12px; border-radius: 8px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; font-size: 0.85rem;">
        <div style="font-weight: 700; margin-bottom: 4px;">Navigation Error</div>
        <div>${escapeHtmlText(state.errorMessage)}</div>
      </div>
    `;
  } else if (state.status === 'error') {
    errorBannerHtml = `
      <div class="pb-nav-error-banner" role="alert" style="margin: 12px 16px; padding: 12px; border-radius: 8px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; font-size: 0.85rem;">
        <div style="font-weight: 700; margin-bottom: 4px;">Failed to Load Navigation</div>
        <div>${escapeHtmlText(state.error)}</div>
        <button type="button" class="btn-outline" style="margin-top: 8px; min-height: 38px; padding: 6px 14px; font-size: 0.8rem; font-weight: 700; background: #7f1d1d; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="window.reloadBuilderNavigation()">Retry</button>
      </div>
    `;
  }

  // Adoption Review View (if user is actively reviewing legacy conversion)
  if (reviewState.isOpen) {
    return renderLegacyAdoptionReviewPanel(reviewState, manager, context);
  }

  // Action Buttons Bar
  let actionsBarHtml = '';
  if (state.status === 'ready') {
    if (authority === 'legacy') {
      actionsBarHtml = `
        <div class="pb-nav-actions" style="padding: 12px 16px; border-bottom: 1px solid #222; display: flex; gap: 8px;">
          <button type="button" class="btn-primary pb-nav-adopt-btn" style="flex: 1; min-height: 44px; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.startBuilderLegacyAdoption()">Convert to Editable Navigation</button>
        </div>
      `;
    } else {
      actionsBarHtml = `
        <div class="pb-nav-actions" style="padding: 12px 16px; border-bottom: 1px solid #222; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <button type="button" class="btn-primary" style="min-height: 40px; padding: 8px 14px; font-size: 0.8rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openAddBuilderNavItemModal()">+ Add Item</button>
          ${state.isDraft ? `
            <button type="button" class="btn-outline" style="min-height: 40px; padding: 8px 12px; font-size: 0.8rem; font-weight: 700; background: #1e1e1e; border: 1px solid #333; color: #cbd5e1; border-radius: 8px; cursor: pointer;" onclick="window.previewBuilderNavChanges()">Preview</button>
            <button type="button" class="btn-outline" style="min-height: 40px; padding: 8px 12px; font-size: 0.8rem; font-weight: 700; background: #1e1e1e; border: 1px solid #333; color: #f87171; border-radius: 8px; cursor: pointer;" onclick="window.revertBuilderNavDraft()" ${state.isSaving ? 'disabled aria-busy="true"' : ''}>Revert</button>
            <button type="button" class="btn-primary" style="min-height: 40px; padding: 8px 14px; font-size: 0.8rem; font-weight: 700; background: #16a34a; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openPublishBuilderNavModal()" ${state.isSaving ? 'disabled aria-busy="true"' : ''}>Publish ${activeScope === 'primary' ? 'Primary' : 'Footer'}</button>
          ` : ''}
        </div>
      `;
    }
  }

  // Items Content List
  let itemsListHtml = '';
  if (state.status === 'loading') {
    itemsListHtml = `
      <div style="padding: 40px 20px; text-align: center; color: #64748b; font-size: 0.9rem;">
        <div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
        Loading navigation...
      </div>
    `;
  } else if (state.status === 'ready') {
    if (authority === 'legacy') {
      const evalResult = evaluateLegacyNavigationCandidates(activeScope, context.layout, context);
      const candidates = evalResult.candidates;

      itemsListHtml = `
        <div class="pb-nav-legacy-list" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
          ${candidates.length === 0 ? `
            <div style="padding: 24px; text-align: center; background: #161616; border: 1px dashed #333; border-radius: 10px; color: #64748b; font-size: 0.85rem;">
              No links defined in legacy layout.
            </div>
          ` : candidates.map(c => `
            <div class="pb-nav-item-card pb-nav-item-legacy" style="background: #181818; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 700; font-size: 0.88rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlText(c.label)}</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
                  <span style="font-family: monospace;">${escapeHtmlText(c.originalTarget || '(no destination)')}</span>
                </div>
              </div>
              <span style="font-size: 0.75rem; color: #64748b; white-space: nowrap;">Read-only</span>
            </div>
          `).join('')}
          <div style="margin-top: 10px; text-align: center;">
            <button type="button" class="btn-primary" style="width: 100%; min-height: 44px; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.startBuilderLegacyAdoption()">Convert to Editable Navigation</button>
          </div>
        </div>
      `;
    } else {
      const items = state.items;
      if (items.length === 0) {
        itemsListHtml = `
          <div class="pb-nav-empty-state" style="padding: 32px 20px; text-align: center; background: #141414; border: 1px dashed #2a2a2a; border-radius: 12px; margin: 16px; color: #94a3b8;">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">📭</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #f1f5f9; margin-bottom: 4px;">Explicit Empty Menu</div>
            <p style="font-size: 0.8rem; line-height: 1.4; margin: 0 0 16px 0; color: #64748b;">This ${activeScope} menu contains 0 links. On the live site, no navigation links will be rendered.</p>
            <button type="button" class="btn-primary" style="min-height: 40px; padding: 8px 16px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openAddBuilderNavItemModal()">+ Add First Link</button>
          </div>
        `;
      } else {
        itemsListHtml = `
          <div class="pb-nav-items-list" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            ${items.map((item, idx) => renderNavigationItemCard(item, idx, items.length, state.isSaving)).join('')}
          </div>
        `;
      }
    }
  }

  // Footer Scope Note
  let footerNoteHtml = '';
  if (activeScope === 'footer') {
    footerNoteHtml = `
      <div style="margin: 0 16px 12px 16px; padding: 8px 12px; background: #161616; border-radius: 6px; border: 1px solid #262626; color: #94a3b8; font-size: 0.75rem;">
        ℹ️ <b>Footer navigation note:</b> Footer menu links render as clean footer navigation links.
      </div>
    `;
  }

  return `
    <div class="pb-navigation-panel" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: #111; color: #eee;">
      <!-- Header -->
      <div class="pb-panel-header" style="padding: 20px 16px 12px 16px; border-bottom: 1px solid #222;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h3 style="font-size: 0.75rem; color: #888; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin: 0;">Site Navigation</h3>
          ${authorityBadgeHtml}
        </div>

        <!-- Scope Segmented Control -->
        <div class="pb-nav-scope-tabs" role="tablist" aria-label="Menu Scope" style="display: flex; background: #1a1a1a; padding: 3px; border-radius: 8px; border: 1px solid #262626;">
          <button type="button" role="tab" aria-selected="${activeScope === 'primary'}" class="${activeScope === 'primary' ? 'active' : ''}" style="flex: 1; min-height: 38px; padding: 8px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 150ms ease; ${activeScope === 'primary' ? 'background: #2563eb; color: white;' : 'background: transparent; color: #94a3b8;'}" onclick="window.setBuilderNavScope('primary')">Primary Menu</button>
          <button type="button" role="tab" aria-selected="${activeScope === 'footer'}" class="${activeScope === 'footer' ? 'active' : ''}" style="flex: 1; min-height: 38px; padding: 8px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 150ms ease; ${activeScope === 'footer' ? 'background: #2563eb; color: white;' : 'background: transparent; color: #94a3b8;'}" onclick="window.setBuilderNavScope('footer')">Footer Menu</button>
        </div>
      </div>

      ${multiScopeBannerHtml}
      ${authorityCalloutHtml}
      ${ctaDuplicationWarningHtml}
      ${errorBannerHtml}
      ${footerNoteHtml}
      ${actionsBarHtml}

      <!-- Items Section -->
      <div style="flex: 1; min-height: 0;">
        ${itemsListHtml}
      </div>
    </div>
  `;
}

/**
 * Render the dedicated Adoption Review screen before creating canonical draft.
 */
function renderLegacyAdoptionReviewPanel(
  reviewState: LegacyAdoptionReviewState,
  manager: BuilderNavigationUiManager,
  context: NavigationUiContext
): string {
  const unresolvedCount = reviewState.candidates.filter(c => c.status === 'needs_attention').length;
  const canSubmit = unresolvedCount === 0;

  return `
    <div class="pb-navigation-panel pb-adoption-review-panel" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: #111; color: #eee; padding: 16px;">
      <div style="border-bottom: 1px solid #282828; padding-bottom: 12px; margin-bottom: 14px;">
        <h3 style="font-size: 1rem; color: #f8fafc; font-weight: 700; margin: 0 0 6px 0;">Convert Legacy Navigation</h3>
        <p style="font-size: 0.8rem; color: #94a3b8; line-height: 1.4; margin: 0;">
          Review the converted navigation items. Every link must point to a valid destination before creating the editable draft.
        </p>
      </div>

      ${reviewState.errorMessage ? `
        <div role="alert" style="margin-bottom: 12px; padding: 10px 14px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; border-radius: 8px; font-size: 0.85rem;">
          ${escapeHtmlText(reviewState.errorMessage)}
        </div>
      ` : ''}

      ${reviewState.standaloneCta ? `
        <div style="margin-bottom: 14px; padding: 12px; background: #18181b; border: 1px solid #27272a; border-radius: 8px; font-size: 0.8rem; color: #cbd5e1; line-height: 1.4;">
          ℹ️ <b>Existing Header CTA:</b> "${escapeHtmlText(reviewState.standaloneCta.text)}"<br>
          Your existing standalone header CTA remains active separately from the navigation menu.
        </div>
      ` : ''}

      ${unresolvedCount > 0 ? `
        <div role="alert" style="margin-bottom: 14px; padding: 10px 12px; background: #451a03; border: 1px solid #b45309; color: #fde68a; border-radius: 8px; font-size: 0.82rem;">
          ⚠️ <b>${unresolvedCount} item${unresolvedCount > 1 ? 's need' : ' needs'} attention:</b> Choose a destination or remove the item to proceed.
        </div>
      ` : ''}

      <!-- Candidates List -->
      <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
        ${reviewState.candidates.map((c, idx) => `
          <div class="pb-nav-candidate-card" style="background: ${c.status === 'needs_attention' ? '#241414' : '#181818'}; border: 1px solid ${c.status === 'needs_attention' ? '#7f1d1d' : '#2a2a2a'}; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="font-weight: 700; font-size: 0.9rem; color: #f8fafc;">${escapeHtmlText(c.label)}</div>
              ${c.status === 'needs_attention'
                ? `<span style="background: #7f1d1d; color: #fecaca; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">Needs attention</span>`
                : `<span style="background: #064e3b; color: #a7f3d0; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">Ready</span>`
              }
            </div>

            <div style="font-size: 0.78rem; color: #94a3b8;">
              Original: <code style="background: #111; padding: 2px 5px; border-radius: 4px;">${escapeHtmlText(c.originalTarget || '(empty)')}</code>
            </div>

            ${c.reason ? `
              <div style="font-size: 0.75rem; color: #fca5a5; margin-top: 2px;">
                ${escapeHtmlText(c.reason)}
              </div>
            ` : ''}

            <!-- Candidate Actions -->
            <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end; flex-wrap: wrap;">
              <button type="button" class="btn-outline" style="min-height: 38px; padding: 6px 12px; font-size: 0.78rem; background: #222; color: #93c5fd; border: 1px solid #1e3a8a; border-radius: 6px; cursor: pointer;" onclick="window.openResolveCandidateModal('${escapeHtmlText(c.id)}')">
                ${c.status === 'needs_attention' ? 'Choose Destination' : 'Edit'}
              </button>
              <button type="button" class="btn-outline" style="min-height: 38px; padding: 6px 12px; font-size: 0.78rem; background: #222; color: #f87171; border: 1px solid #7f1d1d; border-radius: 6px; cursor: pointer;" onclick="window.removeAdoptionCandidate('${escapeHtmlText(c.id)}')">
                Remove
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px solid #282828; flex-wrap: wrap;">
        <button type="button" class="btn-outline" style="min-height: 44px; padding: 10px 16px; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;" onclick="window.closeBuilderLegacyAdoptionReview()">Cancel</button>
        <button type="button" class="btn-primary" style="min-height: 44px; padding: 10px 18px; background: ${canSubmit ? '#2563eb' : '#374151'}; color: ${canSubmit ? 'white' : '#9ca3af'}; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: ${canSubmit ? 'pointer' : 'not-allowed'};" onclick="window.commitBuilderLegacyAdoption()" ${!canSubmit || reviewState.isSubmitting ? 'disabled aria-busy="true"' : ''}>
          ${reviewState.isSubmitting ? 'Creating draft...' : 'Create Editable Navigation Draft'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Render individual navigation item card with reordering, visibility, edit, and delete actions.
 */
export function renderNavigationItemCard(
  item: ResolvedNavigationItem,
  index: number,
  totalItems: number,
  isSaving: boolean
): string {
  let targetSummary = '';
  let targetTypeBadge = '';
  if (item.target_kind === 'homepage') {
    targetTypeBadge = '<span class="pb-nav-tag" style="background: #064e3b; color: #a7f3d0; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Home</span>';
    targetSummary = '/ (Homepage)';
  } else if (item.target_kind === 'internal') {
    targetTypeBadge = '<span class="pb-nav-tag" style="background: #1e3a8a; color: #bfdbfe; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Page</span>';
    targetSummary = item.resolved_href ? item.resolved_href : (item.resolution_details || 'Unrouted');
  } else if (item.target_kind === 'external') {
    targetTypeBadge = '<span class="pb-nav-tag" style="background: #581c87; color: #e9d5ff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">External</span>';
    targetSummary = item.target_value;
  } else if (item.target_kind === 'phone') {
    targetTypeBadge = '<span class="pb-nav-tag" style="background: #14532d; color: #bbf7d0; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Phone</span>';
    targetSummary = item.target_value;
  } else if (item.target_kind === 'email') {
    targetTypeBadge = '<span class="pb-nav-tag" style="background: #701a75; color: #f5d0fe; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">Email</span>';
    targetSummary = item.target_value;
  }

  let warningBadgeHtml = '';
  if (item.resolution_status === 'unrouted') {
    warningBadgeHtml = `<div style="margin-top: 4px; font-size: 0.75rem; color: #fbbf24; font-weight: 600;">⚠️ Unrouted Destination</div>`;
  } else if (item.resolution_status === 'pending_deletion') {
    warningBadgeHtml = `<div style="margin-top: 4px; font-size: 0.75rem; color: #f87171; font-weight: 600;">⛔ URL pending removal</div>`;
  }

  return `
    <div class="pb-nav-item-card ${!item.visible ? 'pb-nav-item-hidden' : ''}" style="background: ${item.visible ? '#1a1a1a' : '#141414'}; border: 1px solid ${item.visible ? '#2a2a2a' : '#222'}; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; opacity: ${item.visible ? '1' : '0.6'}; transition: all 150ms ease;">
      <div style="display: flex; align-items: center; gap: 10px; justify-content: space-between; flex-wrap: wrap;">
        <!-- Reorder buttons with accessible touch targets -->
        <div style="display: flex; gap: 4px;">
          <button type="button" aria-label="Move item up" class="btn-outline" style="min-height: 38px; min-width: 38px; padding: 6px 10px; font-size: 0.8rem; font-weight: 700; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 6px; cursor: pointer;" onclick="window.moveBuilderNavItem('${escapeHtmlText(item.id)}', 'up')" ${index === 0 || isSaving ? 'disabled' : ''}>▲</button>
          <button type="button" aria-label="Move item down" class="btn-outline" style="min-height: 38px; min-width: 38px; padding: 6px 10px; font-size: 0.8rem; font-weight: 700; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 6px; cursor: pointer;" onclick="window.moveBuilderNavItem('${escapeHtmlText(item.id)}', 'down')" ${index === totalItems - 1 || isSaving ? 'disabled' : ''}>▼</button>
        </div>

        <div style="flex: 1; min-width: 140px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; font-size: 0.88rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlText(item.label)}</span>
            ${item.is_cta ? `<span style="background: #1d4ed8; color: #dbeafe; padding: 1px 5px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">CTA</span>` : ''}
            ${!item.visible ? `<span style="background: #374151; color: #9ca3af; padding: 1px 5px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">Hidden</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 0.75rem; color: #94a3b8;">
            ${targetTypeBadge}
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtmlText(targetSummary)}">${escapeHtmlText(targetSummary)}</span>
          </div>
          ${warningBadgeHtml}
        </div>

        <!-- Row Actions -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button type="button" aria-label="${item.visible ? 'Hide item' : 'Show item'}" class="btn-outline" style="min-height: 38px; min-width: 44px; padding: 6px 12px; font-size: 0.75rem; font-weight: 600; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 6px; cursor: pointer;" onclick="window.toggleBuilderNavItemVisibility('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>${item.visible ? 'Hide' : 'Show'}</button>
          <button type="button" aria-label="Edit item" class="btn-outline" style="min-height: 38px; min-width: 44px; padding: 6px 12px; font-size: 0.75rem; font-weight: 600; background: #222; color: #93c5fd; border: 1px solid #1e3a8a; border-radius: 6px; cursor: pointer;" onclick="window.openEditBuilderNavItemModal('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>Edit</button>
          <button type="button" aria-label="Remove item" class="btn-outline" style="min-height: 38px; min-width: 44px; padding: 6px 12px; font-size: 0.75rem; font-weight: 600; background: #222; color: #f87171; border: 1px solid #7f1d1d; border-radius: 6px; cursor: pointer;" onclick="window.removeBuilderNavItem('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>Remove</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the Add/Edit Navigation Item Modal Dialog.
 */
export function renderNavigationItemModal(
  modalState: NavigationItemModalState,
  context: NavigationUiContext | null
): string {
  if (!modalState.isOpen || !context) return '';

  const { mode, label, targetKind, targetValue, visible, isCta, isSaving, errorMessage } = modalState;

  const pages = context.pages;
  const funnels = context.funnels;
  const routes = context.effectiveRoutes;

  const internalOptions = funnels.map(funnel => {
    const matchingPage = pages.find(p => p.funnel_id === funnel.id);
    const pageName = matchingPage?.name || funnel.name || 'Untitled Page';
    const matchingRoute = routes.find(r => r.funnel_id === funnel.id);
    const routePath = matchingRoute ? matchingRoute.path : '(unrouted)';
    const isSelected = targetValue === funnel.id;

    return `<option value="${escapeHtmlText(funnel.id)}" ${isSelected ? 'selected' : ''}>${escapeHtmlText(pageName)} (${escapeHtmlText(routePath)})</option>`;
  }).join('');

  return `
    <div class="pb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nav-item-modal-title" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
      <div class="pb-modal-card" style="background: #181818; border: 1px solid #333; border-radius: 12px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column;">
        <!-- Modal Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #282828; display: flex; align-items: center; justify-content: space-between;">
          <h3 id="nav-item-modal-title" style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">
            ${mode === 'add' ? 'Add Navigation Item' : mode === 'resolve_legacy' ? 'Choose Destination' : 'Edit Navigation Item'}
          </h3>
          <button type="button" aria-label="Close dialog" onclick="window.closeBuilderNavItemModal()" ${isSaving ? 'disabled' : ''} style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; min-height: 38px; min-width: 38px; padding: 4px;">✕</button>
        </div>

        <!-- Modal Body -->
        <form onsubmit="event.preventDefault(); window.saveBuilderNavItemModal();" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
          ${errorMessage ? `
            <div role="alert" id="nav-item-error-msg" style="padding: 10px 14px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; border-radius: 8px; font-size: 0.85rem;">
              ${escapeHtmlText(errorMessage)}
            </div>
          ` : ''}

          <!-- Label -->
          <div>
            <label for="nav-item-label-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Menu Label *</label>
            <input id="nav-item-label-input" type="text" value="${escapeHtmlText(label)}" required placeholder="e.g. Services, About Us, Book Now" oninput="window.setBuilderNavItemModalField('label', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;" autofocus>
          </div>

          <!-- Link Type -->
          <div>
            <label for="nav-item-kind-select" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Link Type</label>
            <select id="nav-item-kind-select" onchange="window.setBuilderNavItemModalField('targetKind', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem; cursor: pointer;">
              <option value="homepage" ${targetKind === 'homepage' ? 'selected' : ''}>Home (/)</option>
              <option value="internal" ${targetKind === 'internal' ? 'selected' : ''}>Page (Internal Route)</option>
              <option value="external" ${targetKind === 'external' ? 'selected' : ''}>External URL (https://...)</option>
              <option value="phone" ${targetKind === 'phone' ? 'selected' : ''}>Phone Number</option>
              <option value="email" ${targetKind === 'email' ? 'selected' : ''}>Email Address</option>
            </select>
          </div>

          <!-- Dynamic Target Input -->
          ${targetKind === 'homepage' ? `
            <div style="padding: 10px 14px; background: #141414; border: 1px solid #262626; border-radius: 8px; font-size: 0.82rem; color: #94a3b8;">
              Points dynamically to the website homepage (<code>/</code>). If the homepage changes, this link updates automatically.
            </div>
          ` : targetKind === 'internal' ? `
            <div>
              <label for="nav-item-target-select" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Destination Page *</label>
              <select id="nav-item-target-select" onchange="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem; cursor: pointer;">
                <option value="">-- Select a page destination --</option>
                ${internalOptions}
              </select>
            </div>
          ` : targetKind === 'external' ? `
            <div>
              <label for="nav-item-external-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">External URL *</label>
              <input id="nav-item-external-input" type="url" value="${escapeHtmlText(targetValue)}" placeholder="https://example.com/pricing" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
              <small style="display: block; margin-top: 4px; color: #64748b; font-size: 0.75rem;">Must be a standard http:// or https:// URL.</small>
            </div>
          ` : targetKind === 'phone' ? `
            <div>
              <label for="nav-item-phone-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Phone Number *</label>
              <input id="nav-item-phone-input" type="tel" value="${escapeHtmlText(targetValue)}" placeholder="+1 (555) 234-5678" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
            </div>
          ` : `
            <div>
              <label for="nav-item-email-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address *</label>
              <input id="nav-item-email-input" type="email" value="${escapeHtmlText(targetValue)}" placeholder="contact@washops.com" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; min-height: 42px; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
            </div>
          `}

          <!-- Presentation & Visibility Toggles -->
          <div style="display: flex; gap: 20px; padding: 10px 0; border-top: 1px solid #262626; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; cursor: pointer; min-height: 38px;">
              <input type="checkbox" ${isCta ? 'checked' : ''} onchange="window.setBuilderNavItemModalField('isCta', this.checked)" style="width: 20px; height: 20px; accent-color: #2563eb; cursor: pointer;">
              Show as CTA button
            </label>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; cursor: pointer; min-height: 38px;">
              <input type="checkbox" ${visible ? 'checked' : ''} onchange="window.setBuilderNavItemModalField('visible', this.checked)" style="width: 20px; height: 20px; accent-color: #2563eb; cursor: pointer;">
              Visible in menu
            </label>
          </div>

          <!-- Footer Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-outline" onclick="window.closeBuilderNavItemModal()" ${isSaving ? 'disabled' : ''} style="min-height: 42px; padding: 10px 16px; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Cancel</button>
            <button type="submit" class="btn-primary" ${isSaving ? 'disabled aria-busy="true"' : ''} style="min-height: 42px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
              ${isSaving ? 'Saving...' : mode === 'add' ? 'Add Item' : mode === 'resolve_legacy' ? 'Set Destination' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Render the Publish Navigation Confirmation Modal Dialog.
 */
export function renderNavigationPublishModal(
  publishState: NavigationPublishModalState
): string {
  if (!publishState.isOpen) return '';

  const { menuScope, summary, isPublishing, errorMessage } = publishState;
  const scopeLabel = menuScope === 'primary' ? 'Primary Menu' : 'Footer Menu';

  return `
    <div class="pb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nav-publish-modal-title" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
      <div class="pb-modal-card" style="background: #181818; border: 1px solid #333; border-radius: 12px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #282828; display: flex; align-items: center; justify-content: space-between;">
          <h3 id="nav-publish-modal-title" style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">Publish ${escapeHtmlText(scopeLabel)}</h3>
          <button type="button" aria-label="Close dialog" onclick="window.closePublishBuilderNavModal()" ${isPublishing ? 'disabled' : ''} style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; min-height: 38px; min-width: 38px; padding: 4px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          ${errorMessage ? `
            <div role="alert" style="padding: 10px 14px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; border-radius: 8px; font-size: 0.85rem;">
              ${escapeHtmlText(errorMessage)}
            </div>
          ` : ''}

          ${summary?.isExplicitEmpty ? `
            <div role="alert" style="padding: 12px 14px; background: #451a03; border: 1px solid #b45309; color: #fde68a; border-radius: 8px; font-size: 0.85rem; line-height: 1.4;">
              ⚠️ <b>Explicit Empty Menu Warning:</b><br>
              Publishing will store an empty navigation configuration and remove all links from your live website ${menuScope === 'primary' ? 'header' : 'footer'}.
            </div>
          ` : ''}

          ${summary?.isFirstAdoptionFromLegacy ? `
            <div style="padding: 10px 14px; background: #1e3a8a; border: 1px solid #2563eb; color: #dbeafe; border-radius: 8px; font-size: 0.85rem;">
              ℹ️ Publishing will convert your website from the legacy navigation layout to this canonical navigation configuration.
            </div>
          ` : ''}

          <div style="background: #111; border: 1px solid #262626; border-radius: 8px; padding: 14px;">
            <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 8px;">Summary of Changes</div>
            <div style="font-size: 0.9rem; color: #f8fafc; font-weight: 700; margin-bottom: 6px;">${summary?.totalCount ?? 0} total menu links</div>
            ${summary?.changeDescriptions && summary.changeDescriptions.length > 0 ? `
              <ul style="margin: 0; padding-left: 18px; font-size: 0.82rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 4px;">
                ${summary.changeDescriptions.slice(0, 5).map(desc => `<li>${escapeHtmlText(desc)}</li>`).join('')}
                ${summary.changeDescriptions.length > 5 ? `<li>...and ${summary.changeDescriptions.length - 5} more changes</li>` : ''}
              </ul>
            ` : `<p style="margin: 0; font-size: 0.82rem; color: #64748b;">Ready to publish.</p>`}
          </div>

          <p style="margin: 0; font-size: 0.82rem; color: #94a3b8; line-height: 1.4;">
            This will update the public live website immediately for all visitors.
          </p>

          <!-- Footer Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; flex-wrap: wrap;">
            <button type="button" class="btn-outline" onclick="window.closePublishBuilderNavModal()" ${isPublishing ? 'disabled' : ''} style="min-height: 44px; padding: 10px 16px; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Cancel</button>
            <button type="button" class="btn-primary" onclick="window.confirmPublishBuilderNav()" ${isPublishing ? 'disabled aria-busy="true"' : ''} style="min-height: 44px; padding: 10px 20px; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ${isPublishing ? 'Publishing...' : `Publish ${scopeLabel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
