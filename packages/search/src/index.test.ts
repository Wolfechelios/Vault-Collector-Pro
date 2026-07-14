import { describe, expect, it } from 'vitest';
import { parseSearchQuery, smartCollections } from './index';

describe('deterministic inventory query parser', () => {
  it('parses a color, brand, and tool category', () => {
    expect(parseSearchQuery('yellow DeWalt drill')).toMatchObject({
      filters: { color: 'yellow', brand: 'DeWalt', category: 'tools' },
      text: 'drill'
    });
  });

  it('parses year and value comparisons', () => {
    expect(parseSearchQuery('coins before 1900 worth over $500')).toMatchObject({
      filters: {
        category: 'coins',
        year: { operator: 'lt', value: 1900 },
        valueMinor: { operator: 'gt', value: 50000 }
      },
      text: ''
    });
  });

  it('parses missing-photo queries', () => {
    expect(parseSearchQuery('items missing photos')).toMatchObject({
      filters: { missingPhotos: true },
      text: ''
    });
  });

  it('parses an unquoted storage path', () => {
    expect(parseSearchQuery('everything in Garage Shelf B')).toMatchObject({
      filters: { location: 'Garage Shelf B' },
      text: ''
    });
  });

  it('parses grading and negative listing state', () => {
    expect(parseSearchQuery('PSA 10 cards not listed')).toMatchObject({
      filters: {
        category: 'cards',
        gradingCompany: 'PSA',
        grade: '10',
        listed: false
      },
      text: ''
    });
  });

  it('preserves quoted free text and compiles it for FTS5', () => {
    const result = parseSearchQuery('"limited edition" electronics');
    expect(result.text).toBe('limited edition');
    expect(result.ftsQuery).toBe('"limited edition"');
    expect(result.filters.category).toBe('electronics');
  });

  it('defines required smart collections as deterministic filters', () => {
    expect(Object.keys(smartCollections)).toEqual([
      'unpriced', 'unassigned', 'duplicate', 'missing-photo', 'review-needed'
    ]);
  });

  it('parses quantity, status, and condition filters', () => {
    expect(parseSearchQuery('tools quantity over 2 status sold condition used')).toMatchObject({
      filters: {
        category: 'tools',
        quantity: { operator: 'gt', value: 2 },
        status: 'sold',
        condition: 'used'
      },
      text: ''
    });
  });
});
