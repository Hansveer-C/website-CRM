import type { PublicSitePayload } from '../supabase/functions/_shared/public_site_contract';

export interface PublicSiteRenderModel {
  website: {
    id: string;
    name: string;
    domain?: string;
    subdomain?: string;
  };
  route: {
    id: string;
    website_id: string;
    path: string;
    funnel_id: string;
  };
  settings: {
    business_name: string;
    phone?: string;
    sms_number?: string;
    email?: string;
    logo_url?: string;
    primary_color?: string;
    facebook_pixel_id?: string;
    gtm_id?: string;
    ga4_measurement_id?: string;
  };
  layout: {
    header_config: Record<string, unknown>;
    footer_config: Record<string, unknown>;
  };
  page: {
    id: string;
    name: string;
    slug: string;
    seo_title: string;
    seo_description: string;
    seo_keywords: string[];
  };
  sections: Array<{
    id: string;
    page_id: string;
    type: string;
    order: number;
    variant?: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
  }>;
}
function clone<T>(value: T): T {
  return structuredClone(value);
}

export function adaptPublicSitePayload(payload: PublicSitePayload): PublicSiteRenderModel {
  const settings = payload.settings;
  const header = payload.layout.header;
  const footer = payload.layout.footer;
  return {
    website: {
      id: payload.website.id,
      name: payload.website.name,
      ...(payload.website.domain ? { domain: payload.website.domain } : {}),
      ...(payload.website.subdomain ? { subdomain: payload.website.subdomain } : {})
    },
    route: {
      id: payload.route.id,
      website_id: payload.route.websiteId,
      path: payload.route.path,
      funnel_id: payload.route.funnelId
    },
    settings: {
      business_name: settings.businessName,
      ...(settings.phone ? { phone: settings.phone, sms_number: settings.phone } : {}),
      ...(settings.email ? { email: settings.email } : {}),
      ...(settings.logoUrl ? { logo_url: settings.logoUrl } : {}),
      ...(settings.primaryColor ? { primary_color: settings.primaryColor } : {}),
      ...(settings.facebookPixelId ? { facebook_pixel_id: settings.facebookPixelId } : {}),
      ...(settings.gtmId ? { gtm_id: settings.gtmId } : {}),
      ...(settings.ga4MeasurementId ? { ga4_measurement_id: settings.ga4MeasurementId } : {})
    },
    layout: {
      header_config: {
        ...(header.logoText ? { logo_text: header.logoText } : {}),
        ...(header.logoUrl ? { logo_url: header.logoUrl } : {}),
        nav_items: clone(header.navigation),
        ...(header.ctaText ? { cta_text: header.ctaText } : {}),
        ...(header.ctaLink ? { cta_link: header.ctaLink } : {})
      },
      footer_config: {
        ...(footer.businessName ? { business_name: footer.businessName } : {}),
        ...(footer.phone ? { phone_number: footer.phone } : {}),
        ...(footer.email ? { email: footer.email } : {}),
        ...(footer.serviceArea ? { service_area: footer.serviceArea } : {}),
        ...(footer.ctaText ? { cta_text: footer.ctaText } : {}),
        links: clone(footer.links)
      }
    },
    page: {
      id: payload.page.id,
      name: payload.page.name,
      slug: payload.page.slug,
      seo_title: payload.page.seoTitle || '',
      seo_description: payload.page.seoDescription || '',
      seo_keywords: payload.page.seoKeywords
        ? payload.page.seoKeywords.split(',').map(value => value.trim()).filter(Boolean)
        : []
    },
    sections: payload.sections
      .map((section, inputIndex) => ({ section, inputIndex }))
      .filter(({ section }) => section.styles.visible !== false)
      .sort((left, right) => left.section.order - right.section.order || left.inputIndex - right.inputIndex)
      .map(({ section }) => ({
        id: section.id,
        page_id: payload.page.id,
        type: section.type,
        order: section.order,
        ...(section.variant ? { variant: section.variant } : {}),
        content: clone(section.content),
        styles: clone(section.styles)
      }))
  };
}
