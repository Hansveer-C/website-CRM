import { getAllContacts } from './contacts_repo';
import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';

/**
 * Simulated GET /api/contacts endpoint.
 * Requires Authentication.
 */
export async function getContacts(req: ApiRequest) {
    // 1. Run global middleware
    await apiMiddleware(req);
    
    // 2. Strict Auth Check
    const authError = requireAuth(req);
    if (authError) {
        return authError; // 401 Unauthorized
    }

    // 3. Logic: Fetch data from DB
    // At this point we are guaranteed to have a req.user
    const contacts = getAllContacts(req.user);
    
    return {
        status: 200,
        data: contacts,
        user: req.user?.email // Diagnostics
    };
}
