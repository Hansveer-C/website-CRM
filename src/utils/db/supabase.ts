/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 * All database access from the frontend must go through the /api layer.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Single backend-only Supabase client. Do not import in frontend code.
 * Uses the service_role key to bypass Row-Level Security (RLS).
 * MUST NOT be exposed to the browser.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
