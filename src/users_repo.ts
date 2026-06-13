import { User } from './types';
import { hashPassword, isBcryptHash } from './password_utils';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

const isBrowser = typeof window !== 'undefined';
const isProduction = !isBrowser && process.env.NODE_ENV === 'production';
const hasSupabase = !isBrowser && !!process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('https://') && !process.env.SUPABASE_URL.includes('placeholder.supabase.co');

/**
 * Creates a new user in the Supabase database.
 * The raw password is automatically hashed before storage.
 */
export async function createUser(email: string, rawPassword: string): Promise<User> {
    
    // Always hash the password before storing
    const hashedPassword = await hashPassword(rawPassword);
    
    // Safety check: ensure the resulting string looks like a bcrypt hash
    if (!isBcryptHash(hashedPassword)) {
        throw new Error('INTERNAL_ERROR: Password hashing failed to produce a valid hash');
    }

    // Environment-agnostic UUID generation for user ID
    let id: string;
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        id = crypto.randomUUID() as string;
    } else {
        id = `user-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(16)}`;
    }

    if (!hasSupabase) {
        console.log('[DB MOCK: USER_REPO] offline mode, creating mock user for:', email);
        return {
            id,
            email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString()
        };
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .insert({
                id,
                email,
                password_hash: hashedPassword,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[DB: USER] Error creating user in Supabase:', error.message);
            if (isProduction) {
                throw new Error(`DB_CREATE_USER_ERROR: ${error.message}`);
            }
            return {
                id,
                email,
                password_hash: hashedPassword,
                created_at: new Date().toISOString()
            };
        }

        return data as User;
    } catch (e: any) {
        console.error('[DB: USER] Crash creating user in Supabase:', e.message);
        if (isProduction) {
            throw e;
        }
        return {
            id,
            email,
            password_hash: hashedPassword,
            created_at: new Date().toISOString()
        };
    }
}

/**
 * Retrieves a user by their email address from Supabase.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    if (!hasSupabase) {
        console.log('[DB MOCK: USER_REPO] offline mode, falling back to mock user for email:', email);
        return {
            id: 'system',
            email: email || 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        };
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('[DB: USER] Error fetching user by email from Supabase:', error.message);
            if (isProduction) {
                throw new Error(`DB_GET_USER_EMAIL_ERROR: ${error.message}`);
            }
            return {
                id: 'system',
                email: email || 'operator@example.com',
                password_hash: '',
                created_at: new Date().toISOString()
            };
        }

        return (data as User) || (isProduction ? null : {
            id: 'system',
            email: email || 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        });
    } catch (e: any) {
        console.error('[DB: USER] Crash fetching user by email from Supabase:', e.message);
        if (isProduction) {
            throw e;
        }
        return {
            id: 'system',
            email: email || 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        };
    }
}

/**
 * Retrieves a user by their unique ID from Supabase.
 */
export async function getUserById(id: string): Promise<User | null> {
    if (!hasSupabase) {
        console.log('[DB MOCK: USER_REPO] offline mode, falling back to mock user for id:', id);
        return {
            id: id || 'system',
            email: 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        };
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('[DB: USER] Error fetching user by ID from Supabase:', error.message);
            if (isProduction) {
                throw new Error(`DB_GET_USER_ID_ERROR: ${error.message}`);
            }
            return {
                id: id || 'system',
                email: 'operator@example.com',
                password_hash: '',
                created_at: new Date().toISOString()
            };
        }

        return (data as User) || (isProduction ? null : {
            id: id || 'system',
            email: 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        });
    } catch (e: any) {
        console.error('[DB: USER] Crash fetching user by ID from Supabase:', e.message);
        if (isProduction) {
            throw e;
        }
        return {
            id: id || 'system',
            email: 'operator@example.com',
            password_hash: '',
            created_at: new Date().toISOString()
        };
    }
}
