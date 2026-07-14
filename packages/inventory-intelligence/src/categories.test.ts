import { describe, expect, it } from 'vitest';
import { getCategoryFields, mergeCategorySpecifics } from './categories';

describe('category field definitions', () => {
  it.each([
    ['tools', ['model', 'voltage', 'powerSource']],
    ['cards', ['cardNumber', 'set', 'grade']],
    ['coins', ['denomination', 'mintMark', 'grade']],
    ['electronics', ['model', 'serialNumber', 'storageCapacity']],
    ['clothing', ['size', 'color', 'material']],
    ['shoes', ['size', 'color', 'styleCode']],
    ['jewelry', ['material', 'purity', 'weight']]
  ])('returns dynamic fields for %s', (category, expectedKeys) => {
    const keys = getCategoryFields(category).map((field) => field.key);
    expect(keys).toEqual(expect.arrayContaining(expectedKeys));
  });

  it('uses a generic fallback schema for unknown categories', () => {
    expect(getCategoryFields('custom-thing').map((field) => field.key)).toEqual(
      expect.arrayContaining(['brand', 'model', 'year', 'color', 'material'])
    );
  });

  it('preserves unknown specifics when the category changes', () => {
    expect(mergeCategorySpecifics({ voltage: '20V', customKey: 'keep me' }, 'coins')).toEqual({
      voltage: '20V',
      customKey: 'keep me'
    });
  });
});
