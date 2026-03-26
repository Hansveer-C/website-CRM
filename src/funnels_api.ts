import { FunnelsRepo } from './funnels_repo_supabase';
import { PagesRepo } from './pages_repo_supabase';
import { ApiRequest, RepoResponse, Page } from './types';
import { apiMiddleware, requireAuth } from './middleware';

/**
 * 🔒 SERVER-ONLY API CONTROLLERS
 * Handles HTTP requests for the Funnel entities.
 */

/**
 * GET /api/funnels
 * Returns all funnels for the authenticated user.
 */
export async function getFunnelsApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    // Use req.user.id for strictly scoped lookup
    const res = await FunnelsRepo.getFunnels(req.user!.id);
    
    if (!res.success) {
        return {
            status: 500,
            success: false,
            error: res.error || 'Internal server error while fetching funnels.'
        };
    }

    const funnels = res.data || [];
    const pagesRes = await PagesRepo.getAllPages(req.user!.id);
    const allPages = pagesRes.data || [];

    const data = funnels.map(f => ({
        ...f,
        step_count: allPages.filter(p => p.funnel_id === f.id).length
    }));

    return {
        status: 200,
        success: true,
        data
    };
}

/**
 * GET /api/funnels/:id
 * Returns a single funnel if owned by the user.
 */
export async function getFunnelByIdApi(req: ApiRequest, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const res = await FunnelsRepo.getFunnelById(req.user!.id, id);
    
    if (!res.success || !res.data) {
        return {
            status: !res.success ? 500 : 404,
            success: false,
            error: res.error || 'Funnel not found or unauthorized access.'
        };
    }

    const funnel = res.data;

    // Fetch steps (pages linked to this funnel)
    const pagesRes = await PagesRepo.getAllPages(req.user!.id);
    const steps = (pagesRes.data || [])
        .filter(p => p.funnel_id === id)
        .sort((a, b) => (a.step_order || 0) - (b.step_order || 0));

    return {
        status: 200,
        success: true,
        data: {
            ...funnel,
            steps
        }
    };
}

/**
 * POST /api/funnels
 * Creates a new funnel for the authenticated user.
 */
export async function createFunnelApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { name } = req.body || {};
    if (!name || typeof name !== 'string') {
        return {
            status: 400,
            success: false,
            error: 'Funnel name is required and must be a string.'
        };
    }

    const res = await FunnelsRepo.createFunnel(req.user!.id, name);
    
    if (!res.success || !res.data) {
        return {
            status: 500,
            success: false,
            error: res.error || 'Could not create funnel.'
        };
    }

    const funnel = res.data;

    // WB.1.6: Create default steps (Landing, Form, Thank You)
    const steps = [
        { type: 'Landing', order: 1, name: 'Home Landing' },
        { type: 'Form', order: 2, name: 'Lead Capture Form' },
        { type: 'Thank You', order: 3, name: 'Success Confirmation' }
    ];

    for (const step of steps) {
        const page: Page = {
            id: `pg_${Date.now()}_${step.order}`,
            user_id: req.user!.id,
            name: `${name} - ${step.name}`,
            slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${step.type.toLowerCase()}-${Date.now()}`,
            status: 'draft',
            seo_title: `${name} ${step.type}`,
            seo_description: '',
            seo_keywords: [],
            created_at: new Date().toISOString(),
            funnel_id: funnel.id,
            step_type: step.type,
            step_order: step.order
        };
        await PagesRepo.persistPage(page, req.user!.id);
    }

    return {
        status: 201,
        success: true,
        data: funnel
    };
}

/**
 * PATCH /api/funnels/:id
 * Updates a funnel's status or name.
 */
export async function updateFunnelApi(req: ApiRequest, id: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { name, status } = req.body || {};

    const res = await FunnelsRepo.updateFunnel(req.user!.id, id, { name, status });
    
    if (!res.success || !res.data) {
        return {
            status: !res.success ? 500 : 404,
            success: false,
            error: res.error || 'Failed to update funnel or target not found.'
        };
    }

    return {
        status: 200,
        success: true,
        data: res.data
    };
}
