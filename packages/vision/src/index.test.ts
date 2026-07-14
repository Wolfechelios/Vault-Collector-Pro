import { describe, expect, it } from 'vitest';
import {
  listingTitle,
  mergeVisionCandidates,
  parseVisionText,
  visionCandidateToEvidence
} from './index';

describe('vision parser', () => {
  it('extracts item identifiers and barcode', () => {
    const result = parseVisionText(
      'Sony Camera\nMODEL: ILCE-7M3\nS/N 1234-ABCD\n2018',
      ['012345678905']
    );
    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'model', value: 'ILCE-7M3' }),
      expect.objectContaining({ field: 'serialNumber', value: '1234-ABCD' }),
      expect.objectContaining({ field: 'upc', value: '012345678905' })
    ]));
  });

  it('extracts edition, size, color, material, condition, and category', () => {
    const result = parseVisionText([
      'DeWalt Cordless Drill',
      'MODEL NO: DCD996',
      'EDITION: XR',
      'SIZE: 20V',
      'COLOR: Yellow',
      'MATERIAL: Steel',
      'CONDITION: Used - Good'
    ].join('\n'));

    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'brand', value: 'DeWalt' }),
      expect.objectContaining({ field: 'model', value: 'DCD996' }),
      expect.objectContaining({ field: 'edition', value: 'XR' }),
      expect.objectContaining({ field: 'size', value: '20V' }),
      expect.objectContaining({ field: 'color', value: 'Yellow' }),
      expect.objectContaining({ field: 'material', value: 'Steel' }),
      expect.objectContaining({ field: 'condition', value: 'Used - Good' }),
      expect.objectContaining({ field: 'category', value: 'tools' })
    ]));
  });

  it('accepts logo and object signals as separate evidence sources', () => {
    const result = parseVisionText('', [], [
      { field: 'brand', value: 'Makita', confidence: 0.94, source: 'logo' },
      { field: 'category', value: 'tools', confidence: 0.88, source: 'object' }
    ]);
    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'brand', source: 'logo' }),
      expect.objectContaining({ field: 'category', source: 'object' })
    ]));
  });

  it('turns candidates into traceable evidence records', () => {
    const candidate = parseVisionText('MODEL: DCD996', ['012345678905']);
    const evidence = visionCandidateToEvidence(
      candidate,
      'scan-1',
      'photo-7',
      '2026-07-14T12:00:00.000Z'
    );
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scanId: 'scan-1',
        field: 'model',
        sourceMediaId: 'photo-7',
        rawText: 'MODEL: DCD996'
      }),
      expect.objectContaining({ field: 'upc', sourceKind: 'barcode' })
    ]));
  });

  it('merges strongest field', () => {
    const first = parseVisionText('MODEL: A1');
    const second = {
      ...parseVisionText('MODEL: A2'),
      fields: [{ field: 'model', value: 'A2', confidence: 0.99 }]
    };
    expect(mergeVisionCandidates([first, second]).fields.find((field) => field.field === 'model')?.value).toBe('A2');
  });

  it('builds marketplace title', () => {
    expect(listingTitle({ brand: 'Nike', model: 'Air Jordan 1', year: '1985', size: '11' }))
      .toBe('Nike Air Jordan 1 1985 Size 11');
  });
});
