import { ApiRequest } from './types';
import { apiMiddleware, requireAuth, validatePayloadSize } from './middleware';
import { getContact, deleteContact } from './contacts_repo';
import { getOpportunity, deleteOpportunity } from './opportunities_repo';
import { getMessage } from './messages_repo';
import { getCall } from './calls_repo';
import { createLead } from './leads_logic';
import { getContactTimeline } from './timeline';
import { mapRepoToApi } from './utils/api_errors';
import { ValidationError } from './utils/validators';

/**
 * Shared logic to handle specific record retrieval with user scoping.
 * Returns the record if owned by the user, or 404 if not found/unauthorized.
 */
async function getRecordById(req: ApiRequest, fetcher: (id: string, user: any) => any, id: string, operation: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const payloadError = validatePayloadSize(req);
    if (payloadError) return payloadError;

    const userId = req.user?.id || 'anonymous';

    try {
        const res = await fetcher(id, req.user);
        const apiRes = mapRepoToApi(res, { resourceName: operation.split('_')[1] });
        if (apiRes.status === 200 && !apiRes.data) {
             return { status: 404, error: 'Record not found.' };
        }
        return apiRes;
    } catch (error: any) {
        console.error(`[API: ${operation}] Failed for user ${userId}:`, error.message);
        return {
            status: 500,
            error: `API_ERROR_${operation.toUpperCase()}: Internal processing failure.`
        };
    }
}

/**
 * GET /api/contacts/:id
 */
export async function getContactApi(req: ApiRequest, id: string) {
    return getRecordById(req, getContact, id, 'GET_CONTACT');
}

/**
 * GET /api/opportunities/:id
 */
export async function getOpportunityApi(req: ApiRequest, id: string) {
    return getRecordById(req, getOpportunity, id, 'GET_OPPORTUNITY');
}

/**
 * GET /api/messages/:id
 */
export async function getMessageApi(req: ApiRequest, id: string) {
    return getRecordById(req, getMessage, id, 'GET_MESSAGE');
}

/**
 * GET /api/calls/:id
 */
export async function getCallApi(req: ApiRequest, id: string) {
    return getRecordById(req, getCall, id, 'GET_CALL');
}

/**
 * POST /api/leads
 * Secured automation trigger.
 */
export async function createLeadApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const payloadError = validatePayloadSize(req);
    if (payloadError) return payloadError;

    try {
        const result = await createLead(req.body, req);
        return {
            status: 201,
            data: result
        };
    } catch (error: any) {
        const userId = req.user?.id || 'anonymous';
        
        if (error instanceof ValidationError) {
            return {
                status: 400,
                ...error.serialize()
            };
        }

        console.error(`[API: CREATE_LEAD] Failed for user ${userId}:`, error.message);
        return {
            status: 400,
            error: 'Failed to process lead submission.'
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

    const payloadError = validatePayloadSize(req);
    if (payloadError) return payloadError;

    const userId = req.user?.id || 'anonymous';

    try {
        // Check Existence & Ownership (Harden against delete-read race C7)
        const contactRes = await getContact(id, req.user!);
        const contactApiRes = mapRepoToApi(contactRes, { resourceName: 'contact' });
        
        if (contactApiRes.status !== 200 || !contactApiRes.data) {
             return {
                 status: contactApiRes.status === 200 ? 404 : contactApiRes.status,
                 error: contactApiRes.error || 'Contact not found.'
             };
        }

        const timelineRes = await getContactTimeline(id, req.user);
        if (!timelineRes.success) {
            return { status: 500, error: timelineRes.error || 'Failed to build timeline.' };
        }

        return {
            status: 200,
            data: timelineRes.data
        };
    } catch (error: any) {
        console.error(`[API: GET_TIMELINE] Failed for user ${userId}:`, error.message);
        return {
            status: 500,
            error: 'Failed to retrieve timeline.'
        };
    }
}
/**
 * DELETE /api/contacts/:id
 */
export async function deleteContactApi(req: ApiRequest, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const payloadError = validatePayloadSize(req);
    if (payloadError) return payloadError;

    const userId = req.user?.id || 'anonymous';

    try {
        const res = await deleteContact(id, req.user!);
        
        if (!res.success) {
            return {
                status: 500,
                error: res.error || 'Failed to delete contact.'
            };
        }

        return {
            status: 200,
            data: { success: true, message: 'Contact deleted successfully.' }
        };
    } catch (error: any) {
        console.error(`[API: DELETE_CONTACT] Failed for user ${userId}:`, error.message);
        return {
            status: 500,
            error: 'Failed to process deletion.'
        };
    }
}
