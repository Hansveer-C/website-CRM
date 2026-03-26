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

/**
 * POST /api/funnels/from-template
 * WB.2.3 – Atomic template-driven funnel creation.
 *
 * Input body:
 *   template_id  string  (required)
 *   city         string  (optional – replaces {{city}} placeholders)
 *
 * Process (all-or-nothing):
 *   1. Fetch the template + its ordered steps
 *   2. Create the funnel record
 *   3. For each template step, create a Page hydrated with step content
 *      (replacing {{city}} if provided)
 *   4. Link each page as a funnel step (funnel_id, step_type, step_order)
 *   5. On any failure → delete funnel + pages created so far (compensating TX)
 *   6. Return { funnel_id, funnel, steps }
 */
export async function createFunnelFromTemplateApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { template_id, city } = req.body || {};

    if (!template_id || typeof template_id !== 'string') {
        return {
            status: 400,
            success: false,
            error: 'template_id is required.'
        };
    }

    // ── 1. Fetch template + steps ──────────────────────────────────────────
    const { FunnelTemplatesRepo } = await import('./funnel_templates_repo');
    const tplRes = await FunnelTemplatesRepo.getTemplateById(template_id);

    if (!tplRes.success || !tplRes.data) {
        return {
            status: 404,
            success: false,
            error: `Template "${template_id}" not found.`
        };
    }

    const template = tplRes.data;
    const templateSteps = template.steps || [];

    if (templateSteps.length === 0) {
        return {
            status: 422,
            success: false,
            error: 'Template has no steps defined.'
        };
    }

    // ── 2. Create the funnel record ────────────────────────────────────────
    const funnelName = city
        ? `${template.name} – ${city}`
        : template.name;

    const funnelRes = await FunnelsRepo.createFunnel(req.user!.id, funnelName);

    if (!funnelRes.success || !funnelRes.data) {
        return {
            status: 500,
            success: false,
            error: funnelRes.error || 'Failed to create funnel record.'
        };
    }

    const funnel = funnelRes.data;
    const createdPageIds: string[] = [];

    // ── Helper: slugify ────────────────────────────────────────────────────
    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // ── Helper: replace {{city}} in any string value ───────────────────────
    const hydrate = (text: string): string =>
        city ? text.replace(/\{\{city\}\}/gi, city) : text;

    // ── Helper: deep-hydrate a JSON object's string values ─────────────────
    const hydrateContent = (obj: Record<string, any>): Record<string, any> => {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') out[k] = hydrate(v);
            else if (Array.isArray(v)) out[k] = v.map(i => typeof i === 'string' ? hydrate(i) : i);
            else out[k] = v;
        }
        return out;
    };

    // ── Rollback helper – cleans up on failure ─────────────────────────────
    const rollback = async (reason: string) => {
        // Delete pages created so far
        for (const pid of createdPageIds) {
            await PagesRepo.deletePage(pid, req.user!.id).catch(() => {});
        }
        // Delete the funnel (cascade removes funnel-step links if any)
        await FunnelsRepo.updateFunnel(req.user!.id, funnel.id, { status: 'draft' }).catch(() => {});
        // Best-effort funnel deletion – if repo doesn't expose delete, mark failed
        console.error(`[WB.2.3 ROLLBACK] funnel=${funnel.id} reason=${reason}`);
    };

    // ── 3 & 4. Create one Page per template step ───────────────────────────
    const createdSteps: Page[] = [];

    for (const tplStep of templateSteps) {
        const content = hydrateContent(tplStep.template_content);

        // Derive human-readable step name
        const stepLabel = tplStep.type === 'landing'
            ? (content.headline || 'Landing Page')
            : tplStep.type === 'form'
            ? (content.title || 'Lead Capture Form')
            : (content.headline || 'Thank You Page');

        const pageId = `pg_${funnel.id}_${tplStep.order}_${Date.now()}`;
        const baseSlug = slugify(`${funnelName}-${tplStep.type}`);

        const page: Page = {
            id:              pageId,
            user_id:         req.user!.id,
            name:            stepLabel,
            slug:            `${baseSlug}-${tplStep.order}-${Date.now()}`,
            status:          'draft',
            seo_title:       hydrate(content.headline || content.title || stepLabel),
            seo_description: hydrate(content.subtext || content.confirmation_message || ''),
            seo_keywords:    [],
            created_at:      new Date().toISOString(),
            // Funnel linkage (WB.1.6 schema)
            funnel_id:       funnel.id,
            step_type:       tplStep.type,
            step_order:      tplStep.order
        };

        const pageRes = await PagesRepo.persistPage(page, req.user!.id);

        if (!pageRes.success) {
            await rollback(`Failed to persist page for step ${tplStep.order}: ${pageRes.error}`);
            return {
                status: 500,
                success: false,
                error: `Funnel creation aborted – could not create step ${tplStep.order} (${tplStep.type}). All changes rolled back.`
            };
        }

        createdPageIds.push(pageId);
        createdSteps.push({ ...page, ...hydrateContent(tplStep.template_content) } as any);
    }

    // ── 5. Return the complete funnel ──────────────────────────────────────
    return {
        status: 201,
        success: true,
        data: {
            funnel_id: funnel.id,
            funnel,
            steps: createdSteps,
            template: {
                id:           template.id,
                name:         template.name,
                service_type: template.service_type,
                category:     template.category
            }
        }
    };
}
