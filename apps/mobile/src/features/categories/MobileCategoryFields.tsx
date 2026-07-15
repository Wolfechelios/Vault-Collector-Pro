import React from 'react';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';

const core = new Set(['brand', 'model', 'serialNumber', 'year', 'edition', 'condition']);

export function MobileCategoryFields({ definitions, values, onChange }: {
  definitions: CategorySchemaRecord[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const fields = definitions.filter(row => row.enabled && !core.has(row.key)).sort((a, b) => a.order - b.order);
  if (!fields.length) return null;
  return <fieldset className="mobile-specifics"><legend>Category specifics</legend>{fields.map(field => <label key={`${field.category}:${field.key}`}>{field.label}{field.required && <small>Required</small>}{field.kind === 'select' ? <select value={values[field.key] ?? ''} onChange={event => onChange(field.key, event.target.value)}><option value="">Select…</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : <input type={field.kind === 'number' ? 'number' : 'text'} value={values[field.key] ?? ''} placeholder={field.aliases[0]} onChange={event => onChange(field.key, event.target.value)}/>}</label>)}</fieldset>;
}
