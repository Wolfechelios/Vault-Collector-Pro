import {describe, expect, it} from 'vitest';
import {buildRecognitionResult} from './webRecognition';

describe('web recognition mapping', () => {
  it('maps partial engine output into evidence-compatible fields', () => {
    const result = buildRecognitionResult({
      rawText: 'DEWALT\nMODEL DCD791\n20V drill',
      barcodes: ['012345678905'],
      labels: [{label: 'power drill', score: 0.91}],
      warnings: ['Object model unavailable']
    });
    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({field: 'brand', value: 'DeWalt'}),
      expect.objectContaining({field: 'upc', value: '012345678905'}),
      expect.objectContaining({field: 'category', value: 'tools'})
    ]));
    expect(result.warnings).toContain('Object model unavailable');
  });

  it('keeps logo aliases conservative', () => {
    const result = buildRecognitionResult({rawText: '', barcodes: [], labels: [{label: 'Nike running shoe', score: 0.9}], warnings: []});
    expect(result.fields).toContainEqual(expect.objectContaining({field: 'brand', value: 'Nike', confidence: 0.68, source: 'logo'}));
  });
});
