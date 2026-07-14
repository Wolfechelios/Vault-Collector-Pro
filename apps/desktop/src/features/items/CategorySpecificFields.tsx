import React from 'react';
import { getCategoryFields } from '@vault/inventory-intelligence';

type Props = {
  category: string;
  values: Record<string, string>;
  protectedFields: string[];
  onChange: (key: string, value: string) => void;
};

const coreFields = new Set(['brand', 'model', 'serialNumber', 'year', 'edition', 'condition']);

export function CategorySpecificFields({ category, values, protectedFields, onChange }: Props) {
  const fields = getCategoryFields(category).filter((field) => !coreFields.has(field.key));
  return <fieldset className="category-specific"><legend>{category} specifics</legend>{fields.map((field) => <label key={field.key}>{field.label}{protectedFields.includes(field.key) && <small>🔒 Protected manual value</small>}{field.kind === 'select' ? <select value={values[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)}><option value="">Select…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.kind === 'number' ? 'number' : 'text'} value={values[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} placeholder={field.aliases[0]}/>}</label>)}</fieldset>;
}
