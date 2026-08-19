import { describe, it, expect } from 'vitest';
import {
  validateNavigationLabel,
  validateExternalUrl,
  validatePhoneTarget,
  validateEmailTarget,
  validateNavigationItem,
  validateAndNormalizeNavigationItems,
  areNavigationSnapshotsEqual,
  resolveNavigationItem,
  resolveEffectiveNavigation,
  SiteNavigationItem
} from './builder_site_navigation_domain';
import type { EffectiveRoute } from './builder_route_lifecycle';

describe('builder_site_navigation_domain', () => {
  describe('label validation', () => {
    it('accepts clean labels and preserves casing and spaces', () => {
      const res = validateNavigationLabel('  Services & Pricing  ');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('Services & Pricing');
    });

    it('rejects blank labels', () => {
      expect(validateNavigationLabel('').valid).toBe(false);
      expect(validateNavigationLabel('   ').valid).toBe(false);
      expect(validateNavigationLabel(null).valid).toBe(false);
    });

    it('rejects overly long labels', () => {
      const long = 'A'.repeat(101);
      expect(validateNavigationLabel(long).valid).toBe(false);
    });

    it('rejects control characters in labels', () => {
      expect(validateNavigationLabel('Services\u0000').valid).toBe(false);
      expect(validateNavigationLabel('About\nUs').valid).toBe(false);
    });
  });

  describe('external URL validation', () => {
    it('accepts valid https and http URLs', () => {
      expect(validateExternalUrl('https://example.com/pricing').valid).toBe(true);
      expect(validateExternalUrl('http://example.org/about').valid).toBe(true);
    });

    it('rejects unsafe schemes', () => {
      expect(validateExternalUrl('javascript:alert(1)').valid).toBe(false);
      expect(validateExternalUrl('data:text/html,test').valid).toBe(false);
      expect(validateExternalUrl('file:///etc/passwd').valid).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(validateExternalUrl('not-a-url').valid).toBe(false);
      expect(validateExternalUrl('https://').valid).toBe(false);
    });
  });

  describe('phone target validation', () => {
    it('accepts and normalizes phone numbers with international +', () => {
      const res = validatePhoneTarget('+1 (555) 234-5678');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('+15552345678');
    });

    it('accepts local numbers without +', () => {
      const res = validatePhoneTarget('(555) 234-5678');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('5552345678');
    });

    it('rejects invalid or unsafe phone values', () => {
      expect(validatePhoneTarget('').valid).toBe(false);
      expect(validatePhoneTarget('call-me-maybe').valid).toBe(false);
      expect(validatePhoneTarget('+12\u000034').valid).toBe(false);
    });
  });

  describe('email target validation', () => {
    it('accepts and normalizes valid email addresses', () => {
      const res = validateEmailTarget(' Contact@WashOps.com ');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('contact@washops.com');
    });

    it('rejects invalid or unsafe email strings', () => {
      expect(validateEmailTarget('').valid).toBe(false);
      expect(validateEmailTarget('not-an-email').valid).toBe(false);
      expect(validateEmailTarget('user@domain\n.com').valid).toBe(false);
    });
  });

  describe('validateNavigationItem and validateAndNormalizeNavigationItems', () => {
    it('validates a complete valid internal item', () => {
      const res = validateNavigationItem({
        id: 'item-1',
        label: 'Services',
        target_kind: 'internal',
        target_value: 'fnl-123',
        position: 0,
        visible: true,
        is_cta: false
      });
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.item.target_value).toBe('fnl-123');
        expect(res.item.is_cta).toBe(false);
      }
    });

    it('allows CTA presentation independently of target kind', () => {
      const ctaPhone = validateNavigationItem({
        id: 'item-cta',
        label: 'Call Now',
        target_kind: 'phone',
        target_value: '+15551234567',
        position: 1,
        visible: true,
        is_cta: true
      });
      expect(ctaPhone.valid).toBe(true);
      if (ctaPhone.valid) {
        expect(ctaPhone.item.is_cta).toBe(true);
        expect(ctaPhone.item.target_kind).toBe('phone');
      }
    });

    it('handles hidden items correctly', () => {
      const hidden = validateNavigationItem({
        id: 'item-hidden',
        label: 'Secret Page',
        target_kind: 'internal',
        target_value: 'fnl-sec',
        position: 2,
        visible: false,
        is_cta: false
      });
      expect(hidden.valid).toBe(true);
      if (hidden.valid) {
        expect(hidden.item.visible).toBe(false);
      }
    });

    it('enforces contiguous deterministic ordering and unique IDs', () => {
      const rawList = [
        { id: 'a', label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 99, visible: true, is_cta: false },
        { id: 'b', label: 'Services', target_kind: 'internal', target_value: 'fnl-serv', position: 4, visible: true, is_cta: false },
        { id: 'c', label: 'Contact', target_kind: 'phone', target_value: '5551234567', position: 0, visible: true, is_cta: true }
      ];

      const res = validateAndNormalizeNavigationItems(rawList);
      expect(res.valid).toBe(true);
      expect(res.items.map(i => i.position)).toEqual([0, 1, 2]);
    });

    it('rejects duplicate item IDs', () => {
      const dupes = [
        { id: 'dupe-id', label: 'Link 1', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false },
        { id: 'dupe-id', label: 'Link 2', target_kind: 'internal', target_value: 'fnl-2', position: 1, visible: true, is_cta: false }
      ];
      const res = validateAndNormalizeNavigationItems(dupes);
      expect(res.valid).toBe(false);
      expect(res.code).toBe('DUPLICATE_ID');
    });
  });

  describe('areNavigationSnapshotsEqual', () => {
    it('returns true for identical snapshots and false for any variation', () => {
      const snapA: SiteNavigationItem[] = [
        { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false }
      ];
      const snapB: SiteNavigationItem[] = [
        { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false }
      ];
      expect(areNavigationSnapshotsEqual(snapA, snapB)).toBe(true);

      const modified: SiteNavigationItem[] = [
        { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: true }
      ];
      expect(areNavigationSnapshotsEqual(snapA, modified)).toBe(false);
    });
  });

  describe('Route resolution and stable identity', () => {
    const effectiveRoutes: EffectiveRoute[] = [
      {
        id: 'r-1',
        website_id: 'site-1',
        funnel_id: 'fnl-home',
        path: '/',
        live_path: '/',
        draft_path: null,
        is_draft_override: false,
        is_new_draft: false,
        is_staged_delete: false
      },
      {
        id: 'r-2',
        website_id: 'site-1',
        funnel_id: 'fnl-services',
        path: '/pressure-washing', // Staged rename
        live_path: '/services',
        draft_path: '/pressure-washing',
        is_draft_override: true,
        is_new_draft: false,
        is_staged_delete: false
      },
      {
        id: 'r-3',
        website_id: 'site-1',
        funnel_id: 'fnl-old',
        path: '/old-page',
        live_path: '/old-page',
        draft_path: null,
        is_draft_override: false,
        is_new_draft: false,
        is_staged_delete: true // Scheduled for removal
      }
    ];

    it('resolves homepage funnel target to "/" without hardcoding path', () => {
      const item: SiteNavigationItem = {
        id: 'nav-home',
        label: 'Home',
        target_kind: 'internal',
        target_value: 'fnl-home',
        position: 0,
        visible: true,
        is_cta: false
      };

      const resolved = resolveNavigationItem(item, {
        effectiveRoutes,
        homepageFunnelId: 'fnl-home'
      });
      expect(resolved.resolution_status).toBe('resolved');
      expect(resolved.resolved_href).toBe('/');
    });

    it('automatically reflects route renames through stable destination identity', () => {
      const item: SiteNavigationItem = {
        id: 'nav-services',
        label: 'Services',
        target_kind: 'internal',
        target_value: 'fnl-services',
        position: 1,
        visible: true,
        is_cta: false
      };

      const resolved = resolveNavigationItem(item, {
        effectiveRoutes,
        homepageFunnelId: 'fnl-home'
      });
      expect(resolved.resolution_status).toBe('resolved');
      expect(resolved.resolved_href).toBe('/pressure-washing');
    });

    it('identifies target route scheduled for deletion as pending_deletion', () => {
      const item: SiteNavigationItem = {
        id: 'nav-old',
        label: 'Old Page',
        target_kind: 'internal',
        target_value: 'fnl-old',
        position: 2,
        visible: true,
        is_cta: false
      };

      const resolved = resolveNavigationItem(item, {
        effectiveRoutes,
        homepageFunnelId: 'fnl-home'
      });
      expect(resolved.resolution_status).toBe('pending_deletion');
      expect(resolved.resolved_href).toBeNull();
    });

    it('identifies missing/unrouted destinations explicitly', () => {
      const item: SiteNavigationItem = {
        id: 'nav-missing',
        label: 'Ghost Page',
        target_kind: 'internal',
        target_value: 'fnl-nonexistent',
        position: 3,
        visible: true,
        is_cta: false
      };

      const resolved = resolveNavigationItem(item, {
        effectiveRoutes,
        homepageFunnelId: 'fnl-home'
      });
      expect(resolved.resolution_status).toBe('unrouted');
      expect(resolved.resolved_href).toBeNull();
    });

    it('resolves phone, email, and external links directly to valid URIs', () => {
      const items: SiteNavigationItem[] = [
        { id: '1', label: 'Call', target_kind: 'phone', target_value: '+15551234567', position: 0, visible: true, is_cta: true },
        { id: '2', label: 'Email', target_kind: 'email', target_value: 'info@washops.com', position: 1, visible: true, is_cta: false },
        { id: '3', label: 'Blog', target_kind: 'external', target_value: 'https://washops.blog', position: 2, visible: true, is_cta: false }
      ];

      const resolved = resolveEffectiveNavigation(items, { effectiveRoutes });
      expect(resolved[0].resolved_href).toBe('tel:+15551234567');
      expect(resolved[1].resolved_href).toBe('mailto:info@washops.com');
      expect(resolved[2].resolved_href).toBe('https://washops.blog');
    });
  });
});
