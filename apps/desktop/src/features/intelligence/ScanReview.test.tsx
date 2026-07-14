import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EvidenceRecord, ReviewSuggestion } from '../../lib/catalogueApi';
import { ScanReview } from './ScanReview';

const suggestion = (overrides: Partial<ReviewSuggestion>): ReviewSuggestion => ({
  id: 's1', itemId: 'item-1', fieldName: 'model', proposedValue: 'DCD996', confidence: 0.97,
  disposition: 'auto-applied', evidenceIds: ['e1'], conflictingEvidenceIds: [], influencedByRuleIds: [],
  verificationState: 'unverified', status: 'pending', createdAt: '2026-07-14T12:00:00.000Z',
  ...overrides
});
const evidence: EvidenceRecord = {
  id: 'e1', scanId: 'scan-1', itemId: 'item-1', fieldName: 'model', value: 'DCD996',
  normalizedValue: 'DCD996', confidence: 0.97, sourceKind: 'ocr', sourceMediaId: 'photo-1',
  rawText: 'MODEL DCD996', boundsJson: null, provider: 'Vault Vision parser',
  createdAt: '2026-07-14T12:00:00.000Z'
};

describe('Scan Review workspace', () => {
  it('renders confidence, conflict, protection, evidence, and learned-rule influence', () => {
    const html = renderToStaticMarkup(<ScanReview
      suggestions={[
        suggestion({}),
        suggestion({ id: 's2', confidence: 0.76, disposition: 'flagged', verificationState: 'flagged' }),
        suggestion({ id: 's3', confidence: 0.42, disposition: 'review', conflictingEvidenceIds: ['e2'], protectedValue: 'DCF887', influencedByRuleIds: ['rule-1'] })
      ]}
      evidence={[evidence]}
      itemTitles={{ 'item-1': 'DeWalt Drill' }}
      onDecision={() => undefined}
    />);

    expect(html).toContain('High confidence');
    expect(html).toContain('Medium confidence');
    expect(html).toContain('Needs review');
    expect(html).toContain('Protected user value');
    expect(html).toContain('Conflicting evidence');
    expect(html).toContain('MODEL DCD996');
    expect(html).toContain('rule-1');
  });
});
