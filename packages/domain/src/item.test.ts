import { describe, expect, it } from 'vitest';
import { ItemRecordSchema } from './item';

describe('ItemRecordSchema', () => {
  it('accepts a complete private listing-first item', () => {
    const parsed = ItemRecordSchema.parse({
      id: '01JVAULT000000000000000001',
      title: '1999 Pokémon Base Set Charizard #4 Shadowless',
      category: 'cards',
      subcategory: 'Trading Card Games',
      status: 'private',
      condition: 'Excellent-Mint (EX-MT 7)',
      conditionNotes: 'Light corner wear; no creases.',
      description: 'Private catalogue record generated from local capture.',
      quantity: 1,
      sku: 'CARD-000001',
      serialNumber: null,
      brand: 'Pokémon',
      model: null,
      year: 1999,
      edition: 'Shadowless',
      purchasePrice: { amountMinor: 280000, currency: 'USD' },
      medianValue: { amountMinor: 650000, currency: 'USD' },
      suggestedPrice: { amountMinor: 699900, currency: 'USD' },
      minimumPrice: { amountMinor: 600000, currency: 'USD' },
      storageLocationId: null,
      acquiredAt: '2024-10-18T10:30:00.000Z',
      soldAt: null,
      soldPrice: null,
      notes: 'Dream card.',
      specifics: { cardNumber: '#4', variant: 'Shadowless' },
      media: [],
      evidence: [],
      createdAt: '2024-10-18T10:30:00.000Z',
      updatedAt: '2024-10-18T10:30:00.000Z'
    });

    expect(parsed.status).toBe('private');
    expect(parsed.specifics.variant).toBe('Shadowless');
  });

  it('rejects an unknown item status', () => {
    const result = ItemRecordSchema.safeParse({
      id: '01JVAULT000000000000000001',
      title: 'Invalid status fixture',
      category: 'cards',
      status: 'mystery',
      condition: 'Good',
      quantity: 1,
      specifics: {},
      media: [],
      evidence: [],
      createdAt: '2024-10-18T10:30:00.000Z',
      updatedAt: '2024-10-18T10:30:00.000Z'
    });

    expect(result.success).toBe(false);
  });
});
