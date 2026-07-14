import { describe, expect, it } from 'vitest';
import type { ItemFieldState, ScanEvidence } from '@vault/domain';
import {
  applySuggestion,
  buildSuggestions,
  confidenceBand,
  detectEvidenceConflicts
} from './index';

const evidence = (
  id: string,
  field: string,
  value: string,
  confidence: number
): ScanEvidence => ({
  id,
  scanId: 'scan-1',
  field,
  value,
  normalizedValue: value.trim().toUpperCase(),
  confidence,
  sourceKind: 'ocr',
  sourceMediaId: 'photo-1',
  rawText: value,
  bounds: null,
  createdAt: '2026-07-14T12:00:00.000Z'
});

const protectedState = (field: string, value: string): ItemFieldState => ({
  itemId: 'item-1',
  field,
  value,
  source: 'user',
  protected: true,
  verificationState: 'verified',
  confidence: null,
  evidenceIds: [],
  suggestionId: null,
  updatedAt: '2026-07-14T12:00:00.000Z'
});

describe('inventory inference', () => {
  it('auto-applies high-confidence evidence into an empty field', () => {
    const [suggestion] = buildSuggestions(
      [evidence('e1', 'model', 'DCD996', 0.97)],
      [],
      'item-1'
    );

    expect(suggestion).toMatchObject({
      field: 'model',
      proposedValue: 'DCD996',
      disposition: 'auto-applied',
      status: 'applied'
    });
  });

  it('saves medium-confidence evidence with a visible flag', () => {
    const [suggestion] = buildSuggestions(
      [evidence('e1', 'color', 'Yellow', 0.78)],
      [],
      'item-1'
    );

    expect(suggestion).toMatchObject({
      disposition: 'flagged',
      verificationState: 'flagged',
      status: 'applied'
    });
  });

  it('routes low-confidence evidence to review', () => {
    const [suggestion] = buildSuggestions(
      [evidence('e1', 'material', 'Leather', 0.42)],
      [],
      'item-1'
    );

    expect(suggestion).toMatchObject({ disposition: 'review', status: 'pending' });
  });

  it('routes conflicting evidence to review regardless of top confidence', () => {
    const rows = [
      evidence('e1', 'model', 'DCD996', 0.96),
      evidence('e2', 'model', 'DCD991', 0.91)
    ];

    expect(detectEvidenceConflicts(rows).model).toEqual(['e1', 'e2']);
    expect(buildSuggestions(rows, [], 'item-1')[0]).toMatchObject({
      disposition: 'review',
      conflictingEvidenceIds: ['e2']
    });
  });

  it('never silently replaces a protected user value', () => {
    const [suggestion] = buildSuggestions(
      [evidence('e1', 'model', 'DCD996', 0.99)],
      [protectedState('model', 'DCF887')],
      'item-1'
    );

    expect(suggestion).toMatchObject({
      disposition: 'review',
      protectedValue: 'DCF887',
      status: 'pending'
    });
    expect(() => applySuggestion({ model: 'DCF887' }, suggestion, { action: 'automatic' })).toThrow(
      'protected field'
    );
  });

  it('allows an explicit edited decision to replace a protected value', () => {
    const [suggestion] = buildSuggestions(
      [evidence('e1', 'model', 'DCD996', 0.99)],
      [protectedState('model', 'DCF887')],
      'item-1'
    );
    const result = applySuggestion(
      { model: 'DCF887' },
      suggestion,
      { action: 'edit', value: 'DCD996B' }
    );

    expect(result.values.model).toBe('DCD996B');
    expect(result.fieldState).toMatchObject({
      protected: true,
      source: 'user',
      verificationState: 'verified'
    });
  });

  it('uses stable confidence bands', () => {
    expect(confidenceBand(0.9)).toBe('high');
    expect(confidenceBand(0.65)).toBe('medium');
    expect(confidenceBand(0.649)).toBe('low');
  });

  it('retains learned-rule influence on new suggestions', () => {
    const row = {
      ...evidence('e1', 'brand', 'DeWalt', 0.96),
      provider: 'rules:rule:alias:brand:dew-alt:dewalt'
    };
    expect(buildSuggestions([row], [], 'item-1')[0].influencedByRuleIds).toEqual([
      'rule:alias:brand:dew-alt:dewalt'
    ]);
  });
});
