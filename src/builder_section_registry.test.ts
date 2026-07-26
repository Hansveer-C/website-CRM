import { describe, expect, it } from 'vitest';
import type {
  BuilderSectionCategory,
  BuilderSectionDefinition,
  BuilderSectionVariantDefinition,
  CreateBuilderSectionOptions
} from './builder_section_registry';
import {
  BUILDER_SECTION_REGISTRY,
  createBuilderSection,
  getBuilderSectionDefinition,
  getBuilderSectionDefinitions,
  getBuilderSectionDefinitionsByCategory,
  isRegisteredBuilderSectionType
} from './builder_section_registry';

const registeredTypes = ['hero', 'proof', 'offer', 'gallery', 'form', 'faq'];

function createOptions(
  overrides: Partial<CreateBuilderSectionOptions> = {}
): CreateBuilderSectionOptions {
  return {
    id: 'section-1',
    pageId: 'page-1',
    order: 3,
    ...overrides
  };
}

describe('Builder Section Registry public API', () => {
  it('exports all required types, values, and callable helpers', () => {
    const category: BuilderSectionCategory = 'essentials';
    const variant: BuilderSectionVariantDefinition = {
      id: 'standard',
      label: 'Standard'
    };
    const definition: BuilderSectionDefinition =
      BUILDER_SECTION_REGISTRY[0];
    const options: CreateBuilderSectionOptions = createOptions();

    expect(category).toBe('essentials');
    expect(variant.id).toBe('standard');
    expect(definition.type).toBe('hero');
    expect(options.pageId).toBe('page-1');
    expect(getBuilderSectionDefinitions()).toBe(BUILDER_SECTION_REGISTRY);
    expect(getBuilderSectionDefinition('hero')).toBe(definition);
    expect(isRegisteredBuilderSectionType('hero')).toBe(true);
    expect(getBuilderSectionDefinitionsByCategory('essentials')).toHaveLength(1);
    expect(createBuilderSection('hero', options).type).toBe('hero');
  });

  it('registers the six types in deterministic editor order', () => {
    expect(
      getBuilderSectionDefinitions().map(definition => definition.type)
    ).toEqual(registeredTypes);
  });

  it('recognizes registered types and rejects unknown types', () => {
    for (const type of registeredTypes) {
      expect(isRegisteredBuilderSectionType(type)).toBe(true);
    }

    expect(isRegisteredBuilderSectionType('unknown')).toBe(false);
    expect(getBuilderSectionDefinition('unknown')).toBeUndefined();
  });

  it('throws a clear error for an unknown factory type', () => {
    expect(() => createBuilderSection('unknown', createOptions())).toThrow(
      new Error('Unknown builder section type: unknown')
    );
  });

  it('filters categories deterministically', () => {
    expect(
      getBuilderSectionDefinitionsByCategory('essentials')
        .map(definition => definition.type)
    ).toEqual(['hero']);
    expect(
      getBuilderSectionDefinitionsByCategory('trust')
        .map(definition => definition.type)
    ).toEqual(['proof', 'gallery']);
    expect(
      getBuilderSectionDefinitionsByCategory('conversion')
        .map(definition => definition.type)
    ).toEqual(['offer', 'form']);
    expect(
      getBuilderSectionDefinitionsByCategory('content')
        .map(definition => definition.type)
    ).toEqual(['faq']);
  });
});

describe('Builder Section Registry variants and factory', () => {
  it('writes a supported requested variant', () => {
    const section = createBuilderSection(
      'hero',
      createOptions({ variant: 'split' })
    );

    expect(section.variant).toBe('split');
  });

  it('falls back to the default for an unsupported requested variant', () => {
    const section = createBuilderSection(
      'hero',
      createOptions({ variant: 'unsupported' })
    );

    expect(section.variant).toBe('standard');
  });

  it('uses the default when the requested variant is omitted', () => {
    expect(
      createBuilderSection('gallery', createOptions()).variant
    ).toBe('comparison');
  });

  it('writes all six default variants explicitly', () => {
    expect(
      Object.fromEntries(
        registeredTypes.map(type => [
          type,
          createBuilderSection(type, createOptions()).variant
        ])
      )
    ).toEqual({
      hero: 'standard',
      proof: 'grid',
      offer: 'banner',
      gallery: 'comparison',
      form: 'embedded',
      faq: 'accordion'
    });
  });

  it('preserves IDs, ordering, and the optional funnel mapping', () => {
    const section = createBuilderSection('offer', createOptions({
      id: 'offer-42',
      pageId: 'page-9',
      order: 12.5,
      funnelId: 'funnel-7'
    }));

    expect(section).toMatchObject({
      id: 'offer-42',
      page_id: 'page-9',
      order: 12.5,
      funnel_id: 'funnel-7'
    });
  });

  it('does not mutate factory options', () => {
    const options = createOptions({
      funnelId: 'funnel-1',
      variant: 'card'
    });
    const snapshot = structuredClone(options);

    createBuilderSection('offer', options);

    expect(options).toEqual(snapshot);
  });

  it('creates mutable content and styles from frozen defaults', () => {
    const section = createBuilderSection('gallery', createOptions());
    const items = section.content.items as Array<{
      before: string;
      after: string;
    }>;

    expect(Object.isFrozen(section.content)).toBe(false);
    expect(Object.isFrozen(section.styles)).toBe(false);
    expect(Object.isFrozen(items)).toBe(false);

    items[0].before = 'changed.jpg';
    section.styles.visible = false;

    expect(items[0].before).toBe('changed.jpg');
    expect(section.styles.visible).toBe(false);
  });

  it('does not share nested factory content or style references', () => {
    const first = createBuilderSection('gallery', createOptions({
      id: 'gallery-1'
    }));
    const second = createBuilderSection('gallery', createOptions({
      id: 'gallery-2'
    }));
    const firstItems = first.content.items as Array<{ before: string }>;
    const secondItems = second.content.items as Array<{ before: string }>;

    expect(first.content).not.toBe(second.content);
    expect(first.styles).not.toBe(second.styles);
    expect(firstItems).not.toBe(secondItems);
    expect(firstItems[0]).not.toBe(secondItems[0]);

    firstItems[0].before = 'first-only.jpg';
    first.styles.visible = false;

    expect(secondItems[0].before).not.toBe('first-only.jpg');
    expect(second.styles.visible).toBe(true);
  });
});

describe('Builder Section Registry runtime immutability', () => {
  it('prevents external registry-array changes', () => {
    const before = getBuilderSectionDefinitions()
      .map(definition => definition.type);
    const mutableRegistry =
      BUILDER_SECTION_REGISTRY as BuilderSectionDefinition[];

    expect(Object.isFrozen(BUILDER_SECTION_REGISTRY)).toBe(true);
    expect(() => mutableRegistry.push(BUILDER_SECTION_REGISTRY[0])).toThrow();
    expect(
      getBuilderSectionDefinitions().map(definition => definition.type)
    ).toEqual(before);
  });

  it('prevents external definition changes', () => {
    const hero = getBuilderSectionDefinition('hero');
    expect(hero).toBeDefined();
    if (!hero) {
      throw new Error('Expected hero definition.');
    }

    const originalLabel = hero.label;
    expect(Object.isFrozen(hero)).toBe(true);
    expect(() => {
      (hero as { label: string }).label = 'Changed';
    }).toThrow();
    expect(getBuilderSectionDefinition('hero')?.label).toBe(originalLabel);
  });

  it('prevents nested variant-array and variant-object changes', () => {
    const hero = getBuilderSectionDefinition('hero');
    expect(hero).toBeDefined();
    if (!hero) {
      throw new Error('Expected hero definition.');
    }

    const originalIds = hero.variants.map(variant => variant.id);
    expect(Object.isFrozen(hero.variants)).toBe(true);
    expect(Object.isFrozen(hero.variants[0])).toBe(true);
    expect(() => {
      (hero.variants as BuilderSectionVariantDefinition[])
        .push({ id: 'new', label: 'New' });
    }).toThrow();
    expect(() => {
      (hero.variants[0] as { id: string }).id = 'changed';
    }).toThrow();
    expect(hero.variants.map(variant => variant.id)).toEqual(originalIds);
  });

  it('prevents nested default-content changes', () => {
    const proof = getBuilderSectionDefinition('proof');
    expect(proof).toBeDefined();
    if (!proof) {
      throw new Error('Expected proof definition.');
    }

    const testimonials = proof.defaultContent.testimonials as Array<{
      name: string;
    }>;
    const originalName = testimonials[0].name;

    expect(Object.isFrozen(proof.defaultContent)).toBe(true);
    expect(Object.isFrozen(testimonials)).toBe(true);
    expect(Object.isFrozen(testimonials[0])).toBe(true);
    expect(() => {
      testimonials[0].name = 'Changed';
    }).toThrow();
    expect(
      (proof.defaultContent.testimonials as Array<{ name: string }>)[0].name
    ).toBe(originalName);
  });

  it('prevents nested default-style changes', () => {
    const hero = getBuilderSectionDefinition('hero');
    expect(hero).toBeDefined();
    if (!hero) {
      throw new Error('Expected hero definition.');
    }

    const originalPadding = hero.defaultStyles.padding;
    expect(Object.isFrozen(hero.defaultStyles)).toBe(true);
    expect(() => {
      hero.defaultStyles.padding = '0';
    }).toThrow();
    expect(hero.defaultStyles.padding).toBe(originalPadding);
  });

  it('returns frozen arrays from category lookups', () => {
    const trust = getBuilderSectionDefinitionsByCategory('trust');
    const before = trust.map(definition => definition.type);

    expect(Object.isFrozen(trust)).toBe(true);
    expect(() => {
      (trust as BuilderSectionDefinition[]).pop();
    }).toThrow();
    expect(
      getBuilderSectionDefinitionsByCategory('trust')
        .map(definition => definition.type)
    ).toEqual(before);
  });
});

describe('Builder Section Registry characterization', () => {
  it('preserves labels, descriptions, categories, icons, and variant lists', () => {
    expect(
      BUILDER_SECTION_REGISTRY.map(definition => ({
        type: definition.type,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        icon: definition.icon,
        defaultVariant: definition.defaultVariant,
        variants: definition.variants.map(variant => variant.id)
      }))
    ).toEqual([
      {
        type: 'hero',
        label: 'Hero',
        description: 'Hero Section',
        category: 'essentials',
        icon: '🦸',
        defaultVariant: 'standard',
        variants: ['standard', 'split', 'minimal']
      },
      {
        type: 'proof',
        label: 'Proof',
        description: 'Proof (Testimonials)',
        category: 'trust',
        icon: '🏆',
        defaultVariant: 'grid',
        variants: ['grid', 'list']
      },
      {
        type: 'offer',
        label: 'Offer',
        description: 'Offer Section',
        category: 'conversion',
        icon: '💰',
        defaultVariant: 'banner',
        variants: ['banner', 'card']
      },
      {
        type: 'gallery',
        label: 'Gallery',
        description: 'Gallery (Before/After)',
        category: 'trust',
        icon: '🖼️',
        defaultVariant: 'comparison',
        variants: ['comparison', 'grid']
      },
      {
        type: 'form',
        label: 'Form',
        description: 'Lead Capture Form',
        category: 'conversion',
        icon: '📋',
        defaultVariant: 'embedded',
        variants: ['embedded', 'compact']
      },
      {
        type: 'faq',
        label: 'FAQ',
        description: 'FAQ Section',
        category: 'content',
        icon: '❓',
        defaultVariant: 'accordion',
        variants: ['accordion', 'split']
      }
    ]);
  });

  it('preserves all existing default content and styles', () => {
    expect(
      Object.fromEntries(
        BUILDER_SECTION_REGISTRY.map(definition => [
          definition.type,
          {
            content: definition.defaultContent,
            styles: definition.defaultStyles
          }
        ])
      )
    ).toEqual({
      hero: {
        content: {
          heading: 'Restore Your Home’s Beauty',
          subheading: 'Professional pressure washing that makes your surfaces look like new again.',
          button_text: 'Get a Free Estimate',
          background_image: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80'
        },
        styles: {
          padding: '100px 20px',
          text_alignment: 'center',
          background: '#ffffff',
          visible: true
        }
      },
      proof: {
        content: {
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
        styles: {
          padding: '80px 20px',
          background: '#f8fafc',
          visible: true
        }
      },
      offer: {
        content: {
          headline: 'Special Driveway Cleaning Package',
          description: 'Get your driveway and walkway cleaned for just $199. Limited time offer!',
          button_text: 'Claim Offer',
          expiry: 'Offer ends this Sunday'
        },
        styles: {
          padding: '80px 20px',
          background: '#4f46e5',
          color: '#ffffff',
          visible: true
        }
      },
      gallery: {
        content: {
          title: 'Our Recent Work',
          items: [
            {
              before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600',
              after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600'
            }
          ]
        },
        styles: {
          padding: '80px 20px',
          background: '#ffffff',
          visible: true
        }
      },
      form: {
        content: {
          title: 'Get My Free Quote',
          fields: ['name', 'phone'],
          pipeline_id: 'p1'
        },
        styles: {
          padding: '60px 20px',
          background: '#f8fafc',
          visible: true
        }
      },
      faq: {
        content: {
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
        styles: {
          padding: '80px 20px',
          background: '#ffffff',
          visible: true
        }
      }
    });
  });
});
