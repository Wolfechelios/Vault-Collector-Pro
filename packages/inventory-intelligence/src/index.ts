import type {
  FieldSuggestion,
  ItemFieldState,
  ScanEvidence,
  SuggestionDisposition,
  VerificationState
} from '@vault/domain';

export type ConfidenceBand = 'high' | 'medium' | 'low';
export type SuggestionDecision =
  | { action: 'automatic' }
  | { action: 'accept' }
  | { action: 'edit'; value: string }
  | { action: 'reject' };

export type SuggestionApplication = {
  values: Record<string, string>;
  suggestion: FieldSuggestion;
  fieldState: ItemFieldState | null;
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleUpperCase();

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.65) return 'medium';
  return 'low';
}

function byField(evidence: ScanEvidence[]): Map<string, ScanEvidence[]> {
  const grouped = new Map<string, ScanEvidence[]>();
  for (const row of evidence) {
    const rows = grouped.get(row.field) ?? [];
    rows.push(row);
    grouped.set(row.field, rows);
  }
  return grouped;
}

export function detectEvidenceConflicts(evidence: ScanEvidence[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [field, rows] of byField(evidence)) {
    const credible = rows.filter((row) => row.confidence >= 0.65);
    const values = new Set(credible.map((row) => normalize(row.normalizedValue || row.value)));
    if (values.size > 1) {
      result[field] = credible
        .sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id))
        .map((row) => row.id);
    }
  }
  return result;
}

function dispositionFor(
  confidence: number,
  hasConflict: boolean,
  protectedReplacement: boolean
): { disposition: SuggestionDisposition; verificationState: VerificationState; status: FieldSuggestion['status'] } {
  if (hasConflict || protectedReplacement || confidence < 0.65) {
    return { disposition: 'review', verificationState: 'unverified', status: 'pending' };
  }
  if (confidence < 0.9) {
    return { disposition: 'flagged', verificationState: 'flagged', status: 'applied' };
  }
  return { disposition: 'auto-applied', verificationState: 'unverified', status: 'applied' };
}

export function buildSuggestions(
  evidence: ScanEvidence[],
  fieldStates: ItemFieldState[],
  itemId: string
): FieldSuggestion[] {
  const conflicts = detectEvidenceConflicts(evidence);
  const states = new Map(fieldStates.map((state) => [state.field, state]));
  const suggestions: FieldSuggestion[] = [];

  for (const [field, rows] of byField(evidence)) {
    const ranked = [...rows].sort(
      (left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id)
    );
    const winner = ranked[0];
    if (!winner) continue;
    const winningValue = normalize(winner.normalizedValue || winner.value);
    const supporting = ranked.filter(
      (row) => normalize(row.normalizedValue || row.value) === winningValue
    );
    const conflicting = ranked.filter(
      (row) => normalize(row.normalizedValue || row.value) !== winningValue && row.confidence >= 0.65
    );
    const confidence = Math.min(1, winner.confidence + Math.max(0, supporting.length - 1) * 0.03);
    const current = states.get(field);
    const protectedReplacement = Boolean(
      current?.protected && normalize(current.value) !== winningValue
    );
    const outcome = dispositionFor(
      confidence,
      Boolean(conflicts[field]?.length),
      protectedReplacement
    );
    const evidenceIds = supporting.map((row) => row.id);

    suggestions.push({
      id: `suggestion:${itemId}:${field}:${evidenceIds.join(',')}`,
      itemId,
      field,
      proposedValue: winner.value.trim(),
      confidence,
      ...outcome,
      evidenceIds,
      conflictingEvidenceIds: conflicting.map((row) => row.id),
      influencedByRuleIds: supporting
        .flatMap((row) => {
          if (!row.provider) return [];
          if (row.provider.startsWith('rules:')) return row.provider.slice(6).split(',').filter(Boolean);
          return row.sourceKind === 'learned-rule' ? [row.provider] : [];
        })
        .filter((ruleId, index, rows) => rows.indexOf(ruleId) === index),
      protectedValue: protectedReplacement ? current?.value ?? null : null,
      createdAt: winner.createdAt,
      decidedAt: outcome.status === 'applied' ? winner.createdAt : null
    });
  }

  return suggestions.sort((left, right) => left.field.localeCompare(right.field));
}

export function applySuggestion(
  currentValues: Record<string, string>,
  suggestion: FieldSuggestion,
  decision: SuggestionDecision
): SuggestionApplication {
  if (decision.action === 'automatic' && suggestion.protectedValue != null) {
    throw new Error(`Cannot automatically replace protected field ${suggestion.field}.`);
  }
  if (decision.action === 'automatic' && suggestion.disposition === 'review') {
    throw new Error(`Cannot automatically apply review suggestion ${suggestion.id}.`);
  }
  if (decision.action === 'reject') {
    return {
      values: { ...currentValues },
      suggestion: {
        ...suggestion,
        status: 'rejected',
        verificationState: 'rejected',
        decidedAt: new Date().toISOString()
      },
      fieldState: null
    };
  }

  const edited = decision.action === 'edit';
  const value = edited ? decision.value.trim() : suggestion.proposedValue;
  if (!value) throw new Error(`Field ${suggestion.field} cannot be empty.`);
  const explicit = decision.action === 'accept' || edited;
  const decidedAt = new Date().toISOString();
  const fieldState: ItemFieldState = {
    itemId: suggestion.itemId,
    field: suggestion.field,
    value,
    source: edited ? 'user' : 'inference',
    protected: explicit,
    verificationState: explicit ? 'verified' : suggestion.verificationState,
    confidence: suggestion.confidence,
    evidenceIds: [...suggestion.evidenceIds],
    suggestionId: suggestion.id,
    updatedAt: decidedAt
  };

  return {
    values: { ...currentValues, [suggestion.field]: value },
    suggestion: {
      ...suggestion,
      proposedValue: value,
      status: edited ? 'edited' : explicit ? 'accepted' : 'applied',
      verificationState: fieldState.verificationState,
      decidedAt
    },
    fieldState
  };
}

export * from './categories';
