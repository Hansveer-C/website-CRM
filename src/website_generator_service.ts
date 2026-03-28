import { WebsitesRepo } from './websites_repo_supabase';
import { FunnelsRepo } from './funnels_repo_supabase';
import { PagesRepo } from './pages_repo_supabase';
import { WebsiteRoutesRepo } from './website_routes_repo_supabase';
import { WebsiteLayoutsRepo } from './website_layouts_repo_supabase';
import { FunnelTemplatesRepo } from './funnel_templates_repo';
import { SectionsRepo } from './sections_repo_supabase';
import { getWebsiteSettings } from './website_settings_repo';
import { Funnel, Page, HeaderConfig, NavItem } from './types';
import { generateServiceCitySlug } from './utils/url_utils';

/**
 * Service for automated website and funnel generation.
 * WB.2.2 - Full website + funnels from onboarding inputs.
 */
export const WebsiteGeneratorService = {
  /**
   * Generates a complete website structure based on user inputs.
   */
  async generateWebsiteFromInput(userId: string, input: { 
    business_name: string; 
    phone_number: string; 
    city: string; 
    services: string[];
  }) {
    console.log(`[GENERATOR] Starting website generation for ${userId} (${input.business_name})`);

    const createdIds = {
        website_id: '',
        funnel_ids: [] as string[],
        page_ids: [] as string[],
        route_ids: [] as string[]
    };

    // ── Helper: rollback on failure ─────────────────────────────────────────
    const rollback = async (error: any) => {
        console.error('[GENERATOR] Generation failed, rolling back...', error);
        
        // Delete routes
        for (const rid of createdIds.route_ids) {
            await WebsiteRoutesRepo.deleteRoute(rid).catch(() => {});
        }

        // Delete sections
        const sids = (createdIds as any).section_ids || [];
        for (const sid of sids) {
            await SectionsRepo.deleteSection(sid, userId).catch(() => {});
        }
        
        // Delete pages
        for (const pid of createdIds.page_ids) {
            await PagesRepo.deletePage(pid, userId).catch(() => {});
        }
        
        // Delete funnels (mark as draft if no delete)
        for (const fid of createdIds.funnel_ids) {
            await FunnelsRepo.updateFunnel(userId, fid, { status: 'draft' }).catch(() => {});
        }

        // We don't delete the website container if it already existed, 
        // but if we just created it, we might want to (optional).
        
        throw error;
    };

    try {
        // ── 1. Fetch/Create Website ──────────────────────────────────────────
        let website = await WebsitesRepo.getWebsiteByUser(userId);
        if (!website) {
            website = await WebsitesRepo.createWebsite(userId, input.business_name);
            createdIds.website_id = website.id;
        }

        // ── 2. Identify Templates ───────────────────────────────────────────
        const templateMap: Record<string, string> = {
            'Driveway Cleaning': 'dc54de07-5ea2-46f7-b513-85149306449c',
            'House Washing': '4e4da69c-ebd8-432c-bbef-5e291d08812b',
            'Patio Cleaning': '0d3214fb-2777-41fa-9837-4a6fddc660ec',
            'Other': '0d3214fb-2777-41fa-9837-4a6fddc660ec'
        };
        const defaultTplId = '0d3214fb-2777-41fa-9837-4a6fddc660ec';

        const serviceLinks = input.services.map(s => ({ name: s, path: generateServiceCitySlug(s, input.city) }));

        // ── 3. Create Homepage Funnel ───────────────────────────────────────
        // Only if no homepage is set yet
        let homeFunnelId = website.homepage_funnel_id;
        if (!homeFunnelId) {
            const homeFunnel = await this.createFunnelFromTemplate(userId, defaultTplId, 'Home', input.city, createdIds, { businessName: input.business_name });
            createdIds.funnel_ids.push(homeFunnel.id);
            homeFunnelId = homeFunnel.id;
            
            // Create high-converting sections for the homepage (WB.2.3)
            const homepageLandingPageId = createdIds.page_ids.find(pid => pid.startsWith(`pg_${homeFunnelId}_1`));
            if (homepageLandingPageId) {
                const primaryService = input.services[0] || 'Professional Service';
                await this.createHomepageSections(homepageLandingPageId, primaryService, input.city, userId, createdIds, serviceLinks);
            }
            
            // Update website with homepage reference
            await WebsitesRepo.updateWebsite({ id: website.id, homepage_funnel_id: homeFunnelId });
        }

        // ── 4. Create Service Funnels ───────────────────────────────────────
        const serviceFunnelEntries: { name: string; funnel_id: string; path: string }[] = [];
        const existingFunnelsRes = await FunnelsRepo.getFunnels(userId);
        const existingFunnels = existingFunnelsRes.data || [];

        for (const service of input.services) {
            const path = generateServiceCitySlug(service, input.city);

            // Check if funnel already exists by name (minimal idempotency)
            let serviceFunnel = existingFunnels.find(f => f.name === service);
            if (!serviceFunnel) {
                const tplId = templateMap[service] || defaultTplId;
                serviceFunnel = await this.createFunnelFromTemplate(userId, tplId, service, input.city, createdIds, { businessName: input.business_name, serviceName: service });
                createdIds.funnel_ids.push(serviceFunnel.id);
                
                // W2.4: Add service-specific content
                const landingPageId = createdIds.page_ids.find(pid => pid.startsWith(`pg_${serviceFunnel!.id}_1`));
                if (landingPageId) {
                    await this.createServiceSpecificSections(landingPageId, service, input.city, userId, createdIds);
                }

                // Tag funnel (W2.4)
                await FunnelsRepo.updateFunnel(userId, serviceFunnel.id, { 
                    service_type: service, 
                    city: input.city 
                });
            }
            
            serviceFunnelEntries.push({ name: service, funnel_id: serviceFunnel.id, path });
        }

        // ── 5. Create Contact Funnel ─────────────────────────────────────
        let contactFunnel = existingFunnels.find(f => f.name === 'Contact Us');
        if (!contactFunnel) {
            const cf = await this.createFunnelFromTemplate(userId, defaultTplId, 'Contact Us', input.city, createdIds, { businessName: input.business_name });
            contactFunnel = cf;
            createdIds.funnel_ids.push(cf.id);
            
            // W2.5: Add contact-specific content
            const contactLandingPageId = createdIds.page_ids.find(pid => pid.startsWith(`pg_${cf.id}_1`));
            if (contactLandingPageId) {
                await this.createContactSections(contactLandingPageId, input.phone_number, input.business_name, userId, createdIds);
            }
        }

        // ── 6. Assign Routes ───────────────────────────────────────────────
        const existingRoutes = await WebsiteRoutesRepo.getAllRoutes(website.id);

        const upsertRouteHelper = async (path: string, funnel_id: string, isSeo?: boolean, service?: string) => {
            const exists = existingRoutes.find(r => r.path === path);
            if (exists) {
                if (exists.funnel_id !== funnel_id) {
                    // Update if pointing to different funnel
                    await WebsiteRoutesRepo.deleteRoute(exists.id); // Re-add or update
                    const route = await WebsiteRoutesRepo.addRoute(website.id, path, funnel_id, {
                        is_seo_page: isSeo,
                        service: service,
                        city: input.city,
                        slug: path.replace(/^\//, '') || 'home'
                    });
                    createdIds.route_ids.push(route.id);
                }
            } else {
                const route = await WebsiteRoutesRepo.addRoute(website.id, path, funnel_id, {
                    is_seo_page: isSeo,
                    service: service,
                    city: input.city,
                    slug: path.replace(/^\//, '') || 'home'
                });
                createdIds.route_ids.push(route.id);
            }
        };

        // Homepage
        await upsertRouteHelper('/', homeFunnelId, false);

        // Services
        for (const s of serviceFunnelEntries) {
            await upsertRouteHelper(s.path, s.funnel_id, true, s.name);
        }

        // Contact
        if (!contactFunnel) {
            // Should not happen as we created it above, but to satisfy TS
            const found = await FunnelsRepo.getFunnels(userId);
            contactFunnel = found.data?.find(f => f.name === 'Contact Us');
        }
        if (contactFunnel) {
            await upsertRouteHelper('/contact', contactFunnel.id, false);
        }

        // ── 7. Generate Navigation & Layout ────────────────────────────────
        const navItems: NavItem[] = [
            { label: 'Home', path: '/' }
        ];

        if (serviceFunnelEntries.length > 0) {
            navItems.push({
                label: 'Services',
                path: '#', // Placeholder for dropdown trigger
                children: serviceFunnelEntries.map(s => ({ label: s.name, path: s.path }))
            });
        }

        navItems.push({ label: 'Contact', path: '/contact' });

        const headerConfig: HeaderConfig = {
            logo_text: input.business_name,
            nav_items: navItems,
            cta_text: 'Get a Quote',
            cta_link: '/contact'
        };

        await WebsiteLayoutsRepo.upsertLayout(website.id, {
            header_config: headerConfig,
            footer_config: { 
                business_name: input.business_name,
                phone: input.phone_number,
                phone_link: `tel:${input.phone_number.replace(/\D/g, '')}`,
                serving_area: `Serving ${input.city} and surrounding areas`,
                cta: { label: 'Call Now', path: `tel:${input.phone_number.replace(/\D/g, '')}` },
                copyright: `© ${new Date().getFullYear()} ${input.business_name}. All rights reserved.`
            }
        });

        console.log(`[GENERATOR] Successfully generated website for ${userId}`);
        return {
            website_id: website.id,
            homepage_id: homeFunnelId,
            routes_count: createdIds.route_ids.length
        };

    } catch (e) {
        return await rollback(e);
    }
  },

  /**
   * Internal helper to create a funnel and its steps from a template.
   */
  async createFunnelFromTemplate(userId: string, templateId: string, name: string, city: string, createdIds: any, options: { businessName?: string, serviceName?: string } = {}): Promise<Funnel> {
    const tplRes = await FunnelTemplatesRepo.getTemplateById(templateId);
    if (!tplRes.success || !tplRes.data) {
        throw new Error(`TEMPLATE_NOT_FOUND: ${templateId}`);
    }

    const template = tplRes.data;
    const funnelRes = await FunnelsRepo.createFunnel(userId, name);
    if (!funnelRes.success || !funnelRes.data) {
        throw new Error(`FUNNEL_CREATION_FAILED: ${funnelRes.error}`);
    }

    const funnel = funnelRes.data;
    // Set to published
    await FunnelsRepo.updateFunnel(userId, funnel.id, { status: 'published' });
    funnel.status = 'published';

    const hydrate = (text: string): string => {
        let out = text;
        if (city) out = out.replace(/\{\{city\}\}/gi, city);
        if (options.serviceName) out = out.replace(/\{\{service\}\}/gi, options.serviceName);
        if (options.businessName) out = out.replace(/\{\{business_name\}\}/gi, options.businessName);
        return out;
    };
    const hydrateContent = (obj: any): any => {
        if (typeof obj === 'string') return hydrate(obj);
        if (Array.isArray(obj)) return obj.map(i => hydrateContent(i));
        if (obj && typeof obj === 'object') {
            const out: any = {};
            for (const [k, v] of Object.entries(obj)) {
                out[k] = hydrateContent(v);
            }
            return out;
        }
        return obj;
    };

    for (const tplStep of (template.steps || [])) {
        const pageId = `pg_${funnel.id}_${tplStep.order}_${Date.now()}`;
        const content = hydrateContent(tplStep.template_content);
        
        const page: Page = {
            id:         pageId,
            user_id:    userId,
            name:       content.headline || content.title || `${name} Step ${tplStep.order}`,
            slug:       `${name.toLowerCase().replace(/\s+/g, '-')}-${tplStep.type}-${tplStep.order}-${Date.now()}`,
            status:     'published',
            created_at: new Date().toISOString(),
            funnel_id:  funnel.id,
            step_type:  tplStep.type,
            step_order: tplStep.order,
            seo_title:  options.serviceName && city && options.businessName 
                        ? `${options.serviceName} in ${city} | ${options.businessName}`
                        : hydrate(content.headline || content.title || name),
            seo_description: options.serviceName && city 
                        ? `Affordable ${options.serviceName} in ${city}. Get a free quote today.`
                        : '',
            seo_keywords: []
        };

        const pageRes = await PagesRepo.persistPage(page, userId);
        if (!pageRes.success) {
            throw new Error(`PAGE_PERSIST_FAILED: ${pageRes.error}`);
        }
        createdIds.page_ids.push(pageId);
    }

    return funnel;
  },

  /**
   * Internal helper to create high-converting sections for the homepage.
   */
  async createHomepageSections(pageId: string, service: string, city: string, userId: string, createdIds: any, serviceLinks: {name: string, path: string}[] = []) {
    // Prevent duplication: check if sections already exist (WB.2.10)
    const existing = await SectionsRepo.getSectionsForPage(pageId, userId);
    if (existing && (existing as any).data?.length > 0) {
        console.log(`[GENERATOR] Skipping sections for page ${pageId} - already exists.`);
        return;
    }

    const hydrate = (text: string) => text.replace(/\{\{service\}\}/gi, service).replace(/\{\{city\}\}/gi, city);

    const sections = [
        {
            type: 'hero',
            order: 1,
            content: {
                headline: hydrate('{{service}} in {{city}}'),
                subtext: 'Fast, affordable, same-day service',
                cta: 'Get Free Quote'
            }
        },
        {
            type: 'proof',
            order: 2,
            content: {
                title: 'What our customers say',
                testimonials: [
                    { author: 'Jane S.', text: 'Great service, was happy with the results!' },
                    { author: 'Mike R.', text: 'The team was professional and on-time.' },
                    { author: 'Sam T.', text: 'Will definitely use them again for our next project.' }
                ]
            }
        },
        {
            type: 'offer',
            order: 3,
            content: {
                highlight: 'Special Launch Offer',
                title: '10% off your first service',
                description: 'Limited time offer for new customers in {{city}}.'
            }
        },
        {
            type: 'form',
            order: 4,
            content: {
                title: 'Get Your Quote Now',
                fields: ['name', 'phone'],
                submit_label: 'Send My Request'
            }
        },
        {
            type: 'faq',
            order: 5,
            content: {
                title: 'Frequently Asked Questions',
                questions: [
                    { q: 'Do you offer same-day service?', a: 'Yes, we strive to accommodate same-day requests whenever possible.' },
                    { q: 'Are you insured?', a: 'Absolutely. We are fully insured and bonded for your peace of mind.' },
                    { q: 'How do I get an estimate?', a: 'Simply fill out our online form or give us a call for a free, no-obligation quote.' },
                    { q: 'What coverage areas do you serve?', a: hydrate('We serve {{city}} and the surrounding communities.') }
                ]
            }
        },
        {
            type: 'services',
            order: 6,
            content: {
                title: hydrate('Our Services in {{city}}'),
                service_links: serviceLinks.map(s => ({ label: s.name, path: s.path }))
            }
        }
    ];

    for (const s of sections) {
        const sectionId = `sec_${pageId}_${s.order}_${Date.now()}`;
        const res = await SectionsRepo.persistSection({
            id: sectionId,
            page_id: pageId,
            type: s.type,
            content: s.content,
            order: s.order,
            styles: {}
        }, userId);

        if (res.success) {
            createdIds.section_ids = createdIds.section_ids || [];
            createdIds.section_ids.push(sectionId);
        }
    }
  },

  /**
   * Internal helper to create service-specific SEO + conversion sections.
   */
  async createServiceSpecificSections(pageId: string, service: string, city: string, userId: string, createdIds: any) {
    // Prevent duplication: check if sections already exist (WB.2.10)
    const existing = await SectionsRepo.getSectionsForPage(pageId, userId);
    if (existing && (existing as any).data?.length > 0) {
        console.log(`[GENERATOR] Skipping sections for service page ${pageId} - already exists.`);
        return;
    }

    const hydrate = (text: string) => text.replace(/\{\{service\}\}/gi, service).replace(/\{\{city\}\}/gi, city);

    const benefitMap: Record<string, string[]> = {
        'Driveway Cleaning': ['Remove oil and grease stains', 'Prevent cracks and weed growth', 'Restore like-new appearance'],
        'House Washing': ['Remove mold and mildew safely', 'Protect and preserve siding lifespan', 'Instant property curb appeal boost'],
        'Patio Cleaning': ['Safe for stone, concrete, and wood', 'Eradicate slippery moss/algae', 'Ready for outdoor entertaining']
    };
    const benefits = benefitMap[service] || ['Professional-grade equipment', '100% Satisfaction Guarantee', 'Eco-friendly cleaning solutions'];

    const sections = [
        {
            type: 'hero',
            order: 1,
            content: {
                headline: hydrate('{{service}} in {{city}}'),
                subtext: 'High-performance cleaning with industry-leading results.',
                cta: 'Get Free Quote'
            }
        },
        {
            type: 'benefits',
            order: 2,
            content: {
                title: hydrate('Why Choice us for {{service}}'),
                benefits: benefits
            }
        },
        {
            type: 'before_after',
            order: 3,
            content: {
                title: 'See the results for ourselves',
                description: hydrate('Actual {{service}} results from our recent work in {{city}}.'),
                before_image: 'https://placehold.co/600x400/333333/FFFFFF?text=BEFORE',
                after_image: 'https://placehold.co/600x400/2563eb/FFFFFF?text=AFTER'
            }
        },
        {
            type: 'cta',
            order: 4,
            content: {
                headline: hydrate('Ready for your {{service}} transformation?'),
                subtext: 'Contact us today for a free estimate.',
                cta: 'Request Quote',
                form_enabled: true
            }
        }
    ];

    for (const s of sections) {
        const sectionId = `sec_${pageId}_${s.order}_${Date.now()}`;
        const res = await SectionsRepo.persistSection({
            id: sectionId,
            page_id: pageId,
            type: s.type,
            content: s.content,
            order: s.order,
            styles: {}
        }, userId);

        if (res.success) {
            createdIds.section_ids = createdIds.section_ids || [];
            createdIds.section_ids.push(sectionId);
        }
    }
  },

  /**
   * Internal helper to create structured sections for the contact page.
   */
  async createContactSections(pageId: string, phone: string, businessName: string, userId: string, createdIds: any) {
    // Prevent duplication: check if sections already exist (WB.2.10)
    const existing = await SectionsRepo.getSectionsForPage(pageId, userId);
    if (existing && (existing as any).data?.length > 0) {
        console.log(`[GENERATOR] Skipping sections for contact page ${pageId} - already exists.`);
        return;
    }

    const sections = [
        {
            type: 'hero',
            order: 1,
            content: {
                headline: 'Contact Us',
                subtext: `We're here to help you restore your home's beauty. Reach out for a free, no-obligation quote or any questions about our services in your area.`,
                cta_enabled: false
            }
        },
        {
            type: 'contact_info',
            order: 2,
            content: {
                title: 'Get in Touch',
                phone: phone,
                phone_link: `tel:${phone.replace(/\D/g, '')}`,
                business_name: businessName,
                hours: 'Mon-Fri: 8am - 6pm'
            }
        },
        {
            type: 'form',
            order: 3,
            content: {
                title: 'Send Us a Message',
                subtitle: 'We typically respond within 24 hours.',
                fields: ['name', 'phone'],
                submit_label: 'Send Message'
            }
        },
        {
            type: 'map',
            order: 4,
            content: {
                title: 'Our Service Coverage',
                map_placeholder: true,
                description: `Serving ${businessName}'s service area and surrounding communities.`
            }
        }
    ];

    for (const s of sections) {
        const sectionId = `sec_${pageId}_${s.order}_${Date.now()}`;
        const res = await SectionsRepo.persistSection({
            id: sectionId,
            page_id: pageId,
            type: s.type,
            content: s.content,
            order: s.order,
            styles: {}
        }, userId);

        if (res.success) {
            createdIds.section_ids = createdIds.section_ids || [];
            createdIds.section_ids.push(sectionId);
        }
    }
  },

  /**
   * Generates a high-intent SEO funnel for a specific service and city.
   * PROMPT W3.3
   */
  async generateSeoFunnel(userId: string, websiteId: string, service: string, city: string, businessName?: string) {
    console.log(`[GENERATOR] Generating SEO funnel for ${service} in ${city} (user: ${userId})`);

    const createdIds = {
        funnel_ids: [] as string[],
        page_ids: [] as string[],
        route_ids: [] as string[],
        section_ids: [] as string[]
    };

    // 1. Identify Template
    const defaultTplId = '0d3214fb-2777-41fa-9837-4a6fddc660ec';
    
    // 2. Create Funnel
    const funnel = await this.createFunnelFromTemplate(userId, defaultTplId, `${service} - ${city}`, city, createdIds, { businessName, serviceName: service });
    await FunnelsRepo.updateFunnel(userId, funnel.id, { 
        service_type: service, 
        city: city 
    });

    // 3. Create Custom SEO Sections (W3.3)
    const landingPageId = createdIds.page_ids.find(pid => pid.startsWith(`pg_${funnel.id}_1`));
    if (landingPageId) {
        await this.createSeoSpecificSections(landingPageId, service, city, userId, createdIds);
    }

    // 4. Register Route
    const path = generateServiceCitySlug(service, city);
    const route = await WebsiteRoutesRepo.addRoute(websiteId, path, funnel.id, {
        is_seo_page: true,
        service: service,
        city: city,
        slug: path.replace(/^\//, '')
    });
    createdIds.route_ids.push(route.id);

    return {
        funnel_id: funnel.id,
        path: path,
        route_id: route.id,
        page_id: landingPageId
    };
  },

  /**
   * Internal helper for SEO-specific high-intent sections.
   * W3.3
   */
  async createSeoSpecificSections(pageId: string, service: string, city: string, userId: string, createdIds: any) {
    const hydrate = (text: string) => text.replace(/\{\{service\}\}/gi, service).replace(/\{\{city\}\}/gi, city);

    const sections = [
        {
            type: 'hero',
            order: 1,
            content: {
                headline: hydrate('{{service}} in {{city}}'),
                subtext: hydrate('Professional {{service}} with fast turnaround'),
                cta: 'Get Free Quote'
            }
        },
        {
            type: 'benefits',
            order: 2,
            content: {
                title: hydrate('Expert {{service}} for your home'),
                benefits: [
                    'Professional-grade equipment',
                    '100% Satisfaction Guarantee',
                    'Eco-friendly cleaning solutions'
                ]
            }
        },
        {
            type: 'before_after',
            order: 3,
            content: {
                title: 'See the results for yourself',
                description: hydrate('Actual {{service}} results from our recent work in {{city}}.'),
                before_image: 'https://placehold.co/600x400/333333/FFFFFF?text=BEFORE',
                after_image: 'https://placehold.co/600x400/2563eb/FFFFFF?text=AFTER'
            }
        },
        {
            type: 'cta',
            order: 4,
            content: {
                headline: hydrate('Ready for your {{service}} transformation?'),
                subtext: 'Contact us today for a free estimate.',
                cta: 'Request Quote',
                form_enabled: true,
                secondary_cta: 'Contact Us',
                secondary_link: '/contact'
            }
        },
        {
            type: 'faq',
            order: 5,
            content: {
                title: 'Frequently Asked Questions',
                items: [
                    { question: hydrate('How much does {{service}} cost in {{city}}?'), answer: hydrate('Pricing for {{service}} varies based on project size, but we offer instant, transparent quotes for all {{city}} homeowners.') },
                    { question: hydrate('Do you offer same-day {{service}}?'), answer: 'Yes, we strive to accommodate same-day requests whenever possible.' }
                ],
                footer_links: [
                    { label: 'Back to Home', path: '/' },
                    { label: 'Contact Us', path: '/contact' }
                ]
            }
        }
    ];

    for (const s of sections) {
        const sectionId = `sec_${pageId}_${s.order}_${Date.now()}`;
        await SectionsRepo.persistSection({
            id: sectionId,
            page_id: pageId,
            type: s.type,
            content: s.content,
            order: s.order,
            styles: {}
        }, userId);
        createdIds.section_ids = createdIds.section_ids || [];
        createdIds.section_ids.push(sectionId);
    }

    // ── 6. Generate FAQ Schema (JSON-LD) (PROMPT W3.7) ───────────────────
    const faqData = sections.find(s => s.type === 'faq')?.content;
    if (faqData && faqData.items) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqData.items.map((item: any) => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer
                }
            }))
        };
        
        const pageRes = await PagesRepo.getPage(pageId, userId);
        if (pageRes.success && pageRes.data) {
            const updatedPage = {
                ...pageRes.data,
                schema_markup: JSON.stringify(schema, null, 2)
            };
            await PagesRepo.persistPage(updatedPage, userId);
        }
    }
  },

  /**
   * Generates a bulk set of SEO pages for multiple services and cities.
   * PROMPT W3.4
   */
  async generateBulkSeoPages(userId: string, websiteId: string, services: string[], cities: string[]) {
    console.log(`[GENERATOR] Starting bulk SEO generation for ${userId} (services: ${services.length}, cities: ${cities.length})`);
    
    // Fetch business name for SEO metadata (W3.6)
    const settingsRes = await getWebsiteSettings();
    const businessName = settingsRes.data?.business_name;

    // 1. Build and limit combinations
    const combinations: { service: string; city: string }[] = [];
    for (const s of services) {
        for (const c of cities) {
            combinations.push({ service: s, city: c });
        }
    }

    const MAX_PAGES = 50;
    const batch = combinations.slice(0, MAX_PAGES);
    console.log(`[GENERATOR] Processing batch of ${batch.length} combinations...`);

    // 2. Fetch existing routes for idempotency (W3.4)
    const existingRoutes = await WebsiteRoutesRepo.getAllRoutes(websiteId);
    const existingPaths = new Set(existingRoutes.map(r => r.path));

    const results = {
        created: 0,
        skipped: 0,
        errors: 0
    };

    // 3. Process batch sequentially to avoid overloading
    for (const combo of batch) {
        const path = generateServiceCitySlug(combo.service, combo.city);
        
        if (existingPaths.has(path)) {
            console.log(`[GENERATOR] Skipping duplicate path: ${path}`);
            results.skipped++;
            continue;
        }

        try {
            await this.generateSeoFunnel(userId, websiteId, combo.service, combo.city, businessName);
            results.created++;
            existingPaths.add(path); // Update local set
        } catch (e: any) {
            // Log error but continue with other combinations
            console.error(`[GENERATOR] Error creating SEO page for ${combo.service} in ${combo.city}:`, e.message);
            results.errors++;
        }
    }

    console.log(`[GENERATOR] Bulk generation complete: Created ${results.created}, Skipped ${results.skipped}, Errors ${results.errors}`);
    return results;
  }
};
