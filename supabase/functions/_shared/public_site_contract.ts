export interface PublicSiteWebsite {
  id: string;
  name: string;
  domain?: string;
  subdomain?: string;
}

export interface PublicSiteRoute {
  id: string;
  websiteId: string;
  path: string;
  funnelId: string;
}

export interface PublicSiteSettings {
  businessName: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  primaryColor?: string;
  facebookPixelId?: string;
  gtmId?: string;
  ga4MeasurementId?: string;
}

export interface PublicSiteNavigationItem {
  label: string;
  path: string;
  visible?: boolean;
  children?: readonly PublicSiteNavigationItem[];
}

export interface PublicSiteHeader {
  logoText?: string;
  logoUrl?: string;
  navigation: readonly PublicSiteNavigationItem[];
  ctaText?: string;
  ctaLink?: string;
}

export interface PublicSiteFooterLink {
  label: string;
  path: string;
}

export interface PublicSiteFooter {
  businessName?: string;
  phone?: string;
  email?: string;
  serviceArea?: string;
  ctaText?: string;
  links: readonly PublicSiteFooterLink[];
}

export interface PublicSiteLayout {
  header: PublicSiteHeader;
  footer: PublicSiteFooter;
}

export interface PublicSitePage {
  id: string;
  name: string;
  slug: string;
  path: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface PublicSiteSection {
  id: string;
  type: string;
  order: number;
  variant?: string;
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
}

export interface PublicSitePublication {
  source: 'revision' | 'legacy';
  publishedAt?: string;
  fingerprint: string;
}

export interface PublicSitePayload {
  schemaVersion: 1;
  requestedHost: string;
  requestedPath: string;
  website: PublicSiteWebsite;
  route: PublicSiteRoute;
  settings: PublicSiteSettings;
  layout: PublicSiteLayout;
  page: PublicSitePage;
  sections: readonly PublicSiteSection[];
  publication: PublicSitePublication;
}
