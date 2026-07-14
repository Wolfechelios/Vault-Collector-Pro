import { describe, expect, it } from 'vitest';
import {
  FieldSuggestionSchema,
  ScanEvidenceSchema,
  type FieldSuggestion,
  type ScanEvidence
} from './intelligence';

const evidence: ScanEvidence = {
  id: 'evidence-1',
  scanId: 'scan-1',
  field: 'model',
  value: 'DCD996',
  normalizedValue: 'DCD996',
  confidence: 0.97,
  sourceKind: 'ocr',
  sourceMediaId: 'photo-1',
  rawText: 'MODEL DCD996',
  bounds: { x: 0.1, y: 0.2, width: 0.4, height: 0.1 },
  createdAt: '2026-07-14T12:00:00.000Z'
};

describe('inventory intelligence contracts', () => {
  it('accepts complete traceable scan evidence', () => {
    expect(ScanEvidenceSchema.parse(evidence)).toEqual(evidence);
  });

  it('rejects confidence outside zero through one', () => {
    expect(() => ScanEvidenceSchema.parse({ ...evidence, confidence: 1.01 })).toThrow();
    expect(() => ScanEvidenceSchema.parse({ ...evidence, confidence: -0.01 })).toThrow();
  });

  it('requires every suggestion to reference supporting evidence', () => {
    const suggestion: FieldSuggestion = {
      id: 'suggestion-1',
      itemId: 'item-1',
      field: 'model',
      proposedValue: 'DCD996',
      confidence: 0.97,
      disposition: 'auto-applied',
      evidenceIds: [],
      conflictingEvidenceIds: [],
      influencedByRuleIds: [],
      verificationState: 'unverified',
      status: 'pending',
      createdAt: '2026-07-14T12:00:01.000Z'
    };

    expect(() => FieldSuggestionSchema.parse(suggestion)).toThrow();
  });
});
