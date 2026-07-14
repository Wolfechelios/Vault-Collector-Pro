import { describe, expect, it } from 'vitest';
import {
  applyLearningRules,
  createLearningEvent,
  deriveCorrectionRules,
  updateRule
} from './index';

describe('local learning engine', () => {
  it('records accepted, edited, and rejected suggestion decisions', () => {
    const accepted = createLearningEvent({
      itemId: 'item-1', suggestionId: 's1', field: 'category',
      decision: 'accepted', proposedValue: 'tools', finalValue: 'tools'
    }, '2026-07-14T12:00:00.000Z');
    const edited = createLearningEvent({
      itemId: 'item-2', suggestionId: 's2', field: 'brand',
      decision: 'edited', proposedValue: 'DEW ALT', finalValue: 'DeWalt'
    }, '2026-07-14T12:01:00.000Z');
    const rejected = createLearningEvent({
      itemId: 'item-3', suggestionId: 's3', field: 'model',
      decision: 'rejected', proposedValue: 'DCD991', finalValue: null
    }, '2026-07-14T12:02:00.000Z');

    expect([accepted, edited, rejected].map((event) => event.decision)).toEqual([
      'accepted', 'edited', 'rejected'
    ]);
  });

  it('learns an inspectable OCR alias only after repeated corrections', () => {
    const events = ['item-1', 'item-2'].map((itemId, index) => createLearningEvent({
      itemId,
      suggestionId: `s${index}`,
      field: 'brand',
      decision: 'edited',
      proposedValue: 'DEW ALT',
      finalValue: 'DeWalt'
    }, `2026-07-14T12:0${index}:00.000Z`));

    const [rule] = deriveCorrectionRules(events, 2);
    expect(rule).toMatchObject({
      kind: 'alias',
      conditions: { field: 'brand', value: 'DEW ALT' },
      action: { value: 'DeWalt' },
      evidenceCount: 2,
      enabled: true
    });
    expect(rule.explanation).toContain('DEW ALT');
  });

  it('learns storage, provider-routing, category, and title-format preferences', () => {
    const inputs = [
      ['storagePath', 'tools', 'Garage / Shelf B'],
      ['pricingProvider', 'cards', 'eBay'],
      ['category', 'DCD996', 'tools'],
      ['titleFormat', 'tools', '{brand} {model} {name}']
    ] as const;
    const events = inputs.flatMap(([field, proposedValue, finalValue], group) =>
      [0, 1].map((index) => createLearningEvent({
        itemId: `item-${group}-${index}`,
        suggestionId: `s-${group}-${index}`,
        field,
        decision: 'edited',
        proposedValue,
        finalValue
      }, `2026-07-14T12:${group}${index}:00.000Z`))
    );

    expect(deriveCorrectionRules(events, 2).map((rule) => rule.kind)).toEqual(
      expect.arrayContaining(['storage', 'provider-route', 'category', 'title-format'])
    );
  });

  it('shows which enabled learned rule influenced a suggestion', () => {
    const events = ['item-1', 'item-2'].map((itemId, index) => createLearningEvent({
      itemId,
      suggestionId: `s${index}`,
      field: 'brand',
      decision: 'edited',
      proposedValue: 'DEW ALT',
      finalValue: 'DeWalt'
    }, `2026-07-14T12:0${index}:00.000Z`));
    const [rule] = deriveCorrectionRules(events, 2);

    expect(applyLearningRules({ field: 'brand', value: 'DEW ALT', category: 'tools' }, [rule]))
      .toEqual({ value: 'DeWalt', influencedByRuleIds: [rule.id] });
  });

  it('allows rules to be edited and disabled without opaque training', () => {
    const [rule] = deriveCorrectionRules([
      createLearningEvent({ itemId: '1', suggestionId: '1', field: 'brand', decision: 'edited', proposedValue: 'DEW ALT', finalValue: 'DeWalt' }),
      createLearningEvent({ itemId: '2', suggestionId: '2', field: 'brand', decision: 'edited', proposedValue: 'DEW ALT', finalValue: 'DeWalt' })
    ], 2);
    const disabled = updateRule(rule, { enabled: false, action: { value: 'DEWALT' } });

    expect(disabled).toMatchObject({ enabled: false, action: { value: 'DEWALT' } });
    expect(applyLearningRules({ field: 'brand', value: 'DEW ALT' }, [disabled]))
      .toEqual({ value: 'DEW ALT', influencedByRuleIds: [] });
  });
});
