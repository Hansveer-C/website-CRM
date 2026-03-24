import { getDB } from './database';
import { User } from './types';
import { hashPassword, isBcryptHash } from './password_utils';

/**
 * Creates a new user in the database.
 * The raw password is automatically hashed before storage.
 */
export async function createUser(email: string, rawPassword: string): Promise<User> {
    const db = getDB();
    
    // Environment-agnostic UUID generation
    let id: string;
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        id = crypto.randomUUID() as string;
    } else {
        // Fallback for environments where crypto.randomUUID is not available
        id = `user-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(16)}`;
    }
    
    // Always hash the password before storing
    const hashedPassword = await hashPassword(rawPassword);
    
    // Safety check: ensure the resulting string looks like a bcrypt hash
    if (!isBcryptHash(hashedPassword)) {
        throw new Error('INTERNAL_ERROR: Password hashing failed to produce a valid hash');
    }

    const stmt = db.prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (?, ?, ?)
    `);
    
    stmt.run(id, email, hashedPassword);
    
    // Fetch the created user to get the automated created_at
    const user = getUserById(id);
    if (!user) {
        throw new Error(`Failed to retrieve created user with id: ${id}`);
    }
    
    return user;
}

/**
 * Retrieves a user by their email address.
 */
export function getUserByEmail(email: string): User | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as User | undefined;
    
    return row || null;
}

/**
 * Retrieves a user by their unique ID.
 */
export function getUserById(id: string): User | null {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as User | undefined;
    
    return row || null;
}
