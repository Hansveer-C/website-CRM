import { WebsiteGeneratorService } from './website_generator_service';
import { WebsitesRepo } from './websites_repo_supabase';
import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';

/**
 * 🔒 SERVER-ONLY API CONTROLLERS
 * Handles HTTP requests for the Website entities.
 */

/**
 * GET /api/websites
 * Returns the current user's website.
 */
export async function getWebsitesApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const res = await WebsitesRepo.getWebsiteByUser(req.user!.id);
    
    return {
        status: 200,
        success: true,
        data: res
    };
}

/**
 * POST /api/websites/generate
 * WB.2.2 - Full website + funnels from input.
 */
export async function generateWebsiteApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { business_name, phone_number, city, services } = req.body || {};

    if (!business_name || !phone_number || !city || !services || !Array.isArray(services)) {
        return {
            status: 400,
            success: false,
            error: 'Invalid input. business_name, phone_number, city, and services[] are required.'
        };
    }

    try {
        const result = await WebsiteGeneratorService.generateWebsiteFromInput(req.user!.id, {
            business_name,
            phone_number,
            city,
            services
        });

        return {
            status: 201,
            success: true,
            data: result
        };
    } catch (e: any) {
        console.error('[API: WEBSITES] Generation failed:', e.message);
        return {
            status: 500,
            success: false,
            error: e.message || 'An error occurred during website generation.'
        };
    }
}
