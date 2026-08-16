import type { Website, WebsiteLayout } from './types';

export type WebsiteLayoutLoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

interface LayoutQueryResult {
  data: unknown[] | null;
  error: unknown | null;
}

export interface WebsiteLayoutHydrationClient {
  from(table: 'website_layouts'): {
    select(columns: string): {
      in(column: 'website_id', values: string[]): PromiseLike<LayoutQueryResult>;
    };
  };
}

function isLayout(value: unknown): value is WebsiteLayout {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WebsiteLayout>;
  return typeof row.id === 'string'
    && typeof row.website_id === 'string'
    && !!row.header_config
    && typeof row.header_config === 'object'
    && !!row.footer_config
    && typeof row.footer_config === 'object';
}

export class WebsiteLayoutHydrator {
  state: { status: WebsiteLayoutLoadState; userId?: string } = { status: 'idle' };
  private generation = 0;

  constructor(
    private readonly getClient: () => Promise<WebsiteLayoutHydrationClient | null>,
    private readonly layouts: WebsiteLayout[]
  ) {}

  clear(): void {
    this.generation += 1;
    this.layouts.splice(0);
    this.state = { status: 'idle' };
  }

  async hydrate(userIdInput: string, websites: readonly Website[]): Promise<typeof this.state> {
    const userId = userIdInput.trim();
    this.clear();
    const generation = this.generation;
    this.state = { status: 'loading', userId };
    const ownedWebsiteIds = websites
      .filter(website => website.user_id === userId)
      .map(website => website.id);
    if (!userId || ownedWebsiteIds.length === 0) {
      this.state = { status: 'empty', userId };
      return this.state;
    }
    try {
      const client = await this.getClient();
      if (!client) throw new Error('UNAVAILABLE');
      const result = await client.from('website_layouts').select('*').in('website_id', ownedWebsiteIds);
      if (result.error) throw new Error('UNAVAILABLE');
      if (generation !== this.generation) return this.state;
      const owned = new Set(ownedWebsiteIds);
      const rows = (result.data ?? []).filter(isLayout).filter(layout => owned.has(layout.website_id));
      const unique = new Map(rows.map(layout => [layout.website_id, layout]));
      this.layouts.push(...[...unique.values()].map(layout => ({
        ...layout,
        header_config: { ...layout.header_config, nav_items: [...(layout.header_config.nav_items ?? [])] },
        footer_config: { ...layout.footer_config }
      })));
      this.state = { status: this.layouts.length ? 'loaded' : 'empty', userId };
    } catch {
      if (generation === this.generation) this.state = { status: 'error', userId };
    }
    return this.state;
  }
}
