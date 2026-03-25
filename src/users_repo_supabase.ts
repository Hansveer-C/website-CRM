import { DB } from './utils/db/db_module';
import { User } from './types';
import { hashPassword, isBcryptHash } from './password_utils';

/**
 * Phase S3 - Batch 1: User Repository (Supabase).
 * Transitioned from SQLite implementation in users_repo.ts.
 */
export const UsersRepo = {
  /**
   * Creates a new user in the Supabase database.
   * Passwords are automatically hashed via bcrypt.
   */
  async createUser(email: string, rawPassword: string): Promise<User> {
    
    // 1. Password Security
    const hashedPassword = await hashPassword(rawPassword);
    if (!isBcryptHash(hashedPassword)) {
      throw new Error('INTERNAL_ERROR: Password hashing failed to produce a valid hash');
    }

    // 2. Identity Generation (Supabase usually handles IDs if UUID, but our types use string)
    // We let Supabase/Postgres handle the default UUID if specified in schema, 
    // but here we align with current manual UUID for consistency.
    let id: string;
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      id = crypto.randomUUID() as string;
    } else {
      id = `user-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(16)}`;
    }

    const payload: Partial<User> = {
      id,
      email,
      password_hash: hashedPassword,
      created_at: new Date().toISOString()
    };

    try {
      return await DB.upsert<User>('users', payload);
    } catch (e: any) {
      if (e.message?.includes('unique constraint') || e.message?.includes('duplicate key')) {
        throw new Error(`USER_ALREADY_EXISTS: Email ${email} is already registered.`);
      }
      throw e;
    }
  },

  /**
   * Retrieves a user by their email address.
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await DB.findOne<User>('users', { email });
  },

  /**
   * Retrieves a user by their unique ID.
   */
  async getUserById(id: string): Promise<User | null> {
    return await DB.findOne<User>('users', { id });
  }
};
