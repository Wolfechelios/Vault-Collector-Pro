export type LearningDecision = 'accepted' | 'edited' | 'rejected';
export type LearningEventInput = {
  itemId: string;
  suggestionId: string;
  field: string;
  decision: LearningDecision;
  proposedValue: string;
  finalValue: string | null;
  category?: string;
};

export type LearningEvent = LearningEventInput & {
  id: string;
  createdAt: string;
};

export type RuleKind = 'alias' | 'category' | 'storage' | 'provider-route' | 'title-format';
export type CorrectionRule = {
  id: string;
  kind: RuleKind;
  conditions: Record<string, string>;
  action: Record<string, string>;
  priority: number;
  evidenceCount: number;
  enabled: boolean;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleUpperCase();
const slug = (value: string) => normalize(value).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLocaleLowerCase();

export function createLearningEvent(
  input: LearningEventInput,
  createdAt = new Date().toISOString()
): LearningEvent {
  return {
    ...input,
    id: `learning:${input.itemId}:${input.suggestionId}:${input.decision}`,
    createdAt
  };
}

function kindForField(field: string): RuleKind {
  if (field === 'category') return 'category';
  if (field === 'storagePath') return 'storage';
  if (field === 'pricingProvider') return 'provider-route';
  if (field === 'titleFormat') return 'title-format';
  return 'alias';
}

function explanationFor(kind: RuleKind, from: string, to: string): string {
  const labels: Record<RuleKind, string> = {
    alias: 'Replace recognized alias',
    category: 'Prefer category',
    storage: 'Prefer storage location',
    'provider-route': 'Prefer pricing provider',
    'title-format': 'Prefer title format'
  };
  return `${labels[kind]} “${from}” with “${to}” after repeated accepted corrections.`;
}

export function deriveCorrectionRules(
  events: LearningEvent[],
  minimumEvidence = 2
): CorrectionRule[] {
  const groups = new Map<string, LearningEvent[]>();
  for (const event of events) {
    if (event.decision === 'rejected' || event.finalValue == null) continue;
    if (normalize(event.proposedValue) === normalize(event.finalValue) && event.field !== 'category') continue;
    const key = [event.field, normalize(event.proposedValue), normalize(event.finalValue), event.category ?? ''].join('|');
    const rows = groups.get(key) ?? [];
    rows.push(event);
    groups.set(key, rows);
  }

  return [...groups.values()]
    .filter((rows) => rows.length >= minimumEvidence)
    .map((rows) => {
      const first = rows[0];
      const finalValue = first.finalValue as string;
      const kind = kindForField(first.field);
      const createdAt = rows.map((row) => row.createdAt).sort()[0];
      const updatedAt = rows.map((row) => row.createdAt).sort().at(-1) as string;
      const conditions: Record<string, string> = {
        field: first.field
      };
      if (kind !== 'storage') conditions.value = first.proposedValue;
      if (first.category) conditions.category = first.category;
      return {
        id: `rule:${kind}:${slug(first.field)}:${slug(first.proposedValue)}:${slug(finalValue)}`,
        kind,
        conditions,
        action: { value: finalValue },
        priority: 100,
        evidenceCount: rows.length,
        enabled: true,
        explanation: explanationFor(kind, first.proposedValue, finalValue),
        createdAt,
        updatedAt
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function recommendStorage(
  input: { category: string; currentValue: string; protected: boolean },
  rules: CorrectionRule[]
): { value: string; influencedByRuleIds: string[]; disposition: 'flagged' } | null {
  if (input.protected || input.currentValue.trim()) return null;
  const matches = [...rules]
    .filter((rule) => rule.enabled && rule.kind === 'storage')
    .filter((rule) => rule.conditions.field === 'storagePath')
    .filter((rule) => !rule.conditions.category || normalize(rule.conditions.category) === normalize(input.category))
    .filter((rule) => Boolean(rule.action.value?.trim()))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const winner = matches[0];
  if (!winner) return null;
  return { value: winner.action.value.trim(), influencedByRuleIds: [winner.id], disposition: 'flagged' };
}

export function applyLearningRules(
  input: { field: string; value: string; category?: string },
  rules: CorrectionRule[]
): { value: string; influencedByRuleIds: string[] } {
  let value = input.value;
  const influencedByRuleIds: string[] = [];
  for (const rule of [...rules].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))) {
    if (!rule.enabled) continue;
    if (rule.conditions.field !== input.field) continue;
    if (normalize(rule.conditions.value ?? '') !== normalize(value)) continue;
    if (rule.conditions.category && normalize(rule.conditions.category) !== normalize(input.category ?? '')) continue;
    const next = rule.action.value;
    if (!next || normalize(next) === normalize(value)) continue;
    value = next;
    influencedByRuleIds.push(rule.id);
  }
  return { value, influencedByRuleIds };
}

export function updateRule(
  rule: CorrectionRule,
  patch: Partial<Pick<CorrectionRule, 'conditions' | 'action' | 'priority' | 'enabled' | 'explanation'>>,
  updatedAt = new Date().toISOString()
): CorrectionRule {
  return { ...rule, ...patch, updatedAt };
}
