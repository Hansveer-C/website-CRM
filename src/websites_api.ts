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

    const { 
        business_name, 
        phone_number, 
        city, 
        services,
        cities,
        generate_services,
        generate_cities,
        generate_service_cities,
        website_preset,
        primary_color,
        build_brief
    } = req.body || {};

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
            services,
            cities: Array.isArray(cities) ? cities : [city],
            generate_services: generate_services !== false,
            generate_cities: generate_cities !== false,
            generate_service_cities: generate_service_cities !== false,
            website_preset,
            primary_color,
            build_brief
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

/**
 * POST /api/websites/subdomain
 * Customizes the website subdomain after validation and uniqueness checks.
 */
export async function updateSubdomainApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { subdomain, website_id } = req.body || {};

    if (!subdomain) {
        return {
            status: 400,
            success: false,
            error: 'Subdomain is required.'
        };
    }

    try {
        let websiteId = website_id;
        
        // Resolve website container if websiteId was omitted
        if (!websiteId) {
            const userSite = await WebsitesRepo.getWebsiteByUser(req.user!.id);
            if (!userSite) {
                return {
                    status: 404,
                    success: false,
                    error: 'WEBSITE_NOT_FOUND',
                    message: 'No website container was found for this account.'
                };
            }
            websiteId = userSite.id;
        }

        const updated = await WebsitesRepo.updateWebsiteSubdomain(req.user!.id, websiteId, subdomain);

        return {
            status: 200,
            success: true,
            data: {
                id: updated.id,
                subdomain: updated.subdomain,
                public_url: updated.domain ? `https://${updated.domain}` : `https://${updated.subdomain}.pressurepro.io`
            }
        };
    } catch (e: any) {
        console.error('[API: WEBSITES] Subdomain update failed:', e.message);
        
        // Customize status codes based on validation/collision errors
        let status = 500;
        let errorCode = 'INTERNAL_ERROR';
        
        if (e.message.startsWith('VALIDATION_ERROR:')) {
            status = 400;
            errorCode = 'VALIDATION_ERROR';
        } else if (e.message.startsWith('SUBDOMAIN_ALREADY_TAKEN:')) {
            status = 409;
            errorCode = 'COLLISION_ERROR';
        } else if (e.message.startsWith('UNAUTHORIZED_ACCESS:')) {
            status = 403;
            errorCode = 'FORBIDDEN';
        }

        return {
            status,
            success: false,
            error: errorCode,
            message: e.message.replace(/^[A-Z_]+:\s*/, '') // Clean up error prefix for client
        };
    }
}

/**
 * POST /api/websites/domain
 * Sets or clears the custom domain for the operator's website.
 * Passing domain: "" clears the custom domain (falls back to subdomain URL).
 */
export async function updateDomainApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { domain, website_id } = req.body || {};

    // domain is required in body (empty string is valid — it means "clear")
    if (domain === undefined || domain === null) {
        return {
            status: 400,
            success: false,
            error: 'MISSING_FIELD',
            message: 'domain field is required (send empty string to clear).'
        };
    }

    try {
        let websiteId = website_id;

        // Resolve website container if websiteId was omitted
        if (!websiteId) {
            const userSite = await WebsitesRepo.getWebsiteByUser(req.user!.id);
            if (!userSite) {
                return {
                    status: 404,
                    success: false,
                    error: 'WEBSITE_NOT_FOUND',
                    message: 'No website container was found for this account.'
                };
            }
            websiteId = userSite.id;
        }

        const updated = await WebsitesRepo.updateWebsiteDomain(req.user!.id, websiteId, domain);

        const publicUrl = updated.domain
            ? `https://${updated.domain}`
            : `https://${updated.subdomain}.pressurepro.io`;

        return {
            status: 200,
            success: true,
            data: {
                id: updated.id,
                domain: updated.domain || null,
                subdomain: updated.subdomain,
                public_url: publicUrl,
                dns_status: updated.domain ? 'unverified' : 'n/a'
            }
        };
    } catch (e: any) {
        console.error('[API: WEBSITES] Domain update failed:', e.message);

        let status = 500;
        let errorCode = 'INTERNAL_ERROR';

        if (e.message.startsWith('VALIDATION_ERROR:')) {
            status = 400;
            errorCode = 'VALIDATION_ERROR';
        } else if (e.message.startsWith('DOMAIN_ALREADY_TAKEN:')) {
            status = 409;
            errorCode = 'COLLISION_ERROR';
        } else if (e.message.startsWith('UNAUTHORIZED_ACCESS:')) {
            status = 403;
            errorCode = 'FORBIDDEN';
        }

        return {
            status,
            success: false,
            error: errorCode,
            message: e.message.replace(/^[A-Z_]+:\s*/, '')
        };
    }
}

/**
 * POST /api/pages/from-prompt
 * Generates a single draft page from a PromptPageBrief.
 */
export async function generatePageFromPromptApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const brief = req.body || {};
    if (!brief.page_type || !brief.prompt) {
        return {
            status: 400,
            success: false,
            error: 'Invalid input. page_type and prompt are required.'
        };
    }

    try {
        const result = await WebsiteGeneratorService.generateSinglePageFromPromptBrief(req.user!.id, brief);
        return {
            status: 201,
            success: true,
            data: result
        };
    } catch (e: any) {
        console.error('[API: PAGES] Single page prompt generation failed:', e.message);
        return {
            status: 500,
            success: false,
            error: e.message || 'An error occurred during page draft generation.'
        };
    }
}
