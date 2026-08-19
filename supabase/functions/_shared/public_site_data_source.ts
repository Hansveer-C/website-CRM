export interface PublicWebsiteRecord {
  id: string;
  ownerId: string;
  name: string;
  domain: string | null;
  subdomain: string | null;
  homepageFunnelId: string | null;
}

export interface PublicWebsiteRouteRecord {
  id: string;
  websiteId: string;
  path: string;
  funnelId: string;
}

export interface PublicPageRecord {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  funnelId: string | null;
  stepOrder: number | null;
}

export interface PublicWebsiteSettingsRecord {
  businessName: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  facebookPixelId: string | null;
  gtmId: string | null;
  ga4MeasurementId: string | null;
}

export interface PublicWebsiteLayoutRecord {
  headerConfig: unknown;
  footerConfig: unknown;
}

export interface PublicPublicationTargetRecord {
  websiteId: string;
  pageId: string;
  publishedRevisionId: string;
  publishedAt: string | null;
}

export interface PublicPublishedRevisionRecord {
  id: string;
  websiteId: string;
  pageId: string;
  schemaVersion: number;
  document: unknown;
  documentFingerprint: string;
}

export interface PublicLegacySectionRecord {
  id: string;
  pageId: string;
  type: string;
  order: number;
  content: unknown;
  styles: unknown;
}

export interface PublicWebsiteRouteRedirectRecord {
  id: string;
  websiteId: string;
  fromPath: string;
  toPath: string;
}

export function mapRedirect(row: Record<string, unknown>): PublicWebsiteRouteRedirectRecord {
  return {
    id: String(row.id ?? ''),
    websiteId: String(row.website_id ?? ''),
    fromPath: String(row.from_path ?? ''),
    toPath: String(row.to_path ?? '')
  };
}

/** Read-only, one-site data boundary. Deliberately exposes no generic query or write operation. */
export interface PublicSiteDataSource {
  findWebsiteByHost(host: string): Promise<PublicWebsiteRecord | null>;
  findRouteForWebsite(websiteId: string, path: string): Promise<PublicWebsiteRouteRecord | null>;
  findRedirectForWebsite?(websiteId: string, path: string): Promise<PublicWebsiteRouteRedirectRecord | null>;
  findPageForRoute(
    website: PublicWebsiteRecord,
    route: PublicWebsiteRouteRecord,
    path: string
  ): Promise<PublicPageRecord | null>;
  getPublicWebsiteSettings(websiteId: string): Promise<PublicWebsiteSettingsRecord | null>;
  getPublicWebsiteLayout(websiteId: string): Promise<PublicWebsiteLayoutRecord | null>;
  getPublicationTarget(websiteId: string, pageId: string): Promise<PublicPublicationTargetRecord | null>;
  getRevisionById(
    revisionId: string,
    websiteId: string,
    pageId: string
  ): Promise<PublicPublishedRevisionRecord | null>;
  getLegacySections(pageId: string): Promise<readonly PublicLegacySectionRecord[]>;
}

export class PublicSiteDataSourceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super('Public-site data source operation failed.');
    this.name = 'PublicSiteDataSourceError';
    this.code = code;
  }
}

interface QueryResult<T> {
  data: T | null;
  error: unknown;
}

interface QueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: unknown): QueryBuilder<T>;
  ilike(column: string, value: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  maybeSingle(): QueryBuilder<T>;
}

export interface PublicSiteSupabaseClient {
  from(table: string): {
    select<T = unknown>(columns: string): QueryBuilder<T>;
  };
}

function mapWebsite(row: Record<string, unknown>): PublicWebsiteRecord {
  return {
    id: String(row.id),
    ownerId: String(row.user_id),
    name: String(row.name),
    domain: typeof row.domain === 'string' ? row.domain : null,
    subdomain: typeof row.subdomain === 'string' ? row.subdomain : null,
    homepageFunnelId: typeof row.homepage_funnel_id === 'string' ? row.homepage_funnel_id : null
  };
}

function mapRoute(row: Record<string, unknown>): PublicWebsiteRouteRecord {
  return {
    id: String(row.id),
    websiteId: String(row.website_id),
    path: String(row.path),
    funnelId: String(row.funnel_id)
  };
}

function mapPage(row: Record<string, unknown>): PublicPageRecord {
  return {
    id: String(row.id),
    ownerId: String(row.user_id),
    name: String(row.name),
    slug: String(row.slug),
    status: String(row.status),
    seoTitle: typeof row.seo_title === 'string' ? row.seo_title : null,
    seoDescription: typeof row.seo_description === 'string' ? row.seo_description : null,
    seoKeywords: typeof row.seo_keywords === 'string' ? row.seo_keywords : null,
    funnelId: typeof row.funnel_id === 'string' ? row.funnel_id : null,
    stepOrder: typeof row.step_order === 'number' ? row.step_order : null
  };
}

export class SupabasePublicSiteDataSource implements PublicSiteDataSource {
  constructor(
    private readonly client: PublicSiteSupabaseClient,
    private readonly baseDomain = 'pressurepro.io'
  ) {}

  private async one<T>(query: QueryBuilder<T>, code: string): Promise<T | null> {
    const { data, error } = await query;
    if (error) throw new PublicSiteDataSourceError(code);
    return data;
  }

  async findWebsiteByHost(host: string): Promise<PublicWebsiteRecord | null> {
    const columns = 'id,user_id,name,domain,subdomain,homepage_funnel_id';
    const custom = await this.one(
      this.client.from('websites').select<Record<string, unknown>>(columns)
        .eq('domain', host).limit(1).maybeSingle(),
      'website-domain-read'
    );
    if (custom) return mapWebsite(custom);

    const suffix = `.${this.baseDomain}`;
    if (!host.endsWith(suffix)) return null;
    const subdomain = host.slice(0, -suffix.length);
    if (!subdomain) return null;

    const matched = await this.one(
      this.client.from('websites').select<Record<string, unknown>>(columns)
        .eq('subdomain', subdomain).limit(1).maybeSingle(),
      'website-subdomain-read'
    );
    return matched ? mapWebsite(matched) : null;
  }

  async findRouteForWebsite(websiteId: string, path: string): Promise<PublicWebsiteRouteRecord | null> {
    const row = await this.one(
      this.client.from('website_routes').select<Record<string, unknown>>('id,website_id,path,funnel_id')
        .eq('website_id', websiteId).eq('path', path).limit(1).maybeSingle(),
      'route-read'
    );
    return row ? mapRoute(row) : null;
  }

  async findRedirectForWebsite(websiteId: string, path: string): Promise<PublicWebsiteRouteRedirectRecord | null> {
    const row = await this.one(
      this.client.from('website_route_redirects').select<Record<string, unknown>>('id,website_id,from_path,to_path')
        .eq('website_id', websiteId).eq('from_path', path).limit(1).maybeSingle(),
      'redirect-read'
    );
    return row ? mapRedirect(row) : null;
  }

  private pageQuery(funnelId: string): QueryBuilder<Record<string, unknown>> {
    return this.client.from('pages')
      .select<Record<string, unknown>>('id,user_id,name,slug,status,seo_title,seo_description,seo_keywords,funnel_id,step_order')
      .eq('funnel_id', funnelId)
      .order('step_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  async findPageForRoute(
    website: PublicWebsiteRecord,
    route: PublicWebsiteRouteRecord,
    path: string
  ): Promise<PublicPageRecord | null> {
    if (route.websiteId !== website.id || !route.funnelId) return null;
    if (path === '/' && website.homepageFunnelId !== route.funnelId) return null;

    const columns = 'id,user_id,name,slug,status,seo_title,seo_description,seo_keywords,funnel_id,step_order';
    const requestedSlug = path === '/' ? 'home' : path.slice(1);
    let row = await this.one(
      this.client.from('pages').select<Record<string, unknown>>(columns)
        .eq('funnel_id', route.funnelId).eq('slug', requestedSlug)
        .order('step_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true }).limit(1).maybeSingle(),
      'page-slug-read'
    );

    if (!row && path === '/') {
      row = await this.one(
        this.client.from('pages').select<Record<string, unknown>>(columns)
          .eq('funnel_id', route.funnelId).ilike('name', 'home')
          .order('step_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true }).limit(1).maybeSingle(),
        'page-home-read'
      );
    }

    // Existing browser behavior falls back within the exact route's funnel. The
    // explicit step_order/id ordering removes its prior database-order ambiguity.
    if (!row) row = await this.one(this.pageQuery(route.funnelId), 'page-funnel-read');
    const page = row ? mapPage(row) : null;
    return page?.funnelId === route.funnelId ? page : null;
  }

  async getPublicWebsiteSettings(websiteId: string): Promise<PublicWebsiteSettingsRecord | null> {
    const row = await this.one(
      this.client.from('website_settings').select<Record<string, unknown>>(
        'business_name,phone,email,logo_url,primary_color,facebook_pixel_id,gtm_id,ga4_measurement_id'
      ).eq('website_id', websiteId).limit(1).maybeSingle(),
      'settings-read'
    );
    if (!row) return null;
    const text = (key: string) => typeof row[key] === 'string' ? row[key] as string : null;
    return {
      businessName: text('business_name'), phone: text('phone'), email: text('email'),
      logoUrl: text('logo_url'), primaryColor: text('primary_color'),
      facebookPixelId: text('facebook_pixel_id'), gtmId: text('gtm_id'),
      ga4MeasurementId: text('ga4_measurement_id')
    };
  }

  async getPublicWebsiteLayout(websiteId: string): Promise<PublicWebsiteLayoutRecord | null> {
    const row = await this.one(
      this.client.from('website_layouts').select<Record<string, unknown>>('header_config,footer_config')
        .eq('website_id', websiteId).limit(1).maybeSingle(),
      'layout-read'
    );
    return row ? { headerConfig: row.header_config, footerConfig: row.footer_config } : null;
  }

  async getPublicationTarget(websiteId: string, pageId: string): Promise<PublicPublicationTargetRecord | null> {
    const row = await this.one(
      this.client.from('builder_publication_targets').select<Record<string, unknown>>(
        'website_id,page_id,published_revision_id,published_at'
      ).eq('website_id', websiteId).eq('page_id', pageId).limit(1).maybeSingle(),
      'target-read'
    );
    return row ? {
      websiteId: String(row.website_id), pageId: String(row.page_id),
      publishedRevisionId: String(row.published_revision_id),
      publishedAt: typeof row.published_at === 'string' ? row.published_at : null
    } : null;
  }

  async getRevisionById(revisionId: string, websiteId: string, pageId: string): Promise<PublicPublishedRevisionRecord | null> {
    const row = await this.one(
      this.client.from('builder_published_revisions').select<Record<string, unknown>>(
        'id,website_id,page_id,schema_version,document,document_fingerprint'
      ).eq('id', revisionId).eq('website_id', websiteId).eq('page_id', pageId).limit(1).maybeSingle(),
      'revision-read'
    );
    return row ? {
      id: String(row.id), websiteId: String(row.website_id), pageId: String(row.page_id),
      schemaVersion: Number(row.schema_version), document: row.document,
      documentFingerprint: String(row.document_fingerprint)
    } : null;
  }

  async getLegacySections(pageId: string): Promise<readonly PublicLegacySectionRecord[]> {
    const { data, error } = await this.client.from('page_sections').select<Record<string, unknown>[]>(
      'id,page_id,type,order_index,content,styles'
    ).eq('page_id', pageId).order('order_index', { ascending: true }).order('id', { ascending: true });
    if (error) throw new PublicSiteDataSourceError('legacy-sections-read');
    return (data ?? []).map(row => ({
      id: String(row.id), pageId: String(row.page_id), type: String(row.type),
      order: Number(row.order_index), content: row.content, styles: row.styles
    }));
  }
}
