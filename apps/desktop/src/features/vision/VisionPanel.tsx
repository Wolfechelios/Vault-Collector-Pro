import React from 'react';
import type { FieldSuggestion, ItemFieldState, ScanEvidence, VisionResult } from '@vault/domain';
import { applyLearningRules, type CorrectionRule } from '@vault/learning';
import { buildSuggestions } from '@vault/inventory-intelligence';
import {
  listingTitle,
  mergeVisionCandidates,
  parseVisionText,
  visionCandidateToEvidence,
  type VisionCandidate
} from '@vault/vision';
import { catalogueApi } from '../../lib/catalogueApi';

type Props = {
  open: boolean;
  itemId?: string;
  onClose: () => void;
  onApply: (fields: Record<string, string>, analysis: PendingIntelligenceAnalysis) => void;
  photos?: string[];
};

export type PendingIntelligenceAnalysis = {
  evidence: ScanEvidence[];
  suggestions: FieldSuggestion[];
};

const toRule = (row: Awaited<ReturnType<typeof catalogueApi.learningRules>>[number]): CorrectionRule => ({
  id: row.id,
  kind: row.ruleKind,
  conditions: JSON.parse(row.conditionsJson),
  action: JSON.parse(row.actionJson),
  priority: row.priority,
  evidenceCount: row.evidenceCount,
  enabled: row.enabled,
  explanation: row.explanation,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export function VisionPanel({ open, itemId, onClose, onApply, photos = [] }: Props) {
  const [raw, setRaw] = React.useState('');
  const [result, setResult] = React.useState<VisionCandidate | null>(null);
  const [suggestions, setSuggestions] = React.useState<FieldSuggestion[]>([]);
  const [analysis, setAnalysis] = React.useState<PendingIntelligenceAnalysis>({ evidence: [], suggestions: [] });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  async function scan() {
    setBusy(true);
    setMessage('');
    try {
      const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const candidates: VisionCandidate[] = [];
      let evidence: ScanEvidence[] = [];
      for (const [index, photo] of photos.slice(0, 8).entries()) {
        const response: VisionResult = await catalogueApi.analyzeImage(photo);
        const candidate = parseVisionText(response.rawText, response.barcodes);
        candidates.push(candidate);
        evidence.push(...visionCandidateToEvidence(candidate, scanId, `form-photo-${index + 1}`));
      }
      if (raw.trim()) {
        const candidate = parseVisionText(raw);
        candidates.push(candidate);
        evidence.push(...visionCandidateToEvidence(candidate, scanId, null));
      }
      if (!candidates.length) {
        const candidate = parseVisionText(raw);
        candidates.push(candidate);
        evidence.push(...visionCandidateToEvidence(candidate, scanId, null));
      }
      const merged = mergeVisionCandidates(candidates);
      const [ruleRows, stateRows] = await Promise.all([
        catalogueApi.learningRules().catch(() => []),
        itemId ? catalogueApi.fieldState(itemId).catch(() => []) : Promise.resolve([])
      ]);
      const rules = ruleRows.map(toRule);
      evidence = evidence.map((row) => {
        const influenced = applyLearningRules({ field: row.field, value: row.value }, rules);
        return influenced.influencedByRuleIds.length ? {
          ...row,
          value: influenced.value,
          normalizedValue: influenced.value.toLocaleUpperCase(),
          confidence: Math.min(1, row.confidence + 0.02),
          provider: `rules:${influenced.influencedByRuleIds.join(',')}`
        } : row;
      });
      const fieldState: ItemFieldState[] = stateRows.map((row) => ({ ...row, field: row.fieldName }));
      const built = buildSuggestions(evidence, fieldState, itemId ?? 'draft-item');
      setRaw(merged.rawText);
      setResult(merged);
      setSuggestions(built);
      setAnalysis({ evidence, suggestions: built });
      if (itemId && built.length) {
        await catalogueApi.recordAnalysis(
          evidence.map((row) => ({ ...row, itemId })),
          built
        );
        setMessage(`${built.filter((row) => row.status === 'applied').length} fields saved; ${built.filter((row) => row.status === 'pending').length} sent to Scan Review.`);
      }
    } catch (error) {
      const fallback = parseVisionText(raw);
      setResult({ ...fallback, engine: `Manual fallback: ${String(error)}` });
      setSuggestions([]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const appliedFields = Object.fromEntries(suggestions.filter((row) => row.status === 'applied').map((row) => [row.field, row.proposedValue]));
  const proposedTitle = listingTitle(appliedFields, appliedFields.title);
  return <div className="modal-backdrop"><div className="editor vision-panel">
    <div className="editor-head"><div><p className="eyebrow">MULTI-PHOTO LOCAL VISION</p><h2>Evidence and field review</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>
    {photos.length > 0 && <div className="photo-strip">{photos.slice(0, 8).map((photo, index) => <img className="vision-preview-mini" key={index} src={photo}/>)}</div>}
    <textarea rows={8} value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="Apple Vision OCR appears here. You may paste label text for manual parsing."/>
    <div className="editor-actions"><button type="button" className="secondary" onClick={scan}>{busy ? 'Analyzing…' : photos.length ? 'Analyze photos' : 'Parse text'}</button></div>
    {message && <div className="banner success">{message}</div>}
    {result && <><div className="engine-note">{result.engine} · {result.barcodes.length} barcode(s)</div>{result.warnings.map((warning) => <div className="vision-warning" key={warning}>{warning}</div>)}<div className="ocr-fields">{suggestions.map((suggestion) => <div key={suggestion.id} className={suggestion.disposition}><span>{suggestion.field}</span><strong>{suggestion.proposedValue}</strong><small>{Math.round(suggestion.confidence * 100)}% · {suggestion.disposition}</small>{suggestion.influencedByRuleIds.length > 0 && <small>Rules: {suggestion.influencedByRuleIds.join(', ')}</small>}</div>)}</div><div className="suggested-title"><span>Suggested listing title</span><strong>{proposedTitle}</strong></div><button type="button" className="primary" onClick={() => onApply({ ...appliedFields, title: proposedTitle }, analysis)}>Use saved and flagged fields</button></>}
  </div></div>;
}
