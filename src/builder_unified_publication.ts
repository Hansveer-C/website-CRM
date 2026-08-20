/**
 * Builder Phase 1B / Task 7 — Unified Publish Website Transaction
 * Domain Types and Contracts
 */

export type WebsitePublishDomain =
  | 'pages'
  | 'homepage'
  | 'routes'
  | 'primary_navigation'
  | 'footer_navigation';

export interface WebsitePublishBlocker {
  domain: WebsitePublishDomain;
  code: string;
  message: string;
}

export interface WebsitePublishWarning {
  domain: WebsitePublishDomain;
  code: string;
  message: string;
}

export interface WebsitePublishNavigationSummary {
  has_changes: boolean;
  item_count: number;
  is_empty: boolean;
}

export interface WebsitePublishRouteSummary {
  has_changes: boolean;
  creates: Array<{ id: string; path: string; funnel_id: string }>;
  updates: Array<{ id: string; route_id: string; path: string; funnel_id: string }>;
  deletes: Array<{ id: string; route_id: string; path: string; funnel_id: string }>;
}

export interface WebsitePublishHomepageSummary {
  changed: boolean;
  current_live: string;
  next_live: string;
}

export interface WebsitePublishPagesSummary {
  has_changes: boolean;
  count: number;
  items: Array<{ page_id: string; name: string; slug: string }>;
}

export interface WebsitePublishSummary {
  homepage: WebsitePublishHomepageSummary;
  routes: WebsitePublishRouteSummary;
  primary_navigation: WebsitePublishNavigationSummary;
  footer_navigation: WebsitePublishNavigationSummary;
  pages: WebsitePublishPagesSummary;
}

export interface WebsitePublishExpectedNavigationState {
  is_draft: boolean;
  base_revision: number;
  draft_revision: number;
  live_revision: number;
}

export interface WebsitePublishExpectedRouteDraft {
  id: string;
  route_id?: string | null;
  action: string;
  path: string;
  funnel_id: string;
}

export interface WebsitePublishExpectedPageState {
  page_id: string;
  save_revision: number;
  document_hash: string;
  current_published_revision_id: string | null;
}

export interface WebsitePublishExpectedState {
  publication_revision: number;
  homepage: {
    draft_funnel_id: string | null;
    live_funnel_id: string | null;
  };
  route_drafts: WebsitePublishExpectedRouteDraft[];
  primary_navigation: WebsitePublishExpectedNavigationState;
  footer_navigation: WebsitePublishExpectedNavigationState;
  pages: WebsitePublishExpectedPageState[];
}

export interface WebsitePublishPlan {
  website_id: string;
  publication_revision: number;
  has_pending_changes: boolean;
  pending_domains: WebsitePublishDomain[];
  expected_state: WebsitePublishExpectedState;
  summary: WebsitePublishSummary;
  blockers: WebsitePublishBlocker[];
  warnings: WebsitePublishWarning[];
  is_publishable: boolean;
}

export type WebsitePublishStatus = 'PUBLISHED' | 'NO_CHANGES';

export interface WebsitePublishResult {
  success: boolean;
  status: WebsitePublishStatus;
  publication_id?: string;
  publication_revision: number;
  published_at?: string;
  summary?: WebsitePublishSummary;
  message?: string;
}

export interface WebsitePublicationRecord {
  id: string;
  website_id: string;
  publication_revision: number;
  published_by: string | null;
  published_at: string;
  expected_state: WebsitePublishExpectedState;
  summary: WebsitePublishSummary;
}
