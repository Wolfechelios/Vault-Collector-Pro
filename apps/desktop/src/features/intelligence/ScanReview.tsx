import React from 'react';
import type { EvidenceRecord, ReviewSuggestion } from '../../lib/catalogueApi';
import { EvidenceViewer } from './EvidenceViewer';

type Decision = { action: 'accept' | 'edit' | 'reject'; value?: string };
type Props = {
  suggestions: ReviewSuggestion[];
  evidence: EvidenceRecord[];
  itemTitles: Record<string, string>;
  onDecision: (id: string, decision: Decision) => void | Promise<void>;
};

const confidenceLabel = (confidence: number) => confidence >= 0.9
  ? 'High confidence'
  : confidence >= 0.65 ? 'Medium confidence' : 'Needs review';

export function ScanReview({ suggestions, evidence, itemTitles, onDecision }: Props) {
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  if (!suggestions.length) return <section className="panel center-panel"><h3>Scan Review</h3><p>Nothing needs review.</p></section>;
  return <section className="scan-review">
    <div className="workspace-heading"><div><p className="eyebrow">EVIDENCE-BACKED INVENTORY</p><h3>Scan Review</h3></div><b>{suggestions.length} field{suggestions.length === 1 ? '' : 's'}</b></div>
    {suggestions.map((suggestion) => {
      const sources = evidence.filter((row) => suggestion.evidenceIds.includes(row.id) || suggestion.conflictingEvidenceIds.includes(row.id));
      return <article key={suggestion.id} className={`review-card ${suggestion.disposition}`}>
        <div className="review-card-head"><div><small>{itemTitles[suggestion.itemId] ?? suggestion.itemId}</small><h4>{suggestion.fieldName}</h4></div><span className={`confidence ${suggestion.disposition}`}>{confidenceLabel(suggestion.confidence)} · {Math.round(suggestion.confidence * 100)}%</span></div>
        <label>Proposed value<input value={edits[suggestion.id] ?? suggestion.proposedValue} onChange={(event) => setEdits((current) => ({ ...current, [suggestion.id]: event.target.value }))}/></label>
        {suggestion.protectedValue != null && <div className="protected-warning">🔒 Protected user value: <strong>{suggestion.protectedValue}</strong></div>}
        {suggestion.conflictingEvidenceIds.length > 0 && <div className="vision-warning">Conflicting evidence must be resolved manually.</div>}
        {suggestion.influencedByRuleIds.length > 0 && <div className="rule-influence">Learned rules: {suggestion.influencedByRuleIds.join(', ')}</div>}
        <EvidenceViewer evidence={sources}/>
        <div className="review-actions">
          <button className="danger-text" onClick={() => onDecision(suggestion.id, { action: 'reject' })}>Reject</button>
          <button className="secondary" onClick={() => onDecision(suggestion.id, { action: 'edit', value: edits[suggestion.id] ?? suggestion.proposedValue })}>Save edit</button>
          <button className="primary" onClick={() => onDecision(suggestion.id, { action: 'accept' })}>Accept suggestion</button>
        </div>
      </article>;
    })}
  </section>;
}
