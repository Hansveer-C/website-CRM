import { supabase, safeDbCall } from './utils/db/supabase';
import { FunnelTemplate, TemplateStep, RepoResponse } from './types';
import { mockTemplates } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Read-only access to shared funnel templates (no user scoping needed –
 * templates are global blueprints, not per-user records).
 *
 * WB.2.1 – Funnel Template support
 */
export const FunnelTemplatesRepo = {
  /**
   * Returns all available funnel templates (metadata only, no steps).
   * Ordered by category then name for consistent UI presentation.
   */
  async getTemplates(): Promise<RepoResponse<FunnelTemplate[]>> {
    if (!hasSupabase) {
      return { success: true, data: mockTemplates as unknown as FunnelTemplate[] };
    }

    return safeDbCall<FunnelTemplate[]>(
      'GET_FUNNEL_TEMPLATES',
      'system',
      supabase
        .from('funnel_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
    );
  },

  async getTemplateById(templateId: string): Promise<RepoResponse<FunnelTemplate>> {
    if (!hasSupabase) {
      const template = mockTemplates.find(t => t.id === templateId) || mockTemplates[0];
      if (template) {
        const funnelTemplate: FunnelTemplate = {
          id: template.id,
          name: template.name,
          category: 'pressure_washing',
          service_type: 'generic',
          city_placeholder_enabled: true,
          created_at: template.created_at,
          steps: [
            {
              id: `step-${template.id}-1`,
              template_id: template.id,
              type: 'landing',
              order: 1,
              template_content: {
                headline: '{{service}} in {{city}}',
                title: '{{service}} in {{city}}'
              }
            }
          ]
        };
        return { success: true, data: funnelTemplate };
      }
      return { success: false, error: 'TEMPLATE_NOT_FOUND' };
    }

    // Fetch the template header
    const templateRes = await safeDbCall<FunnelTemplate>(
      'GET_FUNNEL_TEMPLATE_BY_ID',
      'system',
      supabase
        .from('funnel_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle()
    );

    if (!templateRes.success || !templateRes.data) {
      return templateRes;
    }

    // Fetch the associated steps
    const stepsRes = await safeDbCall<TemplateStep[]>(
      'GET_TEMPLATE_STEPS',
      'system',
      supabase
        .from('template_steps')
        .select('*')
        .eq('template_id', templateId)
        .order('order', { ascending: true })
    );

    return {
      success: true,
      data: {
        ...templateRes.data,
        steps: stepsRes.data || []
      }
    };
  }
};
