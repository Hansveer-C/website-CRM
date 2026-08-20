import type { UnifiedPublishState } from './builder_unified_publication_controller';

export function renderUnifiedPublishModal(state: UnifiedPublishState): string {
  if (!state.isOpen) {
    return '';
  }

  const { status, plan, result, errorMessage } = state;

  let bodyContent = '';
  let ctaButtonHtml = '';

  if (status === 'loading_plan') {
    bodyContent = `
      <div class="pb-publish-loading" style="padding: 32px 16px; text-align: center;">
        <div class="pb-spinner" style="margin: 0 auto 16px; width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: pb-spin 0.8s linear infinite;"></div>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Analyzing unpublished website changes…</p>
      </div>
    `;
    ctaButtonHtml = `
      <button type="button" class="btn btn-primary" disabled style="opacity: 0.6; cursor: not-allowed;">
        Publish Website
      </button>
    `;
  } else if (status === 'conflict') {
    bodyContent = `
      <div class="pb-publish-conflict-banner" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <div style="font-weight: 600; color: #b45309; margin-bottom: 4px;">Website Changes Updated Elsewhere</div>
        <p style="color: #92400e; font-size: 13px; margin: 0 0 12px;">The website drafts were modified in another tab or session. Refresh the publish summary before continuing.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="pb-unified-publish-reload-btn">Refresh Publish Summary</button>
      </div>
    `;
    ctaButtonHtml = `
      <button type="button" class="btn btn-primary" disabled style="opacity: 0.6; cursor: not-allowed;">
        Publish Website
      </button>
    `;
  } else if (status === 'error') {
    bodyContent = `
      <div class="pb-publish-error-banner" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <div style="font-weight: 600; color: #b91c1c; margin-bottom: 4px;">Failed to Prepare Publication</div>
        <p style="color: #991b1b; font-size: 13px; margin: 0;">${escapeHtml(errorMessage || 'An unexpected error occurred.')}</p>
      </div>
    `;
    ctaButtonHtml = `
      <button type="button" class="btn btn-secondary" id="pb-unified-publish-reload-btn">Retry</button>
    `;
  } else if (status === 'success') {
    bodyContent = `
      <div class="pb-publish-success-banner" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 24px 16px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 24px; margin-bottom: 8px;">✓</div>
        <div style="font-weight: 600; color: #15803d; font-size: 16px; margin-bottom: 4px;">Website Published Successfully</div>
        <p style="color: #166534; font-size: 13px; margin: 0;">All draft changes are now live on your website (Revision ${result?.publication_revision || 1}).</p>
      </div>
    `;
    ctaButtonHtml = `
      <button type="button" class="btn btn-primary" id="pb-unified-publish-close-btn">Done</button>
    `;
  } else if (plan) {
    const { summary, blockers, warnings, has_pending_changes, is_publishable } = plan;

    let blockerHtml = '';
    if (blockers.length > 0) {
      blockerHtml = `
        <div class="pb-publish-blockers" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-weight: 600; color: #991b1b; font-size: 13px; margin-bottom: 6px;">Cannot publish until the following issues are resolved:</div>
          <ul style="margin: 0; padding-left: 20px; color: #b91c1c; font-size: 13px;">
            ${blockers.map((b) => `<li>${escapeHtml(b.message)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let warningHtml = '';
    if (warnings.length > 0) {
      warningHtml = `
        <div class="pb-publish-warnings" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
          <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 13px;">
            ${warnings.map((w) => `<li>${escapeHtml(w.message)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Build domain cards
    const pagesDesc = summary.pages.has_changes
      ? `${summary.pages.count} page${summary.pages.count === 1 ? '' : 's'} with unpublished changes`
      : 'No unpublished changes';

    const homepageDesc = summary.homepage.changed
      ? `Homepage will change to "${escapeHtml(summary.homepage.next_live || 'Untitled')}"`
      : 'No change to homepage';

    const routeCreates = summary.routes.creates?.length || 0;
    const routeUpdates = summary.routes.updates?.length || 0;
    const routeDeletes = summary.routes.deletes?.length || 0;
    const routesDesc = summary.routes.has_changes
      ? `${routeCreates ? `+${routeCreates} new ` : ''}${routeUpdates ? `~${routeUpdates} updated ` : ''}${routeDeletes ? `-${routeDeletes} deleted ` : ''}URLs`
      : 'No URL changes';

    const primaryNavDesc = summary.primary_navigation.has_changes
      ? `${summary.primary_navigation.item_count} items in draft`
      : 'No changes';

    const footerNavDesc = summary.footer_navigation.has_changes
      ? `${summary.footer_navigation.item_count} items in draft`
      : 'No changes';

    bodyContent = `
      ${blockerHtml}
      ${warningHtml}

      <div class="pb-publish-domains-summary" style="display: grid; gap: 10px; margin-bottom: 20px;">
        <div class="pb-publish-domain-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">Pages & Content</div>
            <div style="font-size: 12px; color: ${summary.pages.has_changes ? '#0284c7' : '#64748b'};">${pagesDesc}</div>
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${summary.pages.has_changes ? '#0284c7' : '#94a3b8'};">
            ${summary.pages.has_changes ? 'Pending' : 'Live'}
          </span>
        </div>

        <div class="pb-publish-domain-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">Homepage</div>
            <div style="font-size: 12px; color: ${summary.homepage.changed ? '#0284c7' : '#64748b'};">${homepageDesc}</div>
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${summary.homepage.changed ? '#0284c7' : '#94a3b8'};">
            ${summary.homepage.changed ? 'Pending' : 'Live'}
          </span>
        </div>

        <div class="pb-publish-domain-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">URLs & Routes</div>
            <div style="font-size: 12px; color: ${summary.routes.has_changes ? '#0284c7' : '#64748b'};">${routesDesc}</div>
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${summary.routes.has_changes ? '#0284c7' : '#94a3b8'};">
            ${summary.routes.has_changes ? 'Pending' : 'Live'}
          </span>
        </div>

        <div class="pb-publish-domain-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">Primary Navigation</div>
            <div style="font-size: 12px; color: ${summary.primary_navigation.has_changes ? '#0284c7' : '#64748b'};">${primaryNavDesc}</div>
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${summary.primary_navigation.has_changes ? '#0284c7' : '#94a3b8'};">
            ${summary.primary_navigation.has_changes ? 'Pending' : 'Live'}
          </span>
        </div>

        <div class="pb-publish-domain-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">Footer Navigation</div>
            <div style="font-size: 12px; color: ${summary.footer_navigation.has_changes ? '#0284c7' : '#64748b'};">${footerNavDesc}</div>
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${summary.footer_navigation.has_changes ? '#0284c7' : '#94a3b8'};">
            ${summary.footer_navigation.has_changes ? 'Pending' : 'Live'}
          </span>
        </div>
      </div>

      <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
        All listed changes will go live together in one atomic transaction.
      </p>
    `;

    if (!has_pending_changes) {
      ctaButtonHtml = `
        <button type="button" class="btn btn-secondary" id="pb-unified-publish-close-btn">
          Everything is Published
        </button>
      `;
    } else if (status === 'publishing') {
      ctaButtonHtml = `
        <button type="button" class="btn btn-primary" disabled style="opacity: 0.7; cursor: wait;">
          Publishing Website…
        </button>
      `;
    } else if (!is_publishable || blockers.length > 0) {
      ctaButtonHtml = `
        <button type="button" class="btn btn-primary" disabled style="opacity: 0.6; cursor: not-allowed;">
          Publish Website
        </button>
      `;
    } else {
      ctaButtonHtml = `
        <button type="button" class="btn btn-primary" id="pb-unified-publish-confirm-btn">
          Publish Website
        </button>
      `;
    }
  }

  return `
    <div id="pb-unified-publish-modal-overlay" class="pb-modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
      <div class="pb-modal-card" style="background: #ffffff; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); width: 100%; max-width: 520px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f172a;">Publish Website</h3>
          <button type="button" id="pb-unified-publish-close-icon" style="background: none; border: none; font-size: 20px; line-height: 1; color: #94a3b8; cursor: pointer; padding: 4px;">&times;</button>
        </div>
        <div style="padding: 20px;">
          ${bodyContent}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
          <button type="button" class="btn btn-secondary" id="pb-unified-publish-cancel-btn">Cancel</button>
          ${ctaButtonHtml}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
