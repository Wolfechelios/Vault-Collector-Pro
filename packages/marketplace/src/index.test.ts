import { describe, expect, it } from 'vitest';
import type { ItemRecord } from '@vault/domain';
import { createListingDraft, exportListingsCsv, recommendShipping, trendPercent, valueItem } from './index';

const item: ItemRecord = {
  id: 'item-1', title: 'DeWalt 20V Max XR Impact Driver', category: 'tools', subcategory: 'power tools', status: 'private', condition: 'Used', conditionNotes: 'Light wear', description: 'Tested and working.', quantity: 1, sku: 'DW-1', serialNumber: null, brand: 'DeWalt', model: 'DCF887', year: null, edition: null, purchasePrice: null, medianValue: { amountMinor: 9500, currency: 'USD' }, suggestedPrice: { amountMinor: 10900, currency: 'USD' }, minimumPrice: null, notes: null, specifics: { photos: JSON.stringify(['data:image/jpeg;base64,one']) }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('marketplace intelligence', () => {
  it('creates a complete eBay-style listing draft', () => {
    const draft = createListingDraft(item, 'ebay');
    expect(draft.title.length).toBeLessThanOrEqual(80);
    expect(draft.priceMinor).toBe(10900);
    expect(draft.completeness).toBeGreaterThanOrEqual(80);
    expect(draft.shippingProfile.service).toBe('UPS Ground');
  });

  it('stores valuation summaries from provider results', () => {
    const snapshot = valueItem(item, [{ provider: 'ebay', health: 'ready', comparables: [
      { id: '1', provider: 'ebay', title: 'DeWalt DCF887 XR Impact Driver', soldAmountMinor: 9000, quantity: 1 },
      { id: '2', provider: 'ebay', title: 'DeWalt DCF887 20V Impact Driver', soldAmountMinor: 10000, quantity: 1 },
      { id: '3', provider: 'manual', title: 'DeWalt DCF887 XR Tool', soldAmountMinor: 9500, quantity: 1 }
    ] }]);
    expect(snapshot.summary.sampleCount).toBe(3);
    expect(snapshot.summary.medianMinor).toBe(9500);
  });

  it('exports marketplace drafts and calculates trends', () => {
    const draft = createListingDraft(item);
    expect(exportListingsCsv([draft])).toContain('DeWalt 20V Max XR Impact Driver');
    expect(recommendShipping(item).packageType).toBe('medium-box');
    const base = valueItem(item, [{ provider: 'manual', health: 'ready', comparables: [{ id: 'a', provider: 'manual', title: item.title, soldAmountMinor: 10000 }] }]);
    const later = { ...base, id: 'later', capturedAt: '2026-02-01T00:00:00.000Z', summary: { ...base.summary, medianMinor: 12000, weightedMedianMinor: 12000 } };
    expect(trendPercent([{ ...base, capturedAt: '2026-01-01T00:00:00.000Z' }, later])).toBe(20);
  });
});
