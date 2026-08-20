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
  resolvePublicNavigation,
  SiteNavigationItem
} from './builder_site_navigation_domain';
import type { EffectiveRoute } from './builder_route_lifecycle';

describe('builder_site_navigation_domain', () => {
  const uuid1 = '11111111-1111-4111-8111-111111111111';
  const uuid2 = '22222222-2222-4222-8222-222222222222';
  const uuid3 = '33333333-3333-4333-8333-333333333333';
  const uuid4 = '44444444-4444-4444-8444-444444444444';
  const uuid5 = '55555555-5555-4555-8555-555555555555';

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
      expect(validateExternalUrl('https://example.com').normalized).toBe('https://example.com/');
      expect(validateExternalUrl('HTTPS://EXAMPLE.COM').normalized).toBe('https://example.com/');
      expect(validateExternalUrl('http://example.com:0080/').normalized).toBe('http://example.com/');
      expect(validateExternalUrl('https://example.com:00443/').normalized).toBe('https://example.com/');
      expect(validateExternalUrl('https://example.com:0/').normalized).toBe('https://example.com:0/');
      expect(validateExternalUrl('https://example.com:65535/').normalized).toBe('https://example.com:65535/');
      expect(validateExternalUrl('https://1.2.3.4/').normalized).toBe('https://1.2.3.4/');
      expect(validateExternalUrl('https://127.0.0.1/').normalized).toBe('https://127.0.0.1/');
      expect(validateExternalUrl('https://127.1/').normalized).toBe('https://127.0.0.1/');
      expect(validateExternalUrl('https://127.0.0.01/').normalized).toBe('https://127.0.0.1/');
    });

    it('rejects unsafe schemes', () => {
      expect(validateExternalUrl('javascript:alert(1)').valid).toBe(false);
      expect(validateExternalUrl('data:text/html,test').valid).toBe(false);
      expect(validateExternalUrl('file:///etc/passwd').valid).toBe(false);
    });

    it('rejects malformed URLs and out-of-range ports', () => {
      expect(validateExternalUrl('not-a-url').valid).toBe(false);
      expect(validateExternalUrl('https://').valid).toBe(false);
      expect(validateExternalUrl('https://example.com:65536/').valid).toBe(false);
      expect(validateExternalUrl('https://example.com:999999999/').valid).toBe(false);
    });

    it('rejects unsupported URL profile features (credentials, IPv6, IDN, raw whitespace, invalid IPv4)', () => {
      expect(validateExternalUrl('https://user:pass@example.com').valid).toBe(false);
      expect(validateExternalUrl('https://[2001:db8::1]/').valid).toBe(false);
      expect(validateExternalUrl('https://münich.example/').valid).toBe(false);
      expect(validateExternalUrl('https://xn--mnich-kva.example/').valid).toBe(false);
      expect(validateExternalUrl('https://example .com').valid).toBe(false);
      expect(validateExternalUrl('https://999.999.999.999/').valid).toBe(false);
    });
  });

  describe('phone target validation', () => {
    it('accepts and normalizes phone numbers with international +', () => {
      const res = validatePhoneTarget('+1 (555) 234-5678');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('+1 (555) 234-5678');
    });

    it('accepts local numbers without +', () => {
      const res = validatePhoneTarget('(555) 234-5678');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('(555) 234-5678');
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
    it('validates a complete valid internal item with UUID', () => {
      const res = validateNavigationItem({
        id: uuid1,
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

    it('rejects non-UUID item IDs', () => {
      const res = validateNavigationItem({
        id: 'not-a-uuid',
        label: 'Services',
        target_kind: 'internal',
        target_value: 'fnl-123',
        position: 0,
        visible: true,
        is_cta: false
      });
      expect(res.valid).toBe(false);
      expect(res.code).toBe('INVALID_ID');
    });

    it('rejects fractional positions', () => {
      const res = validateNavigationItem({
        id: uuid1,
        label: 'Services',
        target_kind: 'internal',
        target_value: 'fnl-123',
        position: 0.5,
        visible: true,
        is_cta: false
      });
      expect(res.valid).toBe(false);
      expect(res.code).toBe('INVALID_POSITION');
    });

    it('allows CTA presentation independently of target kind', () => {
      const ctaPhone = validateNavigationItem({
        id: uuid2,
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
        id: uuid3,
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
        { id: uuid1, label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 99, visible: true, is_cta: false },
        { id: uuid2, label: 'Services', target_kind: 'internal', target_value: 'fnl-serv', position: 4, visible: true, is_cta: false },
        { id: uuid3, label: 'Contact', target_kind: 'phone', target_value: '+15551234567', position: 0, visible: true, is_cta: true }
      ];

      const res = validateAndNormalizeNavigationItems(rawList);
      expect(res.valid).toBe(true);
      expect(res.items.map(i => i.position)).toEqual([0, 1, 2]);
    });

    it('rejects duplicate item IDs', () => {
      const dupes = [
        { id: uuid1, label: 'Link 1', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false },
        { id: uuid1, label: 'Link 2', target_kind: 'internal', target_value: 'fnl-2', position: 1, visible: true, is_cta: false }
      ];
      const res = validateAndNormalizeNavigationItems(dupes);
      expect(res.valid).toBe(false);
      expect(res.code).toBe('DUPLICATE_ID');
    });
  });

  describe('areNavigationSnapshotsEqual', () => {
    it('returns true for identical snapshots and false for any variation', () => {
      const snapA: SiteNavigationItem[] = [
        { id: uuid1, label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false }
      ];
      const snapB: SiteNavigationItem[] = [
        { id: uuid1, label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: false }
      ];
      expect(areNavigationSnapshotsEqual(snapA, snapB)).toBe(true);

      const modified: SiteNavigationItem[] = [
        { id: uuid1, label: 'Home', target_kind: 'internal', target_value: 'fnl-1', position: 0, visible: true, is_cta: true }
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
        id: uuid1,
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
        id: uuid2,
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
        id: uuid3,
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
        id: uuid4,
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
        { id: uuid1, label: 'Call', target_kind: 'phone', target_value: '+15551234567', position: 0, visible: true, is_cta: true },
        { id: uuid2, label: 'Email', target_kind: 'email', target_value: 'info@washops.com', position: 1, visible: true, is_cta: false },
        { id: uuid3, label: 'Blog', target_kind: 'external', target_value: 'https://washops.blog', position: 2, visible: true, is_cta: false }
      ];

      const resolved = resolveEffectiveNavigation(items, { effectiveRoutes });
      expect(resolved[0].resolved_href).toBe('tel:+15551234567');
      expect(resolved[1].resolved_href).toBe('mailto:info@washops.com');
      expect(resolved[2].resolved_href).toBe('https://washops.blog');
    });

    it('validates and resolves target_kind: homepage dynamically to /', () => {
      const itemRes = validateNavigationItem({
        id: uuid1,
        label: 'Home',
        target_kind: 'homepage',
        target_value: '',
        position: 0,
        visible: true,
        is_cta: false
      });
      expect(itemRes.valid).toBe(true);
      if (!itemRes.valid) return;

      expect(itemRes.item.target_value).toBe('__homepage__');

      const resolved = resolveNavigationItem(itemRes.item, {
        effectiveRoutes,
        homepageFunnelId: 'fnl-custom-home'
      });
      expect(resolved.resolved_href).toBe('/');
      expect(resolved.resolution_status).toBe('resolved');
    });
  });

  describe('resolvePublicNavigation', () => {
    it('omits hidden items and resolves live routes and homepage safely', () => {
      const items: SiteNavigationItem[] = [
        { id: uuid1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: uuid2, label: 'Services', target_kind: 'internal', target_value: 'fnl-services', position: 1, visible: true, is_cta: false },
        { id: uuid3, label: 'Hidden Secret', target_kind: 'internal', target_value: 'fnl-secret', position: 2, visible: false, is_cta: false },
        { id: uuid4, label: 'Ghost Unrouted', target_kind: 'internal', target_value: 'fnl-unrouted', position: 3, visible: true, is_cta: false },
        { id: uuid5, label: 'Book Now', target_kind: 'phone', target_value: '+15551234567', position: 4, visible: true, is_cta: true }
      ];

      const liveRoutes = [
        { funnel_id: 'fnl-services', path: '/our-services' },
        { funnel_id: 'fnl-secret', path: '/secret' }
      ];

      const links = resolvePublicNavigation(items, {
        liveRoutes,
        homepageFunnelId: 'fnl-home'
      });

      expect(links).toEqual([
        { label: 'Home', path: '/' },
        { label: 'Services', path: '/our-services' },
        { label: 'Book Now', path: 'tel:+15551234567', is_cta: true }
      ]);
    });
  });
});
