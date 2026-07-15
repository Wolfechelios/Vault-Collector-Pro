import React from 'react';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';
import { fieldsForCategory } from '../categories/categorySchema';

type Props = {
  category: string;
  values: Record<string, string>;
  protectedFields: string[];
  onChange: (key: string, value: string) => void;
  definitions: CategorySchemaRecord[];
};

const coreFields = new Set(['brand', 'model', 'serialNumber', 'year', 'edition', 'condition']);

export function CategorySpecificFields({ category, values, protectedFields, onChange, definitions }: Props) {
  const fields = fieldsForCategory(definitions, category).filter((field) => !coreFields.has(field.key));
  return <fieldset className="category-specific"><legend>{category} specifics</legend>{fields.map((field) => <label key={field.key}>{field.label}{protectedFields.includes(field.key) && <small>🔒 Protected manual value</small>}{field.kind === 'select' ? <select value={values[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)}><option value="">Select…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.kind === 'number' ? 'number' : 'text'} value={values[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} placeholder={field.aliases[0]}/>}</label>)}</fieldset>;
}
