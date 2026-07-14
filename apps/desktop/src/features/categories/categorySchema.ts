import type { CategorySchemaRecord } from '@vault/intelligence-sync';

export function fieldsForCategory(rows: CategorySchemaRecord[], category: string) {
  const normalized = category.toLocaleLowerCase();
  return rows.filter(row => row.enabled && (row.category === '*' || row.category.toLocaleLowerCase() === normalized))
    .sort((left, right) => left.order - right.order);
}
