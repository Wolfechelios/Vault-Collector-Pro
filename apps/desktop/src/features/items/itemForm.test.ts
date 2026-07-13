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
});
