import jwt from 'jsonwebtoken';
import { User } from './types';
import { authConfig } from './config';

/**
 * Generates a signed session token (JWT) for the provided user.
 * 
 * Simple implementation for Phase 1: 
 * - Includes user_id (id) in payload
 * - No expiry yet
 */
export function createSessionToken(user: Partial<User>): string {
    if (!user.id) {
        throw new Error('User ID is required to generate a session token');
    }

    const payload = {
        user_id: user.id,
        email: user.email // Helpful for debugging/basic UI
    };

    // Sign the token synchronously for now
    return jwt.sign(payload, authConfig.jwt_secret);
}

/**
 * Decodes a session token to extract payload.
 */
export function decodeSessionToken(token: string): any {
    try {
        return jwt.verify(token, authConfig.jwt_secret);
    } catch (err) {
        return null;
    }
}
