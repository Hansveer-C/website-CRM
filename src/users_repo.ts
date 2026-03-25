import { User } from './types';
import { hashPassword, isBcryptHash } from './password_utils';
import { supabase } from './utils/db/supabase';

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
        throw new Error(`DB_CREATE_USER_ERROR: ${error.message}`);
    }
    
    return data as User;
}

/**
 * Retrieves a user by their email address from Supabase.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('[DB: USER] Error fetching user by email from Supabase:', error.message);
        throw new Error(`DB_GET_USER_EMAIL_ERROR: ${error.message}`);
    }
    
    return data as User | null;
}

/**
 * Retrieves a user by their unique ID from Supabase.
 */
export async function getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('[DB: USER] Error fetching user by ID from Supabase:', error.message);
        throw new Error(`DB_GET_USER_ID_ERROR: ${error.message}`);
    }
    
    return data as User | null;
}

