import type { CategoryFieldDefinition } from '@vault/domain';

type FieldInput = Omit<CategoryFieldDefinition, 'required' | 'searchable' | 'options' | 'aliases'> &
  Partial<Pick<CategoryFieldDefinition, 'required' | 'searchable' | 'options' | 'aliases'>>;

const field = (input: FieldInput): CategoryFieldDefinition => ({
  required: false,
  searchable: true,
  options: [],
  aliases: [],
  ...input
});

const common: CategoryFieldDefinition[] = [
  field({ key: 'brand', label: 'Brand', kind: 'text', order: 10 }),
  field({ key: 'model', label: 'Model', kind: 'identifier', aliases: ['model number', 'm/n'], order: 20 }),
  field({ key: 'serialNumber', label: 'Serial number', kind: 'identifier', aliases: ['serial', 's/n'], order: 30 }),
  field({ key: 'year', label: 'Year', kind: 'number', order: 40 }),
  field({ key: 'edition', label: 'Edition', kind: 'text', order: 50 }),
  field({ key: 'size', label: 'Size', kind: 'text', order: 60 }),
  field({ key: 'color', label: 'Color', kind: 'color', order: 70 }),
  field({ key: 'material', label: 'Material', kind: 'material', order: 80 }),
  field({ key: 'condition', label: 'Condition detail', kind: 'condition', order: 90 })
];

const categoryFields: Record<string, CategoryFieldDefinition[]> = {
  tools: [
    field({ key: 'voltage', label: 'Voltage', kind: 'text', order: 110 }),
    field({ key: 'powerSource', label: 'Power source', kind: 'select', options: ['Corded', 'Battery', 'Pneumatic', 'Manual'], order: 120 }),
    field({ key: 'toolType', label: 'Tool type', kind: 'text', order: 130 })
  ],
  cards: [
    field({ key: 'cardNumber', label: 'Card number', kind: 'identifier', order: 110 }),
    field({ key: 'set', label: 'Set', kind: 'text', order: 120 }),
    field({ key: 'grade', label: 'Grade', kind: 'text', order: 130 }),
    field({ key: 'gradingCompany', label: 'Grading company', kind: 'select', options: ['PSA', 'BGS', 'CGC', 'SGC', 'Raw'], order: 140 })
  ],
  coins: [
    field({ key: 'denomination', label: 'Denomination', kind: 'text', order: 110 }),
    field({ key: 'mintMark', label: 'Mint mark', kind: 'identifier', order: 120 }),
    field({ key: 'grade', label: 'Grade', kind: 'text', order: 130 }),
    field({ key: 'composition', label: 'Composition', kind: 'material', order: 140 })
  ],
  electronics: [
    field({ key: 'storageCapacity', label: 'Storage capacity', kind: 'text', order: 110 }),
    field({ key: 'processor', label: 'Processor', kind: 'text', order: 120 }),
    field({ key: 'screenSize', label: 'Screen size', kind: 'text', order: 130 })
  ],
  clothing: [
    field({ key: 'department', label: 'Department', kind: 'select', options: ['Men', 'Women', 'Unisex', 'Kids'], order: 110 }),
    field({ key: 'style', label: 'Style', kind: 'text', order: 120 })
  ],
  shoes: [
    field({ key: 'styleCode', label: 'Style code', kind: 'identifier', order: 110 }),
    field({ key: 'department', label: 'Department', kind: 'select', options: ['Men', 'Women', 'Unisex', 'Kids'], order: 120 })
  ],
  jewelry: [
    field({ key: 'purity', label: 'Purity', kind: 'text', aliases: ['karat', 'fineness'], order: 110 }),
    field({ key: 'weight', label: 'Weight', kind: 'text', order: 120 }),
    field({ key: 'stone', label: 'Stone', kind: 'text', order: 130 })
  ]
};

export function getCategoryFields(category: string): CategoryFieldDefinition[] {
  const combined = [...common, ...(categoryFields[category.toLocaleLowerCase()] ?? [])];
  const unique = new Map(combined.map((definition) => [definition.key, definition]));
  return [...unique.values()].sort((left, right) => left.order - right.order);
}

export function mergeCategorySpecifics(
  current: Record<string, string>,
  _nextCategory: string
): Record<string, string> {
  return { ...current };
}
