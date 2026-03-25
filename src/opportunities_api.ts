import { getOpportunities } from './opportunities_repo';
import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';

/**
 * Simulated GET /api/opportunities
 */
export async function getOpportunitiesApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const opportunities = await getOpportunities(req.user);
    
    return {
        status: 200,
        data: opportunities
    };
}
