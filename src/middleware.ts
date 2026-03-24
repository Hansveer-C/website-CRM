import { emitEvent } from './events';
import { getCurrentUser } from './auth_logic';
import { ApiRequest } from './types';

/**
 * Global API Middleware Simulator.
 */
export async function apiMiddleware(req: ApiRequest): Promise<void> {
    const user = getCurrentUser(req);
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
 * 
 * Ensures that the request contains a valid authenticated user.
 * If not, it blocks execution and returns a 401 Unauthorized state.
 */
export function requireAuth(req: ApiRequest) {
    if (!req.user) {
        return { 
            status: 401, 
            error: 'Unauthorized', 
            message: 'Authentication is required to access this resource.' 
        };
    }
    
    // Return true to indicate authorization successful
    return null;
}
