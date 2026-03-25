/**
 * 🔒 SERVER-ONLY MODULE
 * Backend Controller for Voice/Call APIs.
 */
import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';
import { handleInboundCall, endCall } from './calls_logic';

/**
 * POST /api/calls/inbound
 * Secured simulation for testing inbound call lifecyle.
 */
export async function handleInboundCallApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    try {
        const result = await handleInboundCall(req.body);
        return {
            status: 200,
            data: result
        };
    } catch (err: any) {
        return {
            status: 400,
            error: err.message
        };
    }
}

/**
 * POST /api/calls/end
 * Secured termination for the call simulation.
 */
export async function endCallApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    try {
        const result = await endCall(req.body);
        return {
            status: 200,
            data: result
        };
    } catch (err: any) {
        return {
            status: 400,
            error: err.message
        };
    }
}
