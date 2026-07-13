import type { ItemRecord } from '@vault/domain';
import { calculatePricing, type PricingSummary, type SaleComparable } from '@vault/pricing';

export type ProviderId = 'ebay' | 'tcgplayer' | 'pricecharting' | 'discogs' | 'manual';
export type ProviderHealth = 'ready' | 'credentials-required' | 'rate-limited' | 'offline' | 'error';
export type ProviderResult = { provider: ProviderId; health: ProviderHealth; comparables: SaleComparable[]; message?: string };
export interface ComparableProvider {
  id: ProviderId;
  search(query: string, options?: { condition?: string | null; signal?: AbortSignal }): Promise<ProviderResult>;
}

export type ValuationSnapshot = {
  id: string;
  itemId: string;
  capturedAt: string;
  query: string;
  summary: PricingSummary;
  comparables: SaleComparable[];
};

export type ListingDraft = {
  id: string;
  itemId: string;
  marketplace: 'ebay' | 'facebook' | 'mercari' | 'etsy' | 'csv';
  title: string;
  description: string;
  priceMinor: number;
  minimumPriceMinor: number;
  condition: string;
  category: string;
  quantity: number;
  photos: string[];
  itemSpecifics: Record<string, string>;
  shippingProfile: ShippingRecommendation;
  completeness: number;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
};

export type ShippingRecommendation = {
  service: 'USPS Ground Advantage' | 'USPS Priority Mail' | 'UPS Ground' | 'Local pickup';
  handlingDays: number;
  packageType: 'envelope' | 'small-box' | 'medium-box' | 'large-box' | 'freight';
  estimatedWeightOz: number;
  buyerPaysShipping: boolean;
  rationale: string;
};

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
const parsePhotos = (item: ItemRecord): string[] => {
  try { const value = JSON.parse(item.specifics.photos ?? '[]'); return Array.isArray(value) ? value.filter(v => typeof v === 'string') : []; }
  catch { return []; }
};
const clean = (value?: string | null) => value?.trim() ?? '';
const titleParts = (item: ItemRecord) => [item.brand, item.model, item.year, item.edition, item.title].filter(Boolean).map(String);

export function buildValuationQuery(item: ItemRecord): string {
  return [...new Set(titleParts(item).flatMap(part => part.split(/\s+/)).filter(Boolean))].join(' ').slice(0, 180);
}

export async function collectComparables(providers: ComparableProvider[], item: ItemRecord, signal?: AbortSignal): Promise<ProviderResult[]> {
  const query = buildValuationQuery(item);
  return Promise.all(providers.map(async provider => {
    try { return await provider.search(query, { condition: item.condition, signal }); }
    catch (error) { return { provider: provider.id, health: 'error', comparables: [], message: String(error) }; }
  }));
}

export function valueItem(item: ItemRecord, results: ProviderResult[]): ValuationSnapshot {
  const comparables = results.flatMap(result => result.comparables.map(row => ({ ...row, provider: row.provider || result.provider })));
  return {
    id: uid('valuation'), itemId: item.id, capturedAt: nowIso(), query: buildValuationQuery(item),
    summary: calculatePricing(comparables, { query: buildValuationQuery(item), condition: item.condition }), comparables
  };
}

export function recommendShipping(item: ItemRecord): ShippingRecommendation {
  const category = item.category.toLowerCase();
  const text = `${item.title} ${item.subcategory ?? ''}`.toLowerCase();
  if (/furniture|appliance|vehicle|engine|large tool/.test(`${category} ${text}`)) return { service: 'Local pickup', handlingDays: 3, packageType: 'freight', estimatedWeightOz: 800, buyerPaysShipping: true, rationale: 'Oversized or high-weight item; local pickup/freight reduces damage and dimensional charges.' };
  if (/card|coin|stamp|jewelry|watch/.test(`${category} ${text}`)) return { service: 'USPS Ground Advantage', handlingDays: 1, packageType: 'envelope', estimatedWeightOz: 4, buyerPaysShipping: true, rationale: 'Compact collectible suitable for tracked lightweight shipping with protective packaging.' };
  if (/shoe|clothing|comic|book|game/.test(`${category} ${text}`)) return { service: 'USPS Ground Advantage', handlingDays: 2, packageType: 'small-box', estimatedWeightOz: 32, buyerPaysShipping: true, rationale: 'Typical consumer item that fits economical tracked ground service.' };
  if (/tool|electronics|camera|console/.test(`${category} ${text}`)) return { service: 'UPS Ground', handlingDays: 2, packageType: 'medium-box', estimatedWeightOz: 96, buyerPaysShipping: true, rationale: 'Heavier or fragile item benefits from a rigid box and ground carrier handling.' };
  return { service: 'USPS Priority Mail', handlingDays: 2, packageType: 'small-box', estimatedWeightOz: 24, buyerPaysShipping: true, rationale: 'General-purpose tracked shipping recommendation; verify packed weight before listing.' };
}

export function generateListingDescription(item: ItemRecord): string {
  const details = [item.brand && `Brand: ${item.brand}`, item.model && `Model: ${item.model}`, item.year && `Year: ${item.year}`, item.edition && `Edition: ${item.edition}`, `Condition: ${item.condition}`, item.conditionNotes && `Condition notes: ${item.conditionNotes}`, item.serialNumber && `Serial: ${item.serialNumber}`].filter(Boolean);
  const notes = [clean(item.description), clean(item.notes)].filter(Boolean).join('\n\n');
  return [`${item.title}`, '', ...details, notes && '', notes, '', 'Stored and cataloged in Vault Collector Pro. Review all photos and item specifics before purchase.'].filter(value => value !== false && value !== '').join('\n');
}

export function createListingDraft(item: ItemRecord, marketplace: ListingDraft['marketplace'] = 'ebay'): ListingDraft {
  const photos = parsePhotos(item);
  const title = titleParts(item).join(' ').replace(/\s+/g, ' ').slice(0, marketplace === 'ebay' ? 80 : 120);
  const priceMinor = item.suggestedPrice?.amountMinor ?? item.medianValue?.amountMinor ?? 0;
  const minimumPriceMinor = item.minimumPrice?.amountMinor ?? Math.round(priceMinor * 0.82);
  const specifics = Object.fromEntries(Object.entries(item.specifics).filter(([key, value]) => !['photos', 'photoMetadata'].includes(key) && value));
  const missingFields = [!title && 'title', !item.category && 'category', !item.condition && 'condition', !priceMinor && 'price', photos.length === 0 && 'photos', !item.description && 'description'].filter(Boolean) as string[];
  const completeness = Math.max(0, Math.round((1 - missingFields.length / 6) * 100));
  const timestamp = nowIso();
  return { id: uid('listing'), itemId: item.id, marketplace, title, description: generateListingDescription(item), priceMinor, minimumPriceMinor, condition: item.condition, category: item.category, quantity: item.quantity, photos, itemSpecifics: specifics, shippingProfile: recommendShipping(item), completeness, missingFields, createdAt: timestamp, updatedAt: timestamp };
}

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export function exportListingsCsv(drafts: ListingDraft[]): string {
  const headers = ['marketplace', 'sku', 'title', 'description', 'price', 'minimumPrice', 'condition', 'category', 'quantity', 'shippingService', 'handlingDays', 'photoUrls', 'completeness'];
  const rows = drafts.map(draft => [draft.marketplace, draft.itemId, draft.title, draft.description, (draft.priceMinor / 100).toFixed(2), (draft.minimumPriceMinor / 100).toFixed(2), draft.condition, draft.category, draft.quantity, draft.shippingProfile.service, draft.shippingProfile.handlingDays, draft.photos.join('|'), draft.completeness]);
  return [headers.map(csvEscape).join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\n');
}

export function trendPercent(history: ValuationSnapshot[]): number | null {
  const ordered = [...history].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (ordered.length < 2) return null;
  const first = ordered[0].summary.weightedMedianMinor || ordered[0].summary.medianMinor;
  const last = ordered.at(-1)!.summary.weightedMedianMinor || ordered.at(-1)!.summary.medianMinor;
  return first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : null;
}

export class ManualComparableProvider implements ComparableProvider {
  id: ProviderId = 'manual';
  constructor(private readonly rows: SaleComparable[]) {}
  async search(query: string): Promise<ProviderResult> {
    return { provider: this.id, health: 'ready', comparables: this.rows.map(row => ({ ...row, provider: row.provider || 'manual', matchScore: row.matchScore })) , message: `Loaded ${this.rows.length} manually entered comparables for ${query}.` };
  }
}
