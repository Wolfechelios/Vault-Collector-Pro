import { invoke } from '@tauri-apps/api/core';
import type { ItemRecord } from '@vault/domain';
import type { VisionResult } from '@vault/domain';
import type { FieldSuggestion, ItemFieldState, ScanEvidence } from '@vault/domain';
import type { CorrectionRule } from '@vault/learning';
import type { ParsedSearchQuery } from '@vault/search';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';

export type ItemDraft = {
  id?: string;
  title: string;
  category: string;
  subcategory?: string | null;
  status?: 'private' | 'draft' | 'listed' | 'sold' | 'archived';
  condition: string;
  conditionNotes?: string | null;
  description?: string | null;
  quantity?: number;
  sku?: string | null;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  edition?: string | null;
  purchasePrice?: { amountMinor: number; currency: string } | null;
  medianValue?: { amountMinor: number; currency: string } | null;
  suggestedPrice?: { amountMinor: number; currency: string } | null;
  minimumPrice?: { amountMinor: number; currency: string } | null;
  storageLocationId?: string | null;
  acquiredAt?: string | null;
  notes?: string | null;
  specifics: Record<string, string>;
};

export type SearchRequest = { query: string; category: string | null; status: string | null; limit: number; offset: number };

export type ReviewSuggestion = Omit<FieldSuggestion, 'field'> & { fieldName: string };
export type EvidenceRecord = Omit<ScanEvidence, 'field' | 'bounds'> & {
  fieldName: string;
  boundsJson: string | null;
};
export type FieldStateRecord = Omit<ItemFieldState, 'field'> & { fieldName: string };
export type RuleRecord = {
  id: string;
  ruleKind: CorrectionRule['kind'];
  conditionsJson: string;
  actionJson: string;
  priority: number;
  evidenceCount: number;
  enabled: boolean;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};
export type SavedSearchRecord = {
  id: string; name: string; queryText: string; parsedQueryJson: string;
  isSmartCollection: boolean; createdAt: string; updatedAt: string;
};
export type SearchHistoryRecord = {
  id: string; queryText: string; parsedQueryJson: string; resultCount: number; searchedAt: string;
};
export type MobileImportResult = { applied: number; duplicates: number; conflicts: number; revision: number };

const evidenceForRust = (row: ScanEvidence) => ({
  id: row.id,
  scanId: row.scanId,
  itemId: row.itemId ?? null,
  fieldName: row.field,
  value: row.value,
  normalizedValue: row.normalizedValue,
  confidence: row.confidence,
  sourceKind: row.sourceKind,
  sourceMediaId: row.sourceMediaId,
  rawText: row.rawText,
  boundsJson: row.bounds ? JSON.stringify(row.bounds) : null,
  provider: row.provider ?? null,
  createdAt: row.createdAt
});

const suggestionForRust = (row: FieldSuggestion) => ({
  id: row.id,
  itemId: row.itemId,
  fieldName: row.field,
  proposedValue: row.proposedValue,
  confidence: row.confidence,
  disposition: row.disposition,
  evidenceIds: row.evidenceIds,
  conflictingEvidenceIds: row.conflictingEvidenceIds,
  influencedRuleIds: row.influencedByRuleIds,
  verificationState: row.verificationState,
  status: row.status,
  protectedValue: row.protectedValue ?? null,
  createdAt: row.createdAt
});

const intelligentRequest = (parsed: ParsedSearchQuery) => ({
  ftsQuery: parsed.ftsQuery,
  category: parsed.filters.category ?? null,
  color: parsed.filters.color ?? null,
  brand: parsed.filters.brand ?? null,
  yearOperator: parsed.filters.year?.operator ?? null,
  yearValue: parsed.filters.year?.value ?? null,
  valueOperator: parsed.filters.valueMinor?.operator ?? null,
  valueMinor: parsed.filters.valueMinor?.value ?? null,
  quantityOperator: parsed.filters.quantity?.operator ?? null,
  quantityValue: parsed.filters.quantity?.value ?? null,
  status: parsed.filters.status ?? null,
  condition: parsed.filters.condition ?? null,
  location: parsed.filters.location ?? null,
  listed: parsed.filters.listed ?? null,
  missingPhotos: parsed.filters.missingPhotos ?? null,
  reviewNeeded: parsed.filters.reviewNeeded ?? null,
  unpriced: parsed.filters.unpriced ?? null,
  unassigned: parsed.filters.unassigned ?? null,
  duplicate: parsed.filters.duplicate ?? null,
  limit: 2000
});

export const catalogueApi = {
  search: (request: SearchRequest) => invoke<ItemRecord[]>('search_items', { request }),
  create: (draft: ItemDraft) => invoke<ItemRecord>('create_item', { draft }),
  update: (id: string, draft: ItemDraft) => invoke<ItemRecord>('update_item', { id, draft }),
  archive: (id: string) => invoke<void>('archive_item', { id }),
  analyzeImage: (dataUrl: string) => invoke<VisionResult>('analyze_image', { dataUrl }),
  recordAnalysis: (evidence: ScanEvidence[], suggestions: FieldSuggestion[]) => invoke<void>(
    'record_intelligence_analysis',
    { evidence: evidence.map(evidenceForRust), suggestions: suggestions.map(suggestionForRust) }
  ),
  reviewQueue: () => invoke<ReviewSuggestion[]>('list_review_queue'),
  evidence: (itemId: string) => invoke<EvidenceRecord[]>('list_item_evidence', { itemId }),
  fieldState: (itemId: string) => invoke<FieldStateRecord[]>('get_item_field_state', { itemId }),
  decideSuggestion: (id: string, action: 'automatic' | 'accept' | 'edit' | 'reject', value?: string) =>
    invoke<void>('decide_field_suggestion', { id, decision: { action, value: value ?? null } }),
  learningRules: () => invoke<RuleRecord[]>('list_learning_rules'),
  upsertLearningRule: (rule: RuleRecord) => invoke<void>('upsert_learning_rule', { rule }),
  deleteLearningRule: (id: string) => invoke<void>('delete_learning_rule', { id }),
  categorySchemas: () => invoke<CategorySchemaRecord[]>('list_category_schemas'),
  upsertCategorySchema: (schema: CategorySchemaRecord) => invoke<CategorySchemaRecord>('upsert_category_schema', { schema }),
  deleteCategorySchema: (category: string, key: string) => invoke<void>('delete_category_schema', { category, key }),
  intelligentSearch: async (parsed: ParsedSearchQuery) => {
    const results = await invoke<ItemRecord[]>('intelligent_search', { request: intelligentRequest(parsed) });
    await invoke<void>('record_search_history', {
      queryText: parsed.original,
      parsedJson: JSON.stringify(parsed),
      resultCount: results.length
    });
    return results;
  },
  saveSearch: (id: string, name: string, parsed: ParsedSearchQuery, smart = false) => invoke<void>(
    'save_intelligent_search',
    { id, name, queryText: parsed.original, parsedJson: JSON.stringify(parsed), smart }
  ),
  savedSearches: () => invoke<SavedSearchRecord[]>('list_saved_searches'),
  searchHistory: (limit = 20) => invoke<SearchHistoryRecord[]>('list_search_history', { limit })
  ,exportIntelligenceBundle: () => invoke<string>('export_intelligence_bundle')
  ,importMobileChangeBundle: (bundleJson: string) => invoke<MobileImportResult>('import_mobile_change_bundle', { bundleJson })
};
