import { describe, expect, it } from 'vitest';
import { analyzeScan, extractInventoryFields, inferInventoryCategory, mergeFieldProposals, type FieldProposal } from './index';

describe('inventory intelligence', () => {
  it('extracts structured tool fields from OCR and barcode evidence', () => {
    const analysis = analyzeScan({ ocrText: 'DEWALT Model DCF887 Serial Number ABC12345 2021', barcodes: ['012345678905'], sourceMediaId: 'photo-1' });
    expect(analysis.canonical.category).toBe('tools');
    expect(analysis.canonical.brand).toBe('DeWalt');
    expect(analysis.canonical.model).toBe('DCF887');
    expect(analysis.canonical.serialNumber).toBe('ABC12345');
    expect(analysis.canonical['specifics.upc']).toBe('012345678905');
    expect(analysis.pricingQuery).toContain('DCF887');
    expect(analysis.storageRoute[0]).toBe('Garage');
  });

  it('infers category-specific collectible fields', () => {
    expect(inferInventoryCategory('Pokemon PSA card number 15/102').subcategory).toBe('trading cards');
    const proposals = extractInventoryFields({ ocrText: 'Pokemon PSA Card # 15/102 1999' });
    expect(proposals.some(row => row.field === 'specifics.cardNumber' && row.value === '15/102')).toBe(true);
  });

  it('protects verified values and leaves low-confidence fields for review', () => {
    const proposals: FieldProposal[] = [
      { id: '1', field: 'brand', value: 'Makita', confidence: 0.99, source: 'ocr', sourceMediaId: null, rawText: 'Makita', state: 'auto-saved', createdAt: new Date().toISOString() },
      { id: '2', field: 'edition', value: 'Limited', confidence: 0.62, source: 'ocr', sourceMediaId: null, rawText: 'Limited?', state: 'review', createdAt: new Date().toISOString() }
    ];
    const result = mergeFieldProposals(proposals, { brand: 'DeWalt' }, ['brand']);
    expect(result.canonical.brand).toBeUndefined();
    expect(result.suggestions.map(row => row.field)).toContain('brand');
    expect(result.suggestions.map(row => row.field)).toContain('edition');
  });

  it('flags close high-confidence conflicts instead of choosing silently', () => {
    const stamp = new Date().toISOString();
    const result = mergeFieldProposals([
      { id: 'a', field: 'model', value: 'DCF887', confidence: 0.94, source: 'ocr', sourceMediaId: 'front', rawText: 'DCF887', state: 'auto-saved', createdAt: stamp },
      { id: 'b', field: 'model', value: 'DCF888', confidence: 0.91, source: 'ocr', sourceMediaId: 'label', rawText: 'DCF888', state: 'auto-saved', createdAt: stamp }
    ]);
    expect(result.canonical.model).toBeUndefined();
    expect(result.conflicts).toHaveLength(2);
  });
});
