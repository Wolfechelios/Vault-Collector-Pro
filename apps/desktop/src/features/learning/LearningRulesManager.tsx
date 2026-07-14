import React from 'react';
import type { RuleRecord } from '../../lib/catalogueApi';
import type { RuleKind } from '@vault/learning';

type Props = {
  rules: RuleRecord[];
  onToggle: (rule: RuleRecord) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate?: (rule: RuleRecord) => void | Promise<void>;
};

export function validateRuleDraft(kind: RuleKind, conditions: Record<string, string>, action: Record<string, string>): string | null {
  if (!conditions.field?.trim()) return 'Condition field is required.';
  if (kind === 'storage' && conditions.field !== 'storagePath') return 'Storage rules must target storagePath.';
  if (kind === 'storage' && !conditions.category?.trim()) return 'Storage rules require a category.';
  if (kind !== 'storage' && !conditions.value?.trim()) return 'Condition value is required.';
  if (!action.value?.trim()) return 'Suggested value is required.';
  return null;
}

function objectJson(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function RuleEditor({ rule, onToggle, onDelete, onUpdate }: { rule: RuleRecord } & Omit<Props, 'rules'>) {
  const [conditions, setConditions] = React.useState(() => objectJson(rule.conditionsJson));
  const [action, setAction] = React.useState(() => objectJson(rule.actionJson));
  const [priority, setPriority] = React.useState(rule.priority);
  const [explanation, setExplanation] = React.useState(rule.explanation);
  const [error, setError] = React.useState<string | null>(null);
  const setCondition = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => setConditions((current) => ({ ...current, [key]: event.target.value }));
  function save() {
    const validation = validateRuleDraft(rule.ruleKind, conditions, action);
    setError(validation);
    if (!validation && onUpdate) void onUpdate({
      ...rule, conditionsJson: JSON.stringify(conditions), actionJson: JSON.stringify(action),
      priority, explanation
    });
  }
  return <article className={rule.enabled ? 'rule-card' : 'rule-card disabled'}>
    <div className="rule-card-head"><span>{rule.ruleKind}</span><b>{rule.enabled ? 'Enabled' : 'Disabled'}</b></div>
    <h4>{rule.explanation}</h4>
    <p>{rule.evidenceCount} corrections · priority {rule.priority}</p>
    <div className="rule-editor-grid">
      <label>Condition field<input value={conditions.field ?? ''} onChange={setCondition('field')}/></label>
      {rule.ruleKind === 'storage'
        ? <label>Category<input value={conditions.category ?? ''} onChange={setCondition('category')}/></label>
        : <label>Condition value<input value={conditions.value ?? ''} onChange={setCondition('value')}/></label>}
      <label>Suggested value<input value={action.value ?? ''} onChange={(event) => setAction({ ...action, value: event.target.value })}/></label>
      <label>Priority<input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value) || 0)}/></label>
      <label className="full">Explanation<input value={explanation} onChange={(event) => setExplanation(event.target.value)}/></label>
    </div>
    {rule.ruleKind === 'storage' && <p className="rule-preview">Effect preview: empty {conditions.category || 'matching'} items → {action.value || 'no location selected'}. Existing locations stay unchanged.</p>}
    {error && <p className="field-error">{error}</p>}
    <details><summary>Inspect stored rule</summary><pre>{JSON.stringify({ conditions, action }, null, 2)}</pre></details>
    <div className="rule-actions">{onUpdate && <button className="primary" onClick={save}>Save changes</button>}<button className="secondary" onClick={() => onToggle(rule)}>{rule.enabled ? 'Disable' : 'Enable'}</button><button className="danger-text" onClick={() => onDelete(rule.id)}>Remove</button></div>
  </article>;
}

export function LearningRulesManager({ rules, onToggle, onDelete, onUpdate }: Props) {
  if (!rules.length) return <section className="panel center-panel"><h3>Learning Rules</h3><p>Rules appear after repeated accepted corrections.</p></section>;
  return <section className="learning-rules">
    <div className="workspace-heading"><div><p className="eyebrow">LOCAL · INSPECTABLE · REMOVABLE</p><h3>Learning Rules</h3></div><b>{rules.length} rules</b></div>
    {rules.map((rule) => <RuleEditor key={rule.id} rule={rule} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}/>)}
  </section>;
}
