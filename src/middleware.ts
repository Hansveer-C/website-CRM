import { getCurrentUser } from './auth_logic';
import { ApiRequest } from './types';

/**
 * Global API Middleware Simulator.
 * 
 * For every incoming request:
 * 1. Resolves the current authenticated user from cookies.
 * 2. Attaches the user to the request context (req.user).
 * 
 * Note: Does not block unauthorized requests at this stage.
 */
export async function apiMiddleware(req: ApiRequest): Promise<void> {
    const user = getCurrentUser(req);
    
    // Attach to request context
    req.user = user;
    
    // Diagnostic log (as requested in PROMPT 3.2.8)
    if (user) {
        console.log(`[API MIDDLEWARE] Request context populated for user: ${user.email}`);
    } else {
        console.log('[API MIDDLEWARE] Request context: unauthenticated');
    }
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
