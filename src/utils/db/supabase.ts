/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 * All database access from the frontend must go through the /api layer.
 */

import { createClient } from '@supabase/supabase-js';
import { RepoResponse } from '../../types';

/**
 * Single backend-only Supabase client. Do not import in frontend code.
 * Uses the service_role key to manage administrative-level access (Backend RLS).
 * MUST NOT be exposed to the browser.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * 🛡️ SAFE DB CALL WRAPPER
 * Standardizes error handling, logging, and response structure for all repository calls.
 */
export async function safeDbCall<T>(
    operation: string,
    userId: string | undefined,
    promise: PromiseLike<{ data: T | null; error: any }>
): Promise<RepoResponse<T>> {
    const TIMEOUT_MS = 8000; // 8 second timeout for DB 
    const start = Date.now();

    const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), TIMEOUT_MS)
    );

    try {
        const { data, error } = await Promise.race([promise as any, timeoutPromise]);
        
        if (error) {
            console.error(`[DB: ${operation}] error for user ${userId || 'system'}:`, error.message);
            return { success: false, error: error.message, code: error.code };
        }
        
        return { success: true, data: data as T };
    } catch (err: any) {
        const duration = Date.now() - start;
        if (err.message === 'DATABASE_TIMEOUT') {
            console.error(`[DB: ${operation}] timeout after ${duration}ms for user ${userId || 'system'}`);
            return { success: false, error: 'timeout', source: 'database' };
        }
        console.error(`[DB: ${operation}] crash for user ${userId || 'system'} after ${duration}ms:`, err.message);
        return { success: false, error: 'DATABASE_CRASH', code: 'INTERNAL_ERROR' };
    }
}

/**
 * 🛡️ SAFE DB COUNT WRAPPER
 */
export async function safeDbCount(
    operation: string,
    userId: string | undefined,
    promise: PromiseLike<{ count: number | null; error: any }>
): Promise<RepoResponse<number>> {
    const TIMEOUT_MS = 8000;
    const start = Date.now();

    const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), TIMEOUT_MS)
    );

    try {
        const { count, error } = await Promise.race([promise as any, timeoutPromise]);
        
        if (error) {
            console.error(`[DB: ${operation}] error for user ${userId || 'system'}:`, error.message);
            return { success: false, error: error.message, code: error.code };
        }
        
        return { success: true, data: count || 0 };
    } catch (err: any) {
        const duration = Date.now() - start;
        if (err.message === 'DATABASE_TIMEOUT') {
            console.error(`[DB: ${operation}] timeout after ${duration}ms for user ${userId || 'system'}`);
            return { success: false, error: 'timeout', source: 'database' };
        }
        console.error(`[DB: ${operation}] crash for user ${userId || 'system'} after ${duration}ms:`, err.message);
        return { success: false, error: 'DATABASE_CRASH', code: 'INTERNAL_ERROR' };
    }
}
