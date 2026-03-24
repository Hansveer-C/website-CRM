import { createClient } from '@supabase/supabase-js';



const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

/**
 * Backend-only Supabase client.
 * Uses the service_role key to bypass Row-Level Security (RLS).
 * MUST NOT be exposed to the browser.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
