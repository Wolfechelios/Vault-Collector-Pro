import React from 'react';
import type { RuleRecord } from '../../lib/catalogueApi';

type Props = {
  rules: RuleRecord[];
  onToggle: (rule: RuleRecord) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate?: (rule: RuleRecord) => void | Promise<void>;
};

export function LearningRulesManager({ rules, onToggle, onDelete, onUpdate }: Props) {
  if (!rules.length) return <section className="panel center-panel"><h3>Learning Rules</h3><p>Rules appear after repeated accepted corrections.</p></section>;
  return <section className="learning-rules">
    <div className="workspace-heading"><div><p className="eyebrow">LOCAL · INSPECTABLE · REMOVABLE</p><h3>Learning Rules</h3></div><b>{rules.length} rules</b></div>
    {rules.map((rule) => <article key={rule.id} className={rule.enabled ? 'rule-card' : 'rule-card disabled'}>
      <div className="rule-card-head"><span>{rule.ruleKind}</span><b>{rule.enabled ? 'Enabled' : 'Disabled'}</b></div>
      <h4>{rule.explanation}</h4>
      <p>{rule.evidenceCount} corrections · priority {rule.priority}</p>
      <details><summary>Inspect conditions and action</summary><pre>{JSON.stringify({ conditions: JSON.parse(rule.conditionsJson), action: JSON.parse(rule.actionJson) }, null, 2)}</pre></details>
      {onUpdate && <label>Priority<input type="number" value={rule.priority} onChange={(event) => onUpdate({ ...rule, priority: Number(event.target.value) || 0 })}/></label>}
      <div className="rule-actions"><button className="secondary" onClick={() => onToggle(rule)}>{rule.enabled ? 'Disable' : 'Enable'}</button><button className="danger-text" onClick={() => onDelete(rule.id)}>Remove</button></div>
    </article>)}
  </section>;
}
