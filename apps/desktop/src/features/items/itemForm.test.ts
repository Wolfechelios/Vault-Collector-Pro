import { describe, expect, it } from 'vitest';
import { emptyItemForm, formToDraft, validateItemForm } from './itemForm';

describe('item form', () => {
  it('requires title, category, and condition', () => {
    expect(validateItemForm({ ...emptyItemForm, title: '', category: '', condition: '' })).toEqual([
      'Title is required.', 'Category is required.', 'Condition is required.'
    ]);
  });

  it('converts dollar values into integer minor units', () => {
    const draft = formToDraft({ ...emptyItemForm, title: 'Test item', purchasePrice: '12.34', medianValue: '56.78' });
    expect(draft.purchasePrice?.amountMinor).toBe(1234);
    expect(draft.medianValue?.amountMinor).toBe(5678);
  });

  it('preserves dynamic specifics and records manually protected fields', () => {
    const draft = formToDraft({
      ...emptyItemForm,
      title: 'DeWalt drill',
      category: 'tools',
      specifics: { voltage: '20V', customKey: 'preserve me' },
      protectedFields: ['voltage']
    });
    expect(draft.specifics).toMatchObject({ voltage: '20V', customKey: 'preserve me' });
    expect(JSON.parse(draft.specifics.__protectedFields)).toEqual(['voltage']);
  });

  it('carries deferred inference provenance until a new item is persisted', () => {
    const draft = formToDraft({ ...emptyItemForm, title: 'Yellow DeWalt drill', inferredFields: ['brand', 'model'] });
    expect(JSON.parse(draft.specifics.__inferredFields)).toEqual(['brand', 'model']);
  });
});
