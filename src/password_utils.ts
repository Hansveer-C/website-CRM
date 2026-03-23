import bcrypt from 'bcryptjs';

/**
 * Hashes a raw password securely using bcrypt.
 */
export async function hashPassword(rawPassword: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(rawPassword, saltRounds);
}

/**
 * Verifies a raw password against a hash.
 */
export async function verifyPassword(rawPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(rawPassword, hash);
}

/**
 * Basic check to see if a string looks like a bcrypt hash.
 */
export function isBcryptHash(str: string): boolean {
    // Bcrypt hashes typically start with $2a$, $2b$, or $2y$, and are 60 characters long.
    return str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$');
}
