import { invoke } from '@tauri-apps/api/core';
import type { ItemRecord } from '@vault/domain';
import type { VisionResult } from '@vault/domain';

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

export const catalogueApi = {
  search: (request: SearchRequest) => invoke<ItemRecord[]>('search_items', { request }),
  create: (draft: ItemDraft) => invoke<ItemRecord>('create_item', { draft }),
  update: (id: string, draft: ItemDraft) => invoke<ItemRecord>('update_item', { id, draft }),
  archive: (id: string) => invoke<void>('archive_item', { id }),
  analyzeImage: (dataUrl: string) => invoke<VisionResult>('analyze_image', { dataUrl })
};
