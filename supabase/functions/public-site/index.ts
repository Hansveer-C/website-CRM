import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import { handlePublicSiteRequest } from '../_shared/public_site_handler.ts';
import {
  SupabasePublicSiteDataSource,
  type PublicSiteDataSource
} from '../_shared/public_site_data_source.ts';

const unavailableDataSource = {} as PublicSiteDataSource;

// This is the future trusted production public-read boundary. Browser wiring is
// intentionally separate. Base publication tables remain unavailable to anon,
// and public forms require a separate validated, rate-limited write endpoint.
Deno.serve((request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return handlePublicSiteRequest(request, {
      dataSource: unavailableDataSource,
      configurationAvailable: false,
      logger: console
    });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  const dataSource = new SupabasePublicSiteDataSource(
    client as unknown as ConstructorParameters<typeof SupabasePublicSiteDataSource>[0]
  );
  return handlePublicSiteRequest(request, { dataSource, logger: console });
});
