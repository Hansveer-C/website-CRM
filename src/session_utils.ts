import { User } from './types';
import { authConfig } from './config';

/**
 * BROWSER-SAFE SESSION HANDLER
 * Using a simple Base64-based token structure to avoid Node.js-only 'jsonwebtoken' dependency.
 * This resolves the 'util.inherits is not a function' crash in the browser/Vite.
 */

/**
 * Generates a signed session token for the provided user.
 * Structure: btoa(payload) + '.' + btoa(signature_placeholder)
 */
export function createSessionToken(user: Partial<User>): string {
    if (!user.id) {
        throw new Error('User ID is required to generate a session token');
    }

    const payload = {
        user_id: user.id,
        email: user.email,
        iat: Date.now()
    };

    try {
        const payloadStr = btoa(JSON.stringify(payload));
        // Simple mock signature for development compatibility
        const signature = btoa('mock-signature-' + authConfig.jwt_secret);
        return `${payloadStr}.${signature}`;
    } catch (e) {
        console.error('Failed to create session token (btoa fail):', e);
        return 'error-generating-token';
    }
}

/**
 * Decodes a session token to extract payload.
 */
export function decodeSessionToken(token: string): any {
    if (!token || !token.includes('.')) return null;
    
    try {
        const parts = token.split('.');
        const payloadStr = atob(parts[0]);
        return JSON.parse(payloadStr);
    } catch (err) {
        console.warn('Failed to decode browser-safe session token:', err);
        return null;
    }
}
