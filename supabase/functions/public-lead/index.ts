import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import { SupabasePublicLeadDataSource, type PublicLeadDataSource } from '../_shared/public_lead_data_source.ts';
import { handlePublicLeadRequest } from '../_shared/public_lead_handler.ts';

const unavailableDataSource = {} as PublicLeadDataSource;

Deno.serve((request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hashSecret = Deno.env.get('PUBLIC_LEAD_HASH_SECRET') ?? '';
  if (!supabaseUrl || !serviceRoleKey || hashSecret.length < 32) {
    return handlePublicLeadRequest(request, {
      dataSource: unavailableDataSource,
      hashSecret,
      configurationAvailable: false,
      logger: console
    });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const dataSource = new SupabasePublicLeadDataSource(
    client as unknown as ConstructorParameters<typeof SupabasePublicLeadDataSource>[0]
  );
  return handlePublicLeadRequest(request, { dataSource, hashSecret, logger: console });
});
