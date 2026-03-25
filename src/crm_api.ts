import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';
import { getContact } from './contacts_repo';
import { getOpportunity } from './opportunities_repo';
import { getMessage } from './messages_repo';
import { getCall } from './calls_repo';
import { createLead } from './leads_logic';
import { getContactTimeline } from './timeline';

/**
 * Shared logic to handle specific record retrieval with user scoping.
 * Returns the record if owned by the user, or 404 if not found/unauthorized.
 */
async function getRecordById(req: ApiRequest, fetcher: (id: string, user: any) => any, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const record = await fetcher(id, req.user);

    
    if (!record) {
        return {
            status: 404, // Hide existence of sensitive data
            error: 'Record not found.'
        };
    }

    return {
        status: 200,
        data: record
    };
}

/**
 * GET /api/contacts/:id
 */
export async function getContactApi(req: ApiRequest, id: string) {
    return getRecordById(req, getContact, id);
}

/**
 * GET /api/opportunities/:id
 */
export async function getOpportunityApi(req: ApiRequest, id: string) {
    return getRecordById(req, getOpportunity, id);
}

/**
 * GET /api/messages/:id
 */
export async function getMessageApi(req: ApiRequest, id: string) {
    return getRecordById(req, getMessage, id);
}

/**
 * GET /api/calls/:id
 */
export async function getCallApi(req: ApiRequest, id: string) {
    return getRecordById(req, getCall, id);
}

/**
 * POST /api/leads
 * Secured automation trigger.
 */
export async function createLeadApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    try {
        const result = await createLead(req.body, req);
        return {
            status: 201,
            data: result
        };
    } catch (error: any) {
        return {
            status: 400,
            error: error.message
        };
    }
}

/**
 * GET /api/contacts/:id/timeline
 */
export async function getContactTimelineApi(req: ApiRequest, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    // Check Existence & Ownership
    const contact = await getContact(id, req.user);
    if (!contact) {
        return { status: 404, error: 'Contact not found or access denied.' };
    }

    const timeline = await getContactTimeline(id, req.user);
    return {
        status: 200,
        data: timeline
    };
}
