import { emitEvent } from './events';
import { getCurrentUser } from './auth_logic';
import { ApiRequest } from './types';

/**
 * Global API Middleware Simulator.
 */
export async function apiMiddleware(req: ApiRequest): Promise<void> {
    const user = await getCurrentUser(req);
    req.user = user;
    
    // Security Audit Log: Record the request path and user (No sensitive payloads)
    const timestamp = new Date().toISOString();
    const endpoint = `${req.method || 'GET'} ${req.url || '/unknown'}`;
    const userDisplay = user ? user.email : 'unauthenticated';
    
    console.log(`[AUDIT] ${timestamp} | ${endpoint} | User: ${userDisplay}`);
    
    // Persist to Event Logs for full auditability
    emitEvent('api_request', { 
        method: req.method, 
        url: req.url, 
        user_id: user?.id || 'unauthenticated' 
    }, user?.id);
}

/**
 * Authorization Guard Middleware.
 */
export function requireAuth(req: ApiRequest) {
    if (!req.user) {
        return { 
            status: 401, 
            error: 'Unauthorized', 
            message: 'Authentication is required to access this resource.' 
        };
    }
    return null;
}

/**
 * 🛡️ C8: Payload Size Guard.
 * 
 * Protects against memory abuse by limiting the JSON body size.
 * Limit: 50 KB (approx. 51,200 bytes)
 */
export function validatePayloadSize(req: ApiRequest) {
    if (!req.body) return null;
    
    try {
        const payloadStr = JSON.stringify(req.body);
        const bytes = Buffer.byteLength(payloadStr, 'utf8');
        const LIMIT_BYTES = 51200; 

        if (bytes > LIMIT_BYTES) {
            console.warn(`[SECURITY: DOS] Refused oversized payload (${bytes} bytes) from user ${req.user?.id || 'anonymous'}`);
            return {
                status: 413,
                success: false,
                error: 'payload_too_large'
            };
        }
    } catch (e) {
        // If stringify fails, it's likely malformed or circular (also risky)
        return { status: 400, error: 'invalid_payload_structure' };
    }
    
    return null;
}
