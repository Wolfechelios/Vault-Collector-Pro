import type { ItemRecord } from '@vault/domain';

export type EvidenceSource = 'ocr' | 'barcode' | 'logo' | 'object' | 'layout' | 'user-rule' | 'combined';
export type ProposalState = 'auto-saved' | 'review' | 'conflict' | 'verified' | 'rejected';
export type InventoryField = 'title' | 'category' | 'subcategory' | 'brand' | 'model' | 'serialNumber' | 'sku' | 'year' | 'edition' | 'condition' | 'conditionNotes' | 'description' | `specifics.${string}`;
export type FieldProposal = { id: string; field: InventoryField; value: string; confidence: number; source: EvidenceSource; sourceMediaId: string | null; rawText: string | null; state: ProposalState; createdAt: string };
export type LearningRule = { id: string; field: InventoryField; pattern: string; value: string; category?: string | null; brand?: string | null; enabled: boolean };
export type ScanInput = { ocrText?: string; barcodes?: string[]; sourceMediaId?: string | null; existing?: Partial<ItemRecord>; verifiedFields?: InventoryField[]; learningRules?: LearningRule[] };
export type ScanAnalysis = { proposals: FieldProposal[]; canonical: Record<string, string | number>; suggestions: FieldProposal[]; conflicts: FieldProposal[]; pricingQuery: string; storageRoute: string[] };

const now = () => new Date().toISOString();
const uid = () => `evidence_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const proposal = (field: InventoryField, value: string, confidence: number, source: EvidenceSource, rawText: string | null, sourceMediaId: string | null): FieldProposal => ({ id: uid(), field, value: clean(value), confidence: Math.max(0, Math.min(1, confidence)), source, rawText, sourceMediaId, state: confidence >= 0.8 ? 'auto-saved' : 'review', createdAt: now() });

export function inferInventoryCategory(text: string): { category: string; subcategory: string; confidence: number } {
  const value = text.toLowerCase();
  if (/pokemon|yugioh|magic[: ] the gathering|sports card|rookie card|card number|psa|bgs|cgc/.test(value)) return { category: 'collectibles', subcategory: 'trading cards', confidence: 0.96 };
  if (/morgan dollar|peace dollar|half dollar|quarter|dime|cent|coin|mint mark/.test(value)) return { category: 'coins', subcategory: /morgan/.test(value) ? 'silver dollars' : 'coins', confidence: 0.94 };
  if (/dewalt|milwaukee|makita|impact driver|drill|sawzall|circular saw|power tool/.test(value)) return { category: 'tools', subcategory: 'power tools', confidence: 0.93 };
  if (/nike|adidas|jordan|new balance|size\s*\d{1,2}(\.5)?|shoe|sneaker/.test(value)) return { category: 'clothing', subcategory: 'shoes', confidence: 0.9 };
  if (/vinyl|lp|record|catalog no|discogs|33\s*rpm|45\s*rpm/.test(value)) return { category: 'music', subcategory: 'vinyl records', confidence: 0.92 };
  if (/laptop|macbook|thinkpad|processor|ram|ssd|serial number/.test(value)) return { category: 'electronics', subcategory: 'computers', confidence: 0.89 };
  if (/playstation|xbox|nintendo|game cartridge|video game/.test(value)) return { category: 'video games', subcategory: 'games and consoles', confidence: 0.9 };
  return { category: 'other', subcategory: 'uncategorized', confidence: 0.55 };
}

function extractBarcode(barcodes: string[], mediaId: string | null): FieldProposal[] {
  const results: FieldProposal[] = [];
  for (const raw of barcodes.map(clean).filter(Boolean)) {
    const field = /^\d{12}$/.test(raw) ? 'specifics.upc' : /^\d{13}$/.test(raw) ? 'specifics.ean' : /^97[89]\d{10}$/.test(raw) ? 'specifics.isbn' : 'specifics.barcode';
    results.push(proposal(field, raw, 0.99, 'barcode', raw, mediaId));
  }
  return results;
}

export function extractInventoryFields(input: ScanInput): FieldProposal[] {
  const raw = clean(input.ocrText ?? '');
  const lower = raw.toLowerCase();
  const mediaId = input.sourceMediaId ?? null;
  const results: FieldProposal[] = [...extractBarcode(input.barcodes ?? [], mediaId)];
  const category = inferInventoryCategory(raw);
  results.push(proposal('category', category.category, category.confidence, 'combined', raw || null, mediaId));
  results.push(proposal('subcategory', category.subcategory, category.confidence, 'combined', raw || null, mediaId));

  const brands = ['DeWalt', 'Milwaukee', 'Makita', 'Nike', 'Adidas', 'Jordan', 'Apple', 'Lenovo', 'Sony', 'Nintendo', 'Microsoft', 'Panasonic', 'Samsung'];
  const brand = brands.find(value => lower.includes(value.toLowerCase()));
  if (brand) results.push(proposal('brand', brand, 0.97, 'ocr', raw, mediaId));

  const modelPatterns = [/(?:model|model no\.?|m\/n)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{2,})/i, /\b(DCF\d{3}[A-Z0-9-]*)\b/i, /\b(M[0-9][A-Z0-9]{3,})\b/i];
  for (const pattern of modelPatterns) { const match = raw.match(pattern); if (match) { results.push(proposal('model', match[1], 0.94, 'ocr', match[0], mediaId)); break; } }
  const serial = raw.match(/(?:serial(?: number| no\.?)?|s\/n)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i);
  if (serial) results.push(proposal('serialNumber', serial[1], 0.96, 'ocr', serial[0], mediaId));
  const sku = raw.match(/(?:sku|part(?: number| no\.?)?|p\/n)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{2,})/i);
  if (sku) results.push(proposal('sku', sku[1], 0.94, 'ocr', sku[0], mediaId));
  const year = raw.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  if (year) results.push(proposal('year', year[1], 0.82, 'ocr', year[0], mediaId));
  const size = raw.match(/(?:size|sz)\s*[:#-]?\s*(\d{1,2}(?:\.5)?)/i);
  if (size) results.push(proposal('specifics.size', size[1], 0.9, 'ocr', size[0], mediaId));
  const cardNumber = raw.match(/(?:card|no\.?|#)\s*[:#-]?\s*(\d{1,4}\s*\/\s*\d{1,4}|[A-Z]{1,4}\d{1,4})/i);
  if (cardNumber && category.subcategory === 'trading cards') results.push(proposal('specifics.cardNumber', cardNumber[1].replace(/\s/g, ''), 0.9, 'ocr', cardNumber[0], mediaId));

  for (const rule of input.learningRules ?? []) {
    if (!rule.enabled) continue;
    if (rule.category && rule.category !== category.category) continue;
    if (rule.brand && brand && rule.brand.toLowerCase() !== brand.toLowerCase()) continue;
    if (new RegExp(rule.pattern, 'i').test(raw)) results.push(proposal(rule.field, rule.value, 0.98, 'user-rule', raw, mediaId));
  }

  const titleParts = [brand, results.find(value => value.field === 'model')?.value, category.subcategory !== 'uncategorized' ? category.subcategory : null].filter(Boolean);
  if (titleParts.length) results.push(proposal('title', titleParts.join(' '), 0.84, 'combined', raw || null, mediaId));
  return results.filter(value => value.value.length > 0);
}

function existingField(existing: Partial<ItemRecord> | undefined, field: InventoryField): unknown {
  if (!existing) return undefined;
  if (field.startsWith('specifics.')) return existing.specifics?.[field.slice(10)];
  return (existing as Record<string, unknown>)[field];
}

export function mergeFieldProposals(proposals: FieldProposal[], existing: Partial<ItemRecord> = {}, verifiedFields: InventoryField[] = []): ScanAnalysis {
  const canonical: Record<string, string | number> = {};
  const suggestions: FieldProposal[] = [];
  const conflicts: FieldProposal[] = [];
  const grouped = new Map<InventoryField, FieldProposal[]>();
  for (const item of proposals) grouped.set(item.field, [...(grouped.get(item.field) ?? []), item]);

  for (const [field, rows] of grouped) {
    const ordered = [...rows].sort((a, b) => b.confidence - a.confidence);
    const top = ordered[0];
    const verified = verifiedFields.includes(field);
    const current = existingField(existing, field);
    const competing = ordered.find(row => row.value.toLowerCase() !== top.value.toLowerCase() && row.confidence >= 0.8);
    if (competing && Math.abs(competing.confidence - top.confidence) < 0.08) { conflicts.push(...ordered.map(row => ({ ...row, state: 'conflict' as const }))); continue; }
    if (verified && current != null && String(current).trim() !== '') { suggestions.push({ ...top, state: 'review' }); continue; }
    if (top.confidence >= 0.8 && (current == null || String(current).trim() === '' || !verified)) canonical[field] = field === 'year' ? Number(top.value) : top.value;
    else suggestions.push({ ...top, state: 'review' });
  }

  const pricingQuery = buildPricingQuery(canonical, existing);
  const storageRoute = suggestStorageRoute(String(canonical.category ?? existing.category ?? 'other'), String(canonical.subcategory ?? existing.subcategory ?? ''));
  return { proposals, canonical, suggestions, conflicts, pricingQuery, storageRoute };
}

export function buildPricingQuery(canonical: Record<string, string | number>, existing: Partial<ItemRecord> = {}): string {
  const values = [canonical.brand ?? existing.brand, canonical.model ?? existing.model, canonical.year ?? existing.year, canonical.edition ?? existing.edition, canonical.title ?? existing.title, canonical['specifics.cardNumber'], canonical['specifics.upc'] ?? canonical['specifics.ean'] ?? canonical['specifics.barcode']];
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => clean(String(value))))].join(' ').slice(0, 180);
}

export function suggestStorageRoute(category: string, subcategory: string): string[] {
  const text = `${category} ${subcategory}`.toLowerCase();
  if (/card|coin|jewelry|watch/.test(text)) return ['Secure storage', category, subcategory || 'Unsorted'];
  if (/tool/.test(text)) return ['Garage', 'Tools', subcategory || 'General tools'];
  if (/clothing|shoe/.test(text)) return ['Closet', category, subcategory || 'Clothing'];
  if (/electronics|computer|game/.test(text)) return ['Electronics storage', category, subcategory || 'Electronics'];
  if (/music|vinyl|record/.test(text)) return ['Media storage', category, subcategory || 'Music'];
  return ['Unassigned', category || 'Other'];
}

export function analyzeScan(input: ScanInput): ScanAnalysis { return mergeFieldProposals(extractInventoryFields(input), input.existing, input.verifiedFields); }
