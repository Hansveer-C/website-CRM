import { getAllContacts, getContact } from './contacts_repo';
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
    const { success, data: contacts, error } = await getAllContacts(req.user);
    
    if (!success) {
        return {
            status: 500,
            error: error || 'Failed to fetch contacts.'
        };
    }

    return {
        status: 200,
        data: contacts,
        user: req.user?.email // Diagnostics
    };
}

/**
 * Simulated GET /api/contacts/:id
 */
export async function getContactApi(req: ApiRequest, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    // Repo-level applyUserScope ensures this only returns the contact if owned by req.user
    const { success, data: contact, error } = await getContact(id, req.user);
    
    if (!success || !contact) {
        return {
            status: !success ? 500 : 404,
            error: error || 'Contact not found.'
        };
    }

    return {
        status: 200,
        data: contact
    };
}
