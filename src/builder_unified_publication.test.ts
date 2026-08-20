import { describe, it, expect } from 'vitest';
import { renderUnifiedPublishModal } from './builder_unified_publication_ui';
import type { UnifiedPublishState } from './builder_unified_publication_controller';
import type { WebsitePublishPlan } from './builder_unified_publication';

describe('Builder Unified Publication UI', () => {
  it('returns empty string when modal is not open', () => {
    const state: UnifiedPublishState = {
      status: 'idle',
      websiteId: null,
      plan: null,
      result: null,
      errorMessage: null,
      errorCode: null,
      isOpen: false
    };

    expect(renderUnifiedPublishModal(state)).toBe('');
  });

  it('renders loading spinner when state is loading_plan', () => {
    const state: UnifiedPublishState = {
      status: 'loading_plan',
      websiteId: 'web-1',
      plan: null,
      result: null,
      errorMessage: null,
      errorCode: null,
      isOpen: true
    };

    const html = renderUnifiedPublishModal(state);
    expect(html).toContain('Analyzing unpublished website changes…');
    expect(html).toContain('disabled');
  });

  it('renders conflict banner with reload button when state is conflict', () => {
    const state: UnifiedPublishState = {
      status: 'conflict',
      websiteId: 'web-1',
      plan: null,
      result: null,
      errorMessage: 'Website changes were updated elsewhere.',
      errorCode: 'CONFLICT',
      isOpen: true
    };

    const html = renderUnifiedPublishModal(state);
    expect(html).toContain('Website Changes Updated Elsewhere');
    expect(html).toContain('Refresh Publish Summary');
  });

  it('renders multi-domain summary when plan is ready', () => {
    const plan: WebsitePublishPlan = {
      website_id: 'web-1',
      publication_revision: 2,
      has_pending_changes: true,
      pending_domains: ['homepage', 'routes', 'primary_navigation'],
      expected_state: {
        publication_revision: 2,
        homepage: { draft_funnel_id: 'fn-2', live_funnel_id: 'fn-1' },
        route_draft_ids: ['rd-1'],
        primary_navigation: { is_draft: true, base_revision: 1, draft_revision: 2, live_revision: 1 },
        footer_navigation: { is_draft: false, base_revision: 0, draft_revision: 0, live_revision: 1 },
        page_drafts: []
      },
      summary: {
        homepage: { changed: true, current_live: 'Old Home', next_live: 'New Home' },
        routes: {
          has_changes: true,
          creates: [{ id: 'rd-1', path: '/services', funnel_id: 'fn-3' }],
          updates: [],
          deletes: []
        },
        primary_navigation: { has_changes: true, item_count: 4, is_empty: false },
        footer_navigation: { has_changes: false, item_count: 2, is_empty: false },
        pages: { has_changes: false, count: 0, items: [] }
      },
      blockers: [],
      warnings: [],
      is_publishable: true
    };

    const state: UnifiedPublishState = {
      status: 'ready',
      websiteId: 'web-1',
      plan,
      result: null,
      errorMessage: null,
      errorCode: null,
      isOpen: true
    };

    const html = renderUnifiedPublishModal(state);
    expect(html).toContain('Homepage will change to "New Home"');
    expect(html).toContain('+1 new URLs');
    expect(html).toContain('4 items in draft');
    expect(html).toContain('Publish Website');
    expect(html).toContain('All listed changes will go live together in one atomic transaction.');
  });

  it('renders blockers and disables publish when plan has blockers', () => {
    const plan: WebsitePublishPlan = {
      website_id: 'web-1',
      publication_revision: 1,
      has_pending_changes: true,
      pending_domains: ['primary_navigation'],
      expected_state: {
        publication_revision: 1,
        homepage: { draft_funnel_id: null, live_funnel_id: 'fn-1' },
        route_draft_ids: [],
        primary_navigation: { is_draft: true, base_revision: 0, draft_revision: 1, live_revision: 0 },
        footer_navigation: { is_draft: false, base_revision: 0, draft_revision: 0, live_revision: 0 },
        page_drafts: []
      },
      summary: {
        homepage: { changed: false, current_live: 'Home', next_live: 'Home' },
        routes: { has_changes: false, creates: [], updates: [], deletes: [] },
        primary_navigation: { has_changes: true, item_count: 1, is_empty: false },
        footer_navigation: { has_changes: false, item_count: 0, is_empty: true },
        pages: { has_changes: false, count: 0, items: [] }
      },
      blockers: [
        {
          domain: 'primary_navigation',
          code: 'NAV_TARGET_UNROUTED',
          message: 'Primary navigation link "Services" points to a destination without a public route.'
        }
      ],
      warnings: [],
      is_publishable: false
    };

    const state: UnifiedPublishState = {
      status: 'blocked',
      websiteId: 'web-1',
      plan,
      result: null,
      errorMessage: null,
      errorCode: null,
      isOpen: true
    };

    const html = renderUnifiedPublishModal(state);
    expect(html).toContain('Primary navigation link &quot;Services&quot; points to a destination without a public route.');
    expect(html).toContain('disabled');
  });
});
