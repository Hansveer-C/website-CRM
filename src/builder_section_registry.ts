import type { PageSection } from './types';

export type BuilderSectionCategory =
  | 'essentials'
  | 'trust'
  | 'conversion'
  | 'content';

export interface BuilderSectionVariantDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface BuilderSectionDefinition {
  type: string;
  label: string;
  description: string;
  category: BuilderSectionCategory;
  icon: string;
  defaultVariant?: string;
  variants: readonly BuilderSectionVariantDefinition[];
  defaultContent: Record<string, unknown>;
  defaultStyles: Record<string, unknown>;
}

export interface CreateBuilderSectionOptions {
  id: string;
  pageId: string;
  order: number;
  funnelId?: string;
  variant?: string;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }

  return Object.freeze(value);
}

const definitions = deepFreeze([
  {
    type: 'hero',
    label: 'Hero',
    description: 'Hero Section',
    category: 'essentials',
    icon: '🦸',
    defaultVariant: 'standard',
    variants: [
      { id: 'standard', label: 'Standard' },
      { id: 'split', label: 'Split' },
      { id: 'minimal', label: 'Minimal' }
    ],
    defaultContent: {
      heading: 'Restore Your Home’s Beauty',
      subheading: 'Professional pressure washing that makes your surfaces look like new again.',
      button_text: 'Get a Free Estimate',
      background_image: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80'
    },
    defaultStyles: {
      padding: '100px 20px',
      text_alignment: 'center',
      background: '#ffffff',
      visible: true
    }
  },
  {
    type: 'proof',
    label: 'Proof',
    description: 'Proof (Testimonials)',
    category: 'trust',
    icon: '🏆',
    defaultVariant: 'grid',
    variants: [
      { id: 'grid', label: 'Grid' },
      { id: 'list', label: 'List' }
    ],
    defaultContent: {
      title: 'Trusted by Hundreds of Local Homeowners',
      testimonials: [
        {
          name: 'Sarah J.',
          quote: 'Our driveway went from gray to brilliant white in hours. Highly recommend!',
          stars: 5
        },
        {
          name: 'Mike T.',
          quote: 'Professional service and great communication. The house looks brand new.',
          stars: 5
        }
      ]
    },
    defaultStyles: {
      padding: '80px 20px',
      background: '#f8fafc',
      visible: true
    }
  },
  {
    type: 'offer',
    label: 'Offer',
    description: 'Offer Section',
    category: 'conversion',
    icon: '💰',
    defaultVariant: 'banner',
    variants: [
      { id: 'banner', label: 'Banner' },
      { id: 'card', label: 'Card' }
    ],
    defaultContent: {
      headline: 'Special Driveway Cleaning Package',
      description: 'Get your driveway and walkway cleaned for just $199. Limited time offer!',
      button_text: 'Claim Offer',
      expiry: 'Offer ends this Sunday'
    },
    defaultStyles: {
      padding: '80px 20px',
      background: '#4f46e5',
      color: '#ffffff',
      visible: true
    }
  },
  {
    type: 'gallery',
    label: 'Gallery',
    description: 'Gallery (Before/After)',
    category: 'trust',
    icon: '🖼️',
    defaultVariant: 'comparison',
    variants: [
      { id: 'comparison', label: 'Comparison' },
      { id: 'grid', label: 'Grid' }
    ],
    defaultContent: {
      title: 'Our Recent Work',
      items: [
        {
          before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600',
          after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600'
        }
      ]
    },
    defaultStyles: {
      padding: '80px 20px',
      background: '#ffffff',
      visible: true
    }
  },
  {
    type: 'form',
    label: 'Form',
    description: 'Lead Capture Form',
    category: 'conversion',
    icon: '📋',
    defaultVariant: 'embedded',
    variants: [
      { id: 'embedded', label: 'Embedded' },
      { id: 'compact', label: 'Compact' }
    ],
    defaultContent: {
      title: 'Get My Free Quote',
      fields: ['name', 'phone'],
      pipeline_id: 'p1'
    },
    defaultStyles: {
      padding: '60px 20px',
      background: '#f8fafc',
      visible: true
    }
  },
  {
    type: 'faq',
    label: 'FAQ',
    description: 'FAQ Section',
    category: 'content',
    icon: '❓',
    defaultVariant: 'accordion',
    variants: [
      { id: 'accordion', label: 'Accordion' },
      { id: 'split', label: 'Split' }
    ],
    defaultContent: {
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'How long does it take?',
          answer: 'Most residential driveways take 1.5 to 3 hours.'
        },
        {
          question: 'Do I need to be home?',
          answer: 'No, as long as we have access to an external water source.'
        }
      ]
    },
    defaultStyles: {
      padding: '80px 20px',
      background: '#ffffff',
      visible: true
    }
  }
] as const satisfies readonly BuilderSectionDefinition[]);

export const BUILDER_SECTION_REGISTRY: readonly BuilderSectionDefinition[] =
  definitions;

const definitionsByCategory: Readonly<
  Record<BuilderSectionCategory, readonly BuilderSectionDefinition[]>
> = deepFreeze({
  essentials: BUILDER_SECTION_REGISTRY.filter(
    definition => definition.category === 'essentials'
  ),
  trust: BUILDER_SECTION_REGISTRY.filter(
    definition => definition.category === 'trust'
  ),
  conversion: BUILDER_SECTION_REGISTRY.filter(
    definition => definition.category === 'conversion'
  ),
  content: BUILDER_SECTION_REGISTRY.filter(
    definition => definition.category === 'content'
  )
});

export function getBuilderSectionDefinitions():
readonly BuilderSectionDefinition[] {
  return BUILDER_SECTION_REGISTRY;
}

export function getBuilderSectionDefinition(
  type: string
): BuilderSectionDefinition | undefined {
  return BUILDER_SECTION_REGISTRY.find(definition => definition.type === type);
}

export function isRegisteredBuilderSectionType(type: string): boolean {
  return getBuilderSectionDefinition(type) !== undefined;
}

export function getBuilderSectionDefinitionsByCategory(
  category: BuilderSectionCategory
): readonly BuilderSectionDefinition[] {
  return definitionsByCategory[category];
}

export function createBuilderSection(
  type: string,
  options: CreateBuilderSectionOptions
): PageSection {
  const definition = getBuilderSectionDefinition(type);
  if (!definition) {
    throw new Error(`Unknown builder section type: ${type}`);
  }

  const requestedVariant = options.variant;
  const resolvedVariant = requestedVariant !== undefined
    && definition.variants.some(variant => variant.id === requestedVariant)
    ? requestedVariant
    : definition.defaultVariant;

  const section: PageSection = {
    id: options.id,
    page_id: options.pageId,
    type: definition.type,
    content: structuredClone(definition.defaultContent),
    order: options.order,
    styles: structuredClone(definition.defaultStyles),
    variant: resolvedVariant
  };

  if (options.funnelId !== undefined) {
    section.funnel_id = options.funnelId;
  }

  return section;
}
