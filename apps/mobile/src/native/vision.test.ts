import { describe, expect, it } from 'vitest';
import { nativeResultToCandidate } from './vision';

describe('native vision adapter', () => {
  it('normalizes native signals without promoting uncertain logos', () => {
    const candidate = nativeResultToCandidate({
      rawText: 'DEWALT', barcodes: [], warnings: [],
      signals: [{ kind: 'logo', field: 'brand', value: 'DeWalt', confidence: 0.54, sourceImageId: 'p1', engine: 'Apple Vision' }]
    });
    expect(candidate.fields.find(row => row.field === 'brand')?.confidence).toBe(0.54);
    expect(candidate.fields.find(row => row.field === 'brand')?.source).toBe('logo');
  });

  it('normalizes object signals into category evidence', () => {
    const candidate = nativeResultToCandidate({ rawText: '', barcodes: [], warnings: [], signals: [
      { kind: 'object', field: 'category', value: 'tools', confidence: 0.81, sourceImageId: 'p1', engine: 'ML Kit' }
    ] });
    expect(candidate.fields).toContainEqual(expect.objectContaining({ field: 'category', value: 'tools', source: 'object' }));
  });
});
