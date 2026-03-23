import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';
import { sendMessageToContact, retryMessage } from './sms_logic';

/**
 * Backend Controller for SMS/Messages APIs.
 * This is the secure interface that the frontend communicates with.
 */

/**
 * POST /api/messages/send
 * Authentically handles sending an SMS.
 * 
 * Flow:
 * 1. Auth & Middleware
 * 2. Logic: Calls sms_logic which handles SDK interactions
 * 3. Result: Returns success/failure to the frontend
 */
export async function sendMessageApi(req: ApiRequest) {
    // 1. Run global middleware (sessions, user context)
    await apiMiddleware(req);
    
    // 2. Auth Check
    const authError = requireAuth(req);
    if (authError) return authError; // 401 Unauthorized

    // 3. Extract Payload
    const { contact_id, message, source } = req.body || {};

    if (!contact_id || !message) {
        return {
            status: 400,
            error: 'Missing contact_id or message content.'
        };
    }

    try {
        console.log(`[API BACKEND] User ${req.user?.email} is sending SMS to ${contact_id}...`);
        
        // 4. Delegate to logic layer (backend side)
        // Passes req.user.id for context
        const result = await sendMessageToContact(contact_id, message, source, req.user?.id);

        if (result.success) {
            return {
                status: 200,
                data: {
                    success: true,
                    internal_id: result.internal_id
                }
            };
        } else {
            return {
                status: 500,
                error: result.error
            };
        }
    } catch (error: any) {
        console.error('❌ [API BACKEND] Unexpected failure in sendMessageApi:', error);
        return {
            status: 500,
            error: `API Internal Server Error: ${error.message}`
        };
    }
}

/**
 * POST /api/messages/:id/retry
 */
export async function retryMessageApi(req: ApiRequest, message_id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    try {
        console.log(`[API BACKEND] User ${req.user?.email} is retrying message ${message_id}...`);
        const result = await retryMessage(message_id);

        if (result.success) {
            return {
                status: 200,
                data: { success: true }
            };
        } else {
            return {
                status: 500,
                error: result.error
            };
        }
    } catch (err: any) {
        return {
            status: 500,
            error: err.message
        };
    }
}
