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

export type NavigationScopeAuthority = 'legacy' | 'live' | 'draft';

export interface NavigationItemModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  itemId: string;
  label: string;
  targetKind: NavigationTargetKind;
  targetValue: string;
  visible: boolean;
  isCta: boolean;
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

export interface LegacyConvertedItem {
  item: SiteNavigationItem;
  needsAttention: boolean;
  attentionReason?: string;
}

export interface LegacyConversionResult {
  items: SiteNavigationItem[];
  hasAttentionItems: boolean;
  attentionCount: number;
  convertedCtaItem: SiteNavigationItem | null;
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
 * Maps a legacy layout's nav_items and header CTA to canonical draft navigation items.
 * Loss-aware: preserves every link, flags unresolvable destinations as needsAttention.
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
): LegacyConversionResult {
  const convertedItems: SiteNavigationItem[] = [];
  let hasAttentionItems = false;
  let attentionCount = 0;
  let convertedCtaItem: SiteNavigationItem | null = null;

  if (scope === 'primary') {
    const headerConfig = layout?.header_config as any;
    const rawNavItems = Array.isArray(headerConfig?.nav_items) ? headerConfig.nav_items : [];

    rawNavItems.forEach((raw: any, index: number) => {
      const id = uuidFactory();
      const label = typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label.trim() : `Item ${index + 1}`;
      const path = typeof raw.path === 'string' ? raw.path.trim() : '';
      const visible = raw.visible !== false;

      let target_kind: NavigationTargetKind = 'homepage';
      let target_value = '__homepage__';
      let needsAttention = false;

      if (!path || path === '/' || path === '/home' || path.toLowerCase() === 'home') {
        target_kind = 'homepage';
        target_value = '__homepage__';
      } else if (path.startsWith('http://') || path.startsWith('https://')) {
        const extCheck = validateExternalUrl(path);
        if (extCheck.valid && extCheck.normalized) {
          target_kind = 'external';
          target_value = extCheck.normalized;
        } else {
          target_kind = 'external';
          target_value = 'https://example.com/';
          needsAttention = true;
        }
      } else if (path.startsWith('tel:')) {
        const phoneCheck = validatePhoneTarget(path.slice(4));
        if (phoneCheck.valid && phoneCheck.normalized) {
          target_kind = 'phone';
          target_value = phoneCheck.normalized;
        } else {
          target_kind = 'phone';
          target_value = '+15550000000';
          needsAttention = true;
        }
      } else if (path.startsWith('mailto:')) {
        const emailCheck = validateEmailTarget(path.slice(7));
        if (emailCheck.valid && emailCheck.normalized) {
          target_kind = 'email';
          target_value = emailCheck.normalized;
        } else {
          target_kind = 'email';
          target_value = 'invalid@example.com';
          needsAttention = true;
        }
      } else {
        // Relative path: match against effective routes or page slugs
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const matchingRoute = context.effectiveRoutes.find(r => r.path === cleanPath || r.live_path === cleanPath);
        if (matchingRoute && matchingRoute.funnel_id) {
          target_kind = 'internal';
          target_value = matchingRoute.funnel_id;
        } else {
          // Check pages by slug
          const slug = cleanPath.replace(/^\//, '');
          const matchingPage = context.pages.find(p => p.slug === slug);
          if (matchingPage && matchingPage.funnel_id) {
            target_kind = 'internal';
            target_value = matchingPage.funnel_id;
          } else {
            target_kind = 'external';
            target_value = 'https://example.com' + cleanPath;
            needsAttention = true;
          }
        }
      }

      if (needsAttention) {
        hasAttentionItems = true;
        attentionCount++;
      }

      convertedItems.push({
        id,
        label,
        target_kind,
        target_value,
        position: convertedItems.length,
        visible,
        is_cta: false
      });
    });

    // Step 9: Legacy Header CTA audit
    // Check if legacy header has separate cta_text and cta_link
    const ctaText = typeof headerConfig?.cta_text === 'string' ? headerConfig.cta_text.trim() : '';
    const ctaLink = typeof headerConfig?.cta_link === 'string' ? headerConfig.cta_link.trim() : '';

    if (ctaText && ctaLink) {
      // Check if CTA is already represented in nav items
      const alreadyPresent = convertedItems.some(i => i.label.toLowerCase() === ctaText.toLowerCase());
      if (!alreadyPresent) {
        const ctaId = uuidFactory();
        let target_kind: NavigationTargetKind = 'homepage';
        let target_value = '__homepage__';

        if (ctaLink === '/' || ctaLink === '/home') {
          target_kind = 'homepage';
          target_value = '__homepage__';
        } else if (ctaLink.startsWith('http://') || ctaLink.startsWith('https://')) {
          const extCheck = validateExternalUrl(ctaLink);
          target_kind = 'external';
          target_value = extCheck.valid && extCheck.normalized ? extCheck.normalized : ctaLink;
        } else if (ctaLink.startsWith('tel:')) {
          target_kind = 'phone';
          target_value = ctaLink.slice(4);
        } else if (ctaLink.startsWith('mailto:')) {
          target_kind = 'email';
          target_value = ctaLink.slice(7);
        } else {
          const cleanPath = ctaLink.startsWith('/') ? ctaLink : `/${ctaLink}`;
          const matchingRoute = context.effectiveRoutes.find(r => r.path === cleanPath || r.live_path === cleanPath);
          if (matchingRoute && matchingRoute.funnel_id) {
            target_kind = 'internal';
            target_value = matchingRoute.funnel_id;
          } else {
            target_kind = 'external';
            target_value = cleanPath;
          }
        }

        convertedCtaItem = {
          id: ctaId,
          label: ctaText,
          target_kind,
          target_value,
          position: convertedItems.length,
          visible: true,
          is_cta: true
        };
        convertedItems.push(convertedCtaItem);
      }
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

      let target_kind: NavigationTargetKind = 'homepage';
      let target_value = '__homepage__';
      let needsAttention = false;

      if (!path || path === '/' || path === '/home') {
        target_kind = 'homepage';
        target_value = '__homepage__';
      } else if (path.startsWith('http://') || path.startsWith('https://')) {
        const extCheck = validateExternalUrl(path);
        if (extCheck.valid && extCheck.normalized) {
          target_kind = 'external';
          target_value = extCheck.normalized;
        } else {
          target_kind = 'external';
          target_value = 'https://example.com/';
          needsAttention = true;
        }
      } else if (path.startsWith('tel:')) {
        const phoneCheck = validatePhoneTarget(path.slice(4));
        if (phoneCheck.valid && phoneCheck.normalized) {
          target_kind = 'phone';
          target_value = phoneCheck.normalized;
        } else {
          target_kind = 'phone';
          target_value = '+15550000000';
          needsAttention = true;
        }
      } else if (path.startsWith('mailto:')) {
        const emailCheck = validateEmailTarget(path.slice(7));
        if (emailCheck.valid && emailCheck.normalized) {
          target_kind = 'email';
          target_value = emailCheck.normalized;
        } else {
          target_kind = 'email';
          target_value = 'invalid@example.com';
          needsAttention = true;
        }
      } else {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const matchingRoute = context.effectiveRoutes.find(r => r.path === cleanPath || r.live_path === cleanPath);
        if (matchingRoute && matchingRoute.funnel_id) {
          target_kind = 'internal';
          target_value = matchingRoute.funnel_id;
        } else {
          target_kind = 'external';
          target_value = 'https://example.com' + cleanPath;
          needsAttention = true;
        }
      }

      if (needsAttention) {
        hasAttentionItems = true;
        attentionCount++;
      }

      convertedItems.push({
        id,
        label,
        target_kind,
        target_value,
        position: convertedItems.length,
        visible,
        is_cta: false
      });
    });
  }

  return {
    items: convertedItems,
    hasAttentionItems,
    attentionCount,
    convertedCtaItem
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
 * Computes difference summary between live (or legacy) and draft items for publication confirmation.
 */
export function computeNavigationPublishDiff(
  liveItems: readonly SiteNavigationItem[],
  draftItems: readonly SiteNavigationItem[],
  isFirstAdoptionFromLegacy = false
): NavigationPublishDiffSummary {
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
    isFirstAdoptionFromLegacy,
    changeDescriptions
  };
}

/**
 * Determine authority state for a given menu scope.
 */
export function getNavigationScopeAuthority(
  state: SiteNavigationUiState | null | undefined
): NavigationScopeAuthority {
  if (!state || state.status !== 'ready') return 'legacy';
  if (state.isDraft) return 'draft';
  if (state.liveRevision > 0) return 'live';
  return 'legacy';
}

/**
 * Main manager class for Builder Navigation UI state and actions.
 */
export class BuilderNavigationUiManager {
  private activeScope: NavigationMenuScope = 'primary';
  private itemModalState: NavigationItemModalState = {
    isOpen: false,
    mode: 'add',
    itemId: '',
    label: '',
    targetKind: 'homepage',
    targetValue: '',
    visible: true,
    isCta: false,
    errorMessage: null
  };
  private publishModalState: NavigationPublishModalState = {
    isOpen: false,
    menuScope: 'primary',
    summary: null,
    isPublishing: false,
    errorMessage: null
  };

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
      this.notify();
    }
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

  public openAddItemModal() {
    this.itemModalState = {
      isOpen: true,
      mode: 'add',
      itemId: generateNavigationUuid(),
      label: '',
      targetKind: 'homepage',
      targetValue: '',
      visible: true,
      isCta: false,
      errorMessage: null
    };
    this.notify();
  }

  public openEditItemModal(item: SiteNavigationItem) {
    this.itemModalState = {
      isOpen: true,
      mode: 'edit',
      itemId: item.id,
      label: item.label,
      targetKind: item.target_kind,
      targetValue: item.target_kind === 'homepage' ? '' : item.target_value,
      visible: item.visible,
      isCta: item.is_cta,
      errorMessage: null
    };
    this.notify();
  }

  public closeItemModal() {
    this.itemModalState = {
      ...this.itemModalState,
      isOpen: false,
      errorMessage: null
    };
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
    const { mode, itemId, label, targetKind, targetValue, visible, isCta } = this.itemModalState;

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

    const state = this.controller.getState();
    if (state.status !== 'ready') return false;

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
    if (res.success) {
      this.closeItemModal();
      return true;
    } else {
      this.itemModalState.errorMessage = res.error || 'Failed to save navigation item';
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
    if (state.status !== 'ready') return false;

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
    if (state.status !== 'ready') return false;

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
    if (state.status !== 'ready') return false;

    const items = [...state.rawItems];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return false;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Renumber positions
    const normalized = items.map((item, idx) => ({ ...item, position: idx }));
    const res = await this.controller.stageDraft(normalized, context);
    return res.success;
  }

  public async adoptLegacy(
    layout: WebsiteLayout | null | undefined,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      funnels: readonly Funnel[];
      pages: readonly Page[];
      homepageFunnelId?: string | null;
    }
  ): Promise<boolean> {
    const conversion = convertLegacyLayoutToCanonicalDraft(this.activeScope, layout, context);
    const res = await this.controller.stageDraft(conversion.items, context);
    return res.success;
  }

  public openPublishModal() {
    const state = this.controller.getState();
    if (state.status !== 'ready' || !state.isDraft) return;

    // Compute diff summary against live snapshot or legacy
    const isFirstAdoption = state.liveRevision === 0;
    const summary = computeNavigationPublishDiff([], state.rawItems, isFirstAdoption);

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
    this.publishModalState = {
      ...this.publishModalState,
      isOpen: false,
      errorMessage: null
    };
    this.notify();
  }

  public async confirmPublish(context: {
    effectiveRoutes: readonly EffectiveRoute[];
    homepageFunnelId?: string | null;
  }): Promise<boolean> {
    const state = this.controller.getState();
    if (state.status !== 'ready' || !state.isDraft) return false;

    // Verify readiness
    const readiness = checkNavigationPublicationReadiness(state.rawItems, context);
    if (!readiness.ready) {
      this.publishModalState.errorMessage = readiness.message || 'Navigation links cannot be published yet.';
      this.notify();
      return false;
    }

    this.publishModalState.isPublishing = true;
    this.publishModalState.errorMessage = null;
    this.notify();

    const res = await this.publishController.publish(
      state.websiteId,
      state.baseRevision,
      state.draftRevision,
      this.activeScope
    );

    this.publishModalState.isPublishing = false;

    if (res.success) {
      this.closePublishModal();
      // Rehydrate state after publication
      await this.controller.hydrate(state.websiteId, context, this.activeScope);
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
      this.publishModalState.errorMessage = errorMsg;
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
  } else {
    authorityBadgeHtml = `<span class="pb-nav-badge pb-nav-badge-live">Live</span>`;
    authorityCalloutHtml = `
      <div class="pb-nav-callout pb-nav-callout-live" role="status">
        <div style="font-weight: 700; margin-bottom: 4px;">Live Navigation</div>
        <div>Canonical navigation is published and active on your public website (rev ${(state as any).liveRevision}).</div>
      </div>
    `;
  }

  // Conflict / Error Alert
  let errorBannerHtml = '';
  if (state.status === 'ready' && state.errorMessage) {
    const isConflict = state.errorMessage.includes('modified elsewhere') || state.errorMessage.includes('stale');
    errorBannerHtml = `
      <div class="pb-nav-error-banner" role="alert" style="margin: 12px 16px; padding: 12px; border-radius: 8px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; font-size: 0.85rem;">
        <div style="font-weight: 700; margin-bottom: 4px;">${isConflict ? '⚠️ Concurrency Conflict' : 'Navigation Error'}</div>
        <div>${escapeHtmlText(state.errorMessage)}</div>
        ${isConflict ? `<button type="button" class="btn-outline" style="margin-top: 8px; padding: 6px 12px; font-size: 0.75rem; background: #7f1d1d; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="window.reloadBuilderNavigation()">Reload Latest</button>` : ''}
      </div>
    `;
  } else if (state.status === 'error') {
    errorBannerHtml = `
      <div class="pb-nav-error-banner" role="alert" style="margin: 12px 16px; padding: 12px; border-radius: 8px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; font-size: 0.85rem;">
        <div style="font-weight: 700; margin-bottom: 4px;">Failed to Load Navigation</div>
        <div>${escapeHtmlText(state.error)}</div>
        <button type="button" class="btn-outline" style="margin-top: 8px; padding: 6px 12px; font-size: 0.75rem; background: #7f1d1d; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="window.reloadBuilderNavigation()">Retry</button>
      </div>
    `;
  }

  // Action Buttons Bar
  let actionsBarHtml = '';
  if (state.status === 'ready') {
    if (authority === 'legacy') {
      actionsBarHtml = `
        <div class="pb-nav-actions" style="padding: 12px 16px; border-bottom: 1px solid #222; display: flex; gap: 8px;">
          <button type="button" class="btn-primary pb-nav-adopt-btn" style="flex: 1; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.adoptBuilderLegacyNav()">Convert to Editable Navigation</button>
        </div>
      `;
    } else {
      actionsBarHtml = `
        <div class="pb-nav-actions" style="padding: 12px 16px; border-bottom: 1px solid #222; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <button type="button" class="btn-primary" style="padding: 8px 14px; font-size: 0.8rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openAddBuilderNavItemModal()">+ Add Item</button>
          ${state.isDraft ? `
            <button type="button" class="btn-outline" style="padding: 8px 12px; font-size: 0.8rem; font-weight: 700; background: #1e1e1e; border: 1px solid #333; color: #cbd5e1; border-radius: 8px; cursor: pointer;" onclick="window.previewBuilderNavChanges()">Preview</button>
            <button type="button" class="btn-outline" style="padding: 8px 12px; font-size: 0.8rem; font-weight: 700; background: #1e1e1e; border: 1px solid #333; color: #f87171; border-radius: 8px; cursor: pointer;" onclick="window.revertBuilderNavDraft()">Revert</button>
            <button type="button" class="btn-primary" style="padding: 8px 14px; font-size: 0.8rem; font-weight: 700; background: #16a34a; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openPublishBuilderNavModal()">Publish ${activeScope === 'primary' ? 'Primary' : 'Footer'}</button>
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
      // Legacy Read-Only View
      const legacyConversion = convertLegacyLayoutToCanonicalDraft(activeScope, context.layout, context);
      const legacyItems = legacyConversion.items;

      itemsListHtml = `
        <div class="pb-nav-legacy-list" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
          ${legacyItems.length === 0 ? `
            <div style="padding: 24px; text-align: center; background: #161616; border: 1px dashed #333; border-radius: 10px; color: #64748b; font-size: 0.85rem;">
              No links defined in legacy layout.
            </div>
          ` : legacyItems.map((item, idx) => `
            <div class="pb-nav-item-card pb-nav-item-legacy" style="background: #181818; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 700; font-size: 0.88rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlText(item.label)}</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
                  <span class="pb-nav-kind-tag" style="background: #262626; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">${escapeHtmlText(item.target_kind)}</span>
                  <span style="margin-left: 6px;">${escapeHtmlText(item.target_value === '__homepage__' ? '/' : item.target_value)}</span>
                  ${item.is_cta ? `<span style="margin-left: 6px; background: #1e3a8a; color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">CTA</span>` : ''}
                </div>
              </div>
              <span style="font-size: 0.75rem; color: #64748b;">Read-only</span>
            </div>
          `).join('')}
          <div style="margin-top: 10px; text-align: center;">
            <button type="button" class="btn-primary" style="width: 100%; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.adoptBuilderLegacyNav()">Convert to Editable Navigation</button>
          </div>
        </div>
      `;
    } else {
      // Canonical Items List (Draft or Live)
      const items = state.items;
      if (items.length === 0) {
        itemsListHtml = `
          <div class="pb-nav-empty-state" style="padding: 32px 20px; text-align: center; background: #141414; border: 1px dashed #2a2a2a; border-radius: 12px; margin: 16px; color: #94a3b8;">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">📭</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #f1f5f9; margin-bottom: 4px;">Explicit Empty Menu</div>
            <p style="font-size: 0.8rem; line-height: 1.4; margin: 0 0 16px 0; color: #64748b;">This ${activeScope} menu contains 0 links. On the live site, no navigation links will be rendered.</p>
            <button type="button" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem; font-weight: 700; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;" onclick="window.openAddBuilderNavItemModal()">+ Add First Link</button>
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

  // Footer Scope Note if activeScope === 'footer'
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
          <button type="button" role="tab" aria-selected="${activeScope === 'primary'}" class="${activeScope === 'primary' ? 'active' : ''}" style="flex: 1; padding: 8px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 150ms ease; ${activeScope === 'primary' ? 'background: #2563eb; color: white;' : 'background: transparent; color: #94a3b8;'}" onclick="window.setBuilderNavScope('primary')">Primary Menu</button>
          <button type="button" role="tab" aria-selected="${activeScope === 'footer'}" class="${activeScope === 'footer' ? 'active' : ''}" style="flex: 1; padding: 8px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 150ms ease; ${activeScope === 'footer' ? 'background: #2563eb; color: white;' : 'background: transparent; color: #94a3b8;'}" onclick="window.setBuilderNavScope('footer')">Footer Menu</button>
        </div>
      </div>

      ${authorityCalloutHtml}
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
 * Render individual navigation item card with reordering, visibility, edit, and delete actions.
 */
export function renderNavigationItemCard(
  item: ResolvedNavigationItem,
  index: number,
  totalItems: number,
  isSaving: boolean
): string {
  // Target description formatting
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

  // Warning badges for route dependencies
  let warningBadgeHtml = '';
  if (item.resolution_status === 'unrouted') {
    warningBadgeHtml = `<div style="margin-top: 4px; font-size: 0.75rem; color: #fbbf24; font-weight: 600;">⚠️ Unrouted Destination</div>`;
  } else if (item.resolution_status === 'pending_deletion') {
    warningBadgeHtml = `<div style="margin-top: 4px; font-size: 0.75rem; color: #f87171; font-weight: 600;">⛔ URL pending removal</div>`;
  }

  return `
    <div class="pb-nav-item-card ${!item.visible ? 'pb-nav-item-hidden' : ''}" style="background: ${item.visible ? '#1a1a1a' : '#141414'}; border: 1px solid ${item.visible ? '#2a2a2a' : '#222'}; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; opacity: ${item.visible ? '1' : '0.6'}; transition: all 150ms ease;">
      <!-- Row Top: Drag/Reorder buttons + Title + Badges -->
      <div style="display: flex; align-items: center; gap: 10px; justify-content: space-between;">
        <!-- Reorder buttons -->
        <div style="display: flex; gap: 4px;">
          <button type="button" aria-label="Move item up" class="btn-outline" style="padding: 4px 8px; font-size: 0.7rem; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 4px; cursor: pointer;" onclick="window.moveBuilderNavItem('${escapeHtmlText(item.id)}', 'up')" ${index === 0 || isSaving ? 'disabled' : ''}>▲</button>
          <button type="button" aria-label="Move item down" class="btn-outline" style="padding: 4px 8px; font-size: 0.7rem; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 4px; cursor: pointer;" onclick="window.moveBuilderNavItem('${escapeHtmlText(item.id)}', 'down')" ${index === totalItems - 1 || isSaving ? 'disabled' : ''}>▼</button>
        </div>

        <div style="flex: 1; min-width: 0;">
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

        <!-- Row Actions: Hide/Show, Edit, Remove -->
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" aria-label="${item.visible ? 'Hide item' : 'Show item'}" class="btn-outline" style="padding: 6px 10px; font-size: 0.75rem; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 6px; cursor: pointer;" onclick="window.toggleBuilderNavItemVisibility('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>${item.visible ? 'Hide' : 'Show'}</button>
          <button type="button" aria-label="Edit item" class="btn-outline" style="padding: 6px 10px; font-size: 0.75rem; background: #222; color: #93c5fd; border: 1px solid #1e3a8a; border-radius: 6px; cursor: pointer;" onclick="window.openEditBuilderNavItemModal('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>Edit</button>
          <button type="button" aria-label="Remove item" class="btn-outline" style="padding: 6px 10px; font-size: 0.75rem; background: #222; color: #f87171; border: 1px solid #7f1d1d; border-radius: 6px; cursor: pointer;" onclick="window.removeBuilderNavItem('${escapeHtmlText(item.id)}')" ${isSaving ? 'disabled' : ''}>Remove</button>
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
  context: NavigationUiContext
): string {
  if (!modalState.isOpen) return '';

  const { mode, label, targetKind, targetValue, visible, isCta, errorMessage } = modalState;

  // Available routeable destinations
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
    <div class="pb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nav-item-modal-title" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
      <div class="pb-modal-card" style="background: #181818; border: 1px solid #333; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); overflow: hidden; display: flex; flex-direction: column;">
        <!-- Modal Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #282828; display: flex; align-items: center; justify-content: space-between;">
          <h3 id="nav-item-modal-title" style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">${mode === 'add' ? 'Add Navigation Item' : 'Edit Navigation Item'}</h3>
          <button type="button" aria-label="Close dialog" onclick="window.closeBuilderNavItemModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 4px;">✕</button>
        </div>

        <!-- Modal Body -->
        <form onsubmit="event.preventDefault(); window.saveBuilderNavItemModal();" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
          ${errorMessage ? `
            <div role="alert" style="padding: 10px 14px; background: #450a0a; border: 1px solid #991b1b; color: #fecaca; border-radius: 8px; font-size: 0.85rem;">
              ${escapeHtmlText(errorMessage)}
            </div>
          ` : ''}

          <!-- Label -->
          <div>
            <label for="nav-item-label-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Menu Label *</label>
            <input id="nav-item-label-input" type="text" value="${escapeHtmlText(label)}" required placeholder="e.g. Services, About Us, Book Now" oninput="window.setBuilderNavItemModalField('label', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
          </div>

          <!-- Link Type -->
          <div>
            <label for="nav-item-kind-select" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Link Type</label>
            <select id="nav-item-kind-select" onchange="window.setBuilderNavItemModalField('targetKind', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem; cursor: pointer;">
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
              <select id="nav-item-target-select" onchange="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem; cursor: pointer;">
                <option value="">-- Select a page destination --</option>
                ${internalOptions}
              </select>
            </div>
          ` : targetKind === 'external' ? `
            <div>
              <label for="nav-item-external-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">External URL *</label>
              <input id="nav-item-external-input" type="url" value="${escapeHtmlText(targetValue)}" placeholder="https://example.com/pricing" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
              <small style="display: block; margin-top: 4px; color: #64748b; font-size: 0.75rem;">Must be a standard http:// or https:// URL.</small>
            </div>
          ` : targetKind === 'phone' ? `
            <div>
              <label for="nav-item-phone-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Phone Number *</label>
              <input id="nav-item-phone-input" type="tel" value="${escapeHtmlText(targetValue)}" placeholder="+1 (555) 234-5678" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
            </div>
          ` : `
            <div>
              <label for="nav-item-email-input" style="display: block; font-size: 0.8rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address *</label>
              <input id="nav-item-email-input" type="email" value="${escapeHtmlText(targetValue)}" placeholder="contact@washops.com" oninput="window.setBuilderNavItemModalField('targetValue', this.value)" style="width: 100%; padding: 10px 12px; background: #111; border: 1px solid #333; border-radius: 8px; color: #f8fafc; font-size: 0.9rem;">
            </div>
          `}

          <!-- Presentation & Visibility Toggles -->
          <div style="display: flex; gap: 20px; padding: 10px 0; border-top: 1px solid #262626;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; cursor: pointer;">
              <input type="checkbox" ${isCta ? 'checked' : ''} onchange="window.setBuilderNavItemModalField('isCta', this.checked)" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
              Show as CTA button
            </label>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; cursor: pointer;">
              <input type="checkbox" ${visible ? 'checked' : ''} onchange="window.setBuilderNavItemModalField('visible', this.checked)" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
              Visible in menu
            </label>
          </div>

          <!-- Footer Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;">
            <button type="button" class="btn-outline" onclick="window.closeBuilderNavItemModal()" style="padding: 10px 16px; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Cancel</button>
            <button type="submit" class="btn-primary" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">${mode === 'add' ? 'Add Item' : 'Save Changes'}</button>
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
    <div class="pb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nav-publish-modal-title" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
      <div class="pb-modal-card" style="background: #181818; border: 1px solid #333; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); overflow: hidden; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #282828; display: flex; align-items: center; justify-content: space-between;">
          <h3 id="nav-publish-modal-title" style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">Publish ${escapeHtmlText(scopeLabel)}</h3>
          <button type="button" aria-label="Close dialog" onclick="window.closePublishBuilderNavModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 4px;">✕</button>
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
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
            <button type="button" class="btn-outline" onclick="window.closePublishBuilderNavModal()" ${isPublishing ? 'disabled' : ''} style="padding: 10px 16px; background: #222; color: #cbd5e1; border: 1px solid #333; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Cancel</button>
            <button type="button" class="btn-primary" onclick="window.confirmPublishBuilderNav()" ${isPublishing ? 'disabled' : ''} style="padding: 10px 20px; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ${isPublishing ? 'Publishing...' : `Publish ${scopeLabel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
