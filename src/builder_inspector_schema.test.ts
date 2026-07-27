import { describe, expect, it } from 'vitest';
import type { PageSection } from './types';
import {
  BUILDER_SECTION_REGISTRY,
  createBuilderSection,
  getBuilderSectionDefinition
} from './builder_section_registry';
import type {
  BuilderInspectorFieldDefinition,
  BuilderInspectorGroupDefinition,
  BuilderInspectorSchema,
  BuilderInspectorSelectOption
} from './builder_inspector_schema';
import {
  createBuilderInspectorPatch,
  getBuilderInspectorField,
  getBuilderInspectorFields,
  getBuilderInspectorFieldValue,
  getBuilderInspectorSchema,
  getBuilderInspectorSchemas
} from './builder_inspector_schema';

function createSection(type: string): PageSection {
  return createBuilderSection(type, {
    id: `${type}-section`,
    pageId: 'page-1',
    order: 1
  });
}

function field(
  overrides: Partial<BuilderInspectorFieldDefinition>
): BuilderInspectorFieldDefinition {
  return {
    id: 'test-field',
    label: 'Test field',
    source: 'content',
    path: ['test'],
    control: 'text',
    ...overrides
  };
}

describe('Builder Inspector Schema coverage', () => {
  it('creates exactly six schemas in registry order', () => {
    expect(getBuilderInspectorSchemas()).toHaveLength(6);
    expect(
      getBuilderInspectorSchemas().map(schema => schema.sectionType)
    ).toEqual(
      BUILDER_SECTION_REGISTRY.map(definition => definition.type)
    );
  });

  it('returns undefined for unknown schema and field lookups', () => {
    expect(getBuilderInspectorSchema('unknown')).toBeUndefined();
    expect(getBuilderInspectorField('unknown', 'heading')).toBeUndefined();
    expect(getBuilderInspectorFields('unknown')).toEqual([]);
  });

  it('gives every schema a registry-derived variant field', () => {
    for (const definition of BUILDER_SECTION_REGISTRY) {
      const layout = getBuilderInspectorField(definition.type, 'layout');

      expect(layout).toMatchObject({
        source: 'variant',
        path: [],
        control: 'select'
      });
      expect(layout?.options).toEqual(
        definition.variants.map(variant => ({
          value: variant.id,
          label: variant.label
        }))
      );
    }
  });

  it('uses unique field and group IDs within every schema', () => {
    for (const schema of getBuilderInspectorSchemas()) {
      const fieldIds = getBuilderInspectorFields(schema.sectionType)
        .map(schemaField => schemaField.id);
      const groupIds = schema.groups.map(group => group.id);

      expect(new Set(fieldIds).size).toBe(fieldIds.length);
      expect(new Set(groupIds).size).toBe(groupIds.length);
    }
  });

  it('resolves every required content and style path on factory sections', () => {
    for (const schema of getBuilderInspectorSchemas()) {
      const section = createSection(schema.sectionType);

      for (const schemaField of getBuilderInspectorFields(schema.sectionType)) {
        if (
          (schemaField.source === 'content' || schemaField.source === 'styles')
          && !schemaField.optional
        ) {
          expect(
            getBuilderInspectorFieldValue(section, schemaField),
            `${schema.sectionType}.${schemaField.id}`
          ).not.toBeUndefined();
        }
      }
    }
  });

  it('uses collection controls only for current array values', () => {
    for (const schema of getBuilderInspectorSchemas()) {
      const section = createSection(schema.sectionType);
      const collectionFields = getBuilderInspectorFields(schema.sectionType)
        .filter(schemaField => schemaField.control === 'collection');

      for (const collectionField of collectionFields) {
        expect(
          Array.isArray(
            getBuilderInspectorFieldValue(section, collectionField)
          )
        ).toBe(true);
      }
    }
  });

  it('provides non-empty valid options for every select control', () => {
    for (const schema of getBuilderInspectorSchemas()) {
      const selectFields = getBuilderInspectorFields(schema.sectionType)
        .filter(schemaField => schemaField.control === 'select');

      for (const selectField of selectFields) {
        expect(selectField.options?.length).toBeGreaterThan(0);
        for (const option of selectField.options ?? []) {
          expect(option.value.length).toBeGreaterThan(0);
          expect(option.label.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('characterizes exact existing content and style paths', () => {
    const paths = Object.fromEntries(
      getBuilderInspectorSchemas().map(schema => [
        schema.sectionType,
        getBuilderInspectorFields(schema.sectionType)
          .filter(schemaField => schemaField.source !== 'variant')
          .map(schemaField => `${schemaField.source}.${schemaField.path.join('.')}`)
      ])
    );

    expect(paths).toEqual({
      hero: [
        'content.heading',
        'content.subheading',
        'content.button_text',
        'content.background_image',
        'styles.background',
        'styles.text_alignment',
        'styles.padding',
        'styles.visible'
      ],
      proof: [
        'content.title',
        'content.testimonials',
        'styles.background',
        'styles.padding',
        'styles.visible'
      ],
      offer: [
        'content.headline',
        'content.description',
        'content.button_text',
        'content.expiry',
        'styles.background',
        'styles.color',
        'styles.padding',
        'styles.visible'
      ],
      gallery: [
        'content.title',
        'content.items',
        'styles.background',
        'styles.padding',
        'styles.visible'
      ],
      form: [
        'content.title',
        'content.fields',
        'content.pipeline_id',
        'styles.background',
        'styles.padding',
        'styles.visible'
      ],
      faq: [
        'content.heading',
        'content.items',
        'styles.background',
        'styles.padding',
        'styles.visible'
      ]
    });
  });
});

describe('Builder Inspector Schema value access', () => {
  it('reads variant values', () => {
    const section = createSection('hero');
    const layout = getBuilderInspectorField('hero', 'layout');

    expect(layout).toBeDefined();
    if (!layout) {
      throw new Error('Expected hero layout field.');
    }
    expect(getBuilderInspectorFieldValue(section, layout)).toBe('standard');
  });

  it('reads nested content and style values', () => {
    const section = createSection('hero');
    section.content.nested = { cta: { label: 'Get a Quote' } };
    section.styles.responsive = { mobile: { padding: '20px' } };

    expect(getBuilderInspectorFieldValue(section, field({
      source: 'content',
      path: ['nested', 'cta', 'label']
    }))).toBe('Get a Quote');
    expect(getBuilderInspectorFieldValue(section, field({
      source: 'styles',
      path: ['responsive', 'mobile', 'padding']
    }))).toBe('20px');
  });

  it('returns undefined for ordinary missing paths', () => {
    const section = createSection('faq');

    expect(getBuilderInspectorFieldValue(section, field({
      path: ['missing', 'value']
    }))).toBeUndefined();
  });
});

describe('Builder Inspector Schema patch construction', () => {
  it('creates nested content and style patches', () => {
    expect(createBuilderInspectorPatch(field({
      source: 'content',
      path: ['cta', 'label']
    }), 'Get a Quote')).toEqual({
      content: { cta: { label: 'Get a Quote' } }
    });

    expect(createBuilderInspectorPatch(field({
      source: 'styles',
      path: ['responsive', 'mobile', 'padding']
    }), '20px')).toEqual({
      styles: { responsive: { mobile: { padding: '20px' } } }
    });
  });

  it('creates string and null variant patches without content or styles', () => {
    const layout = field({
      source: 'variant',
      path: [],
      control: 'select'
    });

    expect(createBuilderInspectorPatch(layout, 'split')).toEqual({
      variant: 'split'
    });
    expect(createBuilderInspectorPatch(layout, null)).toEqual({
      variant: null
    });
  });

  it.each([
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['empty string', '']
  ])('preserves %s patch values', (_label, value) => {
    expect(createBuilderInspectorPatch(field({
      source: 'styles',
      path: ['value']
    }), value)).toEqual({
      styles: { value }
    });
  });

  it('deep-clones arrays and does not mutate input values', () => {
    const value = [{ nested: { label: 'Original' } }];
    const snapshot = structuredClone(value);
    const patch = createBuilderInspectorPatch(field({
      source: 'content',
      path: ['items'],
      control: 'collection'
    }), value);
    const patchedItems = patch.content?.items as typeof value;

    expect(value).toEqual(snapshot);
    expect(patchedItems).toEqual(value);
    expect(patchedItems).not.toBe(value);
    expect(patchedItems[0]).not.toBe(value[0]);

    value[0].nested.label = 'Changed later';
    expect(patchedItems[0].nested.label).toBe('Original');
  });

  it('throws only for empty data paths or unsupported runtime sources', () => {
    expect(() => createBuilderInspectorPatch(field({
      source: 'content',
      path: []
    }), 'value')).toThrow();
    expect(() => createBuilderInspectorPatch(field({
      source: 'styles',
      path: []
    }), 'value')).toThrow();
    expect(() => createBuilderInspectorPatch(field({
      source: 'unsupported' as 'content',
      path: ['value']
    }), 'value')).toThrow(
      'Unsupported builder inspector field source: unsupported'
    );
  });
});

describe('Builder Inspector Schema runtime immutability', () => {
  it('freezes schemas and schema arrays', () => {
    const schemas = getBuilderInspectorSchemas();
    const before = schemas.map(schema => schema.sectionType);

    expect(Object.isFrozen(schemas)).toBe(true);
    expect(Object.isFrozen(schemas[0])).toBe(true);
    expect(() => {
      (schemas as BuilderInspectorSchema[]).pop();
    }).toThrow();
    expect(() => {
      (schemas[0] as { sectionType: string }).sectionType = 'changed';
    }).toThrow();
    expect(getBuilderInspectorSchemas().map(schema => schema.sectionType))
      .toEqual(before);
  });

  it('freezes groups, group arrays, fields, field arrays, and paths', () => {
    const schema = getBuilderInspectorSchema('hero');
    expect(schema).toBeDefined();
    if (!schema) {
      throw new Error('Expected hero schema.');
    }

    const group = schema.groups[0];
    const schemaField = group.fields[0];
    const originalPath = [...schemaField.path];

    expect(Object.isFrozen(schema.groups)).toBe(true);
    expect(Object.isFrozen(group)).toBe(true);
    expect(Object.isFrozen(group.fields)).toBe(true);
    expect(Object.isFrozen(schemaField)).toBe(true);
    expect(Object.isFrozen(schemaField.path)).toBe(true);

    expect(() => {
      (schema.groups as BuilderInspectorGroupDefinition[]).pop();
    }).toThrow();
    expect(() => {
      (group.fields as BuilderInspectorFieldDefinition[]).pop();
    }).toThrow();
    expect(() => {
      (schemaField.path as string[]).push('changed');
    }).toThrow();
    expect(schemaField.path).toEqual(originalPath);
  });

  it('freezes select option arrays and option objects', () => {
    const layout = getBuilderInspectorField('hero', 'layout');
    expect(layout?.options).toBeDefined();
    if (!layout?.options) {
      throw new Error('Expected hero layout options.');
    }
    const options = layout.options;

    const originalValues = options.map(option => option.value);
    expect(Object.isFrozen(options)).toBe(true);
    expect(Object.isFrozen(options[0])).toBe(true);
    expect(() => {
      (options as BuilderInspectorSelectOption[])
        .push({ value: 'new', label: 'New' });
    }).toThrow();
    expect(() => {
      (options[0] as { value: string }).value = 'changed';
    }).toThrow();
    expect(options.map(option => option.value)).toEqual(originalValues);
  });

  it('does not mutate registry definitions', () => {
    const before = structuredClone(BUILDER_SECTION_REGISTRY);

    getBuilderInspectorSchemas();
    getBuilderInspectorSchema('hero');
    getBuilderInspectorFields('hero');
    getBuilderInspectorField('hero', 'layout');
    createBuilderInspectorPatch(
      getBuilderInspectorField('hero', 'layout')!,
      'split'
    );

    expect(BUILDER_SECTION_REGISTRY).toEqual(before);
    expect(getBuilderSectionDefinition('hero')?.defaultVariant).toBe('standard');
  });
});
