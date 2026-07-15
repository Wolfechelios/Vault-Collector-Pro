import React from 'react';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';

export function CategorySchemaManager({ schemas, onSave, onDelete }: {
  schemas: CategorySchemaRecord[];
  onSave: (schema: CategorySchemaRecord) => void;
  onDelete: (category: string, key: string) => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const blank: CategorySchemaRecord = { category: 'other', key: '', label: '', kind: 'text', required: false, searchable: true, options: [], aliases: [], order: 100, enabled: true };
  return <section className="learning-rules"><div className="workspace-heading"><div><p className="eyebrow">DATABASE CONFIGURATION</p><h3>Category fields</h3></div><button className="primary" onClick={() => setCreating(true)}>＋ New field</button></div>
    {creating && <SchemaCard schema={blank} identityEditable onSave={schema => { onSave(schema); setCreating(false); }} onDelete={() => setCreating(false)}/>} 
    {schemas.map(schema => <SchemaCard key={`${schema.category}:${schema.key}`} schema={schema} onSave={onSave} onDelete={onDelete}/>)}
  </section>;
}

function SchemaCard({ schema, identityEditable = false, onSave, onDelete }: { schema: CategorySchemaRecord; identityEditable?: boolean; onSave: (value: CategorySchemaRecord) => void; onDelete: (category: string, key: string) => void }) {
  const [value, setValue] = React.useState(schema);
  return <article className={`rule-card ${value.enabled ? '' : 'disabled'}`}><div className="rule-card-head"><span>{value.category} · {value.key || 'new field'}</span><b>{value.enabled ? 'Enabled' : 'Disabled'}</b></div>
    {identityEditable && <><label>Category<input value={value.category} onChange={event => setValue({ ...value, category: event.target.value })}/></label><label>Field key<input value={value.key} onChange={event => setValue({ ...value, key: event.target.value })}/></label></>}
    <label>Label<input value={value.label} onChange={event => setValue({ ...value, label: event.target.value })}/></label>
    <label>Kind<select value={value.kind} onChange={event => setValue({ ...value, kind: event.target.value })}>{['text','number','select','identifier','color','material','condition'].map(kind => <option key={kind}>{kind}</option>)}</select></label>
    <label>Options<input value={value.options.join(', ')} onChange={event => setValue({ ...value, options: event.target.value.split(',').map(row => row.trim()).filter(Boolean) })}/></label>
    <label>Aliases<input value={value.aliases.join(', ')} onChange={event => setValue({ ...value, aliases: event.target.value.split(',').map(row => row.trim()).filter(Boolean) })}/></label>
    <label>Order<input type="number" value={value.order} onChange={event => setValue({ ...value, order: Number(event.target.value) })}/></label>
    <div className="rule-actions"><button className="secondary" onClick={() => onSave(value)}>Save field</button><button className="secondary" onClick={() => onSave({ ...value, enabled: !value.enabled })}>{value.enabled ? 'Disable' : 'Enable'} field</button><button className="danger-text" onClick={() => onDelete(value.category, value.key)}>Remove definition</button></div>
  </article>;
}
