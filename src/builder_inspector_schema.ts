import type { PageSection } from './types';
import {
  BUILDER_SECTION_REGISTRY,
  getBuilderSectionDefinition
} from './builder_section_registry';
import type {
  BuilderSectionDefinition,
  BuilderSectionVariantDefinition
} from './builder_section_registry';

export type BuilderInspectorTab =
  | 'content'
  | 'design'
  | 'responsive'
  | 'advanced';

export type BuilderInspectorControl =
  | 'text'
  | 'textarea'
  | 'select'
  | 'toggle'
  | 'number'
  | 'color'
  | 'image'
  | 'collection';

export type BuilderInspectorFieldSource = 'content' | 'styles' | 'variant';

export interface BuilderInspectorSelectOption {
  value: string;
  label: string;
}

export interface BuilderInspectorFieldDefinition {
  id: string;
  label: string;
  description?: string;
  source: BuilderInspectorFieldSource;
  path: readonly string[];
  control: BuilderInspectorControl;
  placeholder?: string;
  options?: readonly BuilderInspectorSelectOption[];
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
}

export interface BuilderInspectorGroupDefinition {
  id: string;
  label: string;
  description?: string;
  tab: BuilderInspectorTab;
  fields: readonly BuilderInspectorFieldDefinition[];
}

export interface BuilderInspectorSchema {
  sectionType: string;
  groups: readonly BuilderInspectorGroupDefinition[];
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

function contentField(
  id: string,
  label: string,
  path: string,
  control: BuilderInspectorControl
): BuilderInspectorFieldDefinition {
  return {
    id,
    label,
    source: 'content',
    path: [path],
    control
  };
}

function styleField(
  id: string,
  label: string,
  path: string,
  control: BuilderInspectorControl,
  options?: readonly BuilderInspectorSelectOption[]
): BuilderInspectorFieldDefinition {
  return {
    id,
    label,
    source: 'styles',
    path: [path],
    control,
    ...(options === undefined ? {} : { options })
  };
}

function variantField(
  definition: BuilderSectionDefinition
): BuilderInspectorFieldDefinition {
  return {
    id: 'layout',
    label: 'Layout',
    source: 'variant',
    path: [],
    control: 'select',
    options: definition.variants.map(
      (variant: BuilderSectionVariantDefinition) => ({
        value: variant.id,
        label: variant.label
      })
    )
  };
}

const textAlignmentOptions: readonly BuilderInspectorSelectOption[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' }
];

const contentFieldsByType: Readonly<
  Record<string, readonly BuilderInspectorFieldDefinition[]>
> = {
  hero: [
    contentField('heading', 'Heading', 'heading', 'text'),
    contentField('supporting-text', 'Supporting text', 'subheading', 'textarea'),
    contentField('button-label', 'Button label', 'button_text', 'text'),
    contentField('background-image', 'Background image', 'background_image', 'image')
  ],
  proof: [
    contentField('heading', 'Heading', 'title', 'text'),
    contentField('testimonials', 'Testimonials', 'testimonials', 'collection')
  ],
  offer: [
    contentField('heading', 'Heading', 'headline', 'text'),
    contentField('supporting-text', 'Supporting text', 'description', 'textarea'),
    contentField('button-label', 'Button label', 'button_text', 'text'),
    contentField('expiry-message', 'Expiry message', 'expiry', 'text')
  ],
  gallery: [
    contentField('heading', 'Heading', 'title', 'text'),
    contentField('images', 'Before and after images', 'items', 'collection')
  ],
  form: [
    contentField('heading', 'Heading', 'title', 'text'),
    contentField('fields', 'Form fields', 'fields', 'collection'),
    contentField('pipeline', 'Pipeline', 'pipeline_id', 'text')
  ],
  faq: [
    contentField('heading', 'Heading', 'heading', 'text'),
    contentField('entries', 'Questions and answers', 'items', 'collection')
  ]
};

function designFieldsFor(
  definition: BuilderSectionDefinition
): readonly BuilderInspectorFieldDefinition[] {
  const fields: BuilderInspectorFieldDefinition[] = [
    variantField(definition),
    styleField('background', 'Background', 'background', 'color')
  ];

  if (definition.type === 'hero') {
    fields.push(
      styleField(
        'text-alignment',
        'Text alignment',
        'text_alignment',
        'select',
        textAlignmentOptions
      )
    );
  }

  if (definition.type === 'offer') {
    fields.push(styleField('text-color', 'Text color', 'color', 'color'));
  }

  fields.push(
    styleField('section-spacing', 'Section spacing', 'padding', 'text'),
    styleField('visibility', 'Visible', 'visible', 'toggle')
  );

  return fields;
}

const schemas = deepFreeze(
  BUILDER_SECTION_REGISTRY.map((definition): BuilderInspectorSchema => ({
    sectionType: definition.type,
    groups: [
      {
        id: 'content',
        label: 'Content',
        tab: 'content',
        fields: contentFieldsByType[definition.type]
      },
      {
        id: 'design',
        label: 'Design',
        tab: 'design',
        fields: designFieldsFor(definition)
      }
    ]
  }))
);

const fieldsBySectionType = deepFreeze(
  Object.fromEntries(
    schemas.map(schema => [
      schema.sectionType,
      schema.groups.flatMap(group => group.fields)
    ])
  ) as Record<string, readonly BuilderInspectorFieldDefinition[]>
);

export function getBuilderInspectorSchemas():
readonly BuilderInspectorSchema[] {
  return schemas;
}

export function getBuilderInspectorSchema(
  sectionType: string
): BuilderInspectorSchema | undefined {
  return schemas.find(schema => schema.sectionType === sectionType);
}

export function getBuilderInspectorFields(
  sectionType: string
): readonly BuilderInspectorFieldDefinition[] {
  return fieldsBySectionType[sectionType] ?? deepFreeze([]);
}

export function getBuilderInspectorField(
  sectionType: string,
  fieldId: string
): BuilderInspectorFieldDefinition | undefined {
  return getBuilderInspectorFields(sectionType).find(
    field => field.id === fieldId
  );
}

function readPath(root: unknown, path: readonly string[]): unknown {
  let current = root;

  for (const segment of path) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
}

export function getBuilderInspectorFieldValue(
  section: PageSection,
  field: BuilderInspectorFieldDefinition
): unknown {
  if (field.source === 'variant') {
    return section.variant;
  }
  if (field.source === 'content') {
    return readPath(section.content, field.path);
  }
  if (field.source === 'styles') {
    return readPath(section.styles, field.path);
  }
  return undefined;
}

function createNestedPatch(
  path: readonly string[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) {
    throw new Error('Inspector content and styles fields require a non-empty path.');
  }

  let nestedValue: unknown = structuredClone(value);
  for (let index = path.length - 1; index >= 0; index -= 1) {
    nestedValue = { [path[index]]: nestedValue };
  }

  return nestedValue as Record<string, unknown>;
}

export function createBuilderInspectorPatch(
  field: BuilderInspectorFieldDefinition,
  value: unknown
): {
  content?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  variant?: string | null;
} {
  if (field.source === 'variant') {
    return { variant: structuredClone(value) as string | null };
  }
  if (field.source === 'content') {
    return { content: createNestedPatch(field.path, value) };
  }
  if (field.source === 'styles') {
    return { styles: createNestedPatch(field.path, value) };
  }

  throw new Error(`Unsupported builder inspector field source: ${String(field.source)}`);
}

// Assert registry coverage at module initialization without duplicating types.
for (const schema of schemas) {
  if (!getBuilderSectionDefinition(schema.sectionType)) {
    throw new Error(`Unknown builder inspector section type: ${schema.sectionType}`);
  }
}
