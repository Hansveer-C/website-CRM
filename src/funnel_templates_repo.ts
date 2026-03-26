import { supabase, safeDbCall } from './utils/db/supabase';
import { FunnelTemplate, TemplateStep, RepoResponse } from './types';

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

  /**
   * Returns a single template by ID, including its ordered steps.
   * Used when a user selects a template to preview or apply to a funnel.
   */
  async getTemplateById(templateId: string): Promise<RepoResponse<FunnelTemplate>> {
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
