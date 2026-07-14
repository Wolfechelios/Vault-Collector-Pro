import type { EvidenceSourceKind, ScanEvidence } from '@vault/domain';

export type VisionField = {
  field: string;
  value: string;
  confidence: number;
  source?: EvidenceSourceKind;
};

export type VisionCandidate = {
  rawText: string;
  fields: VisionField[];
  barcodes: string[];
  engine: string;
  warnings: string[];
};

export type VisionSignal = VisionField & {
  source: Extract<EvidenceSourceKind, 'logo' | 'object' | 'metadata'>;
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const first = (text: string, expression: RegExp) => clean(text.match(expression)?.[1] ?? '');
const normalizeEvidenceValue = (value: string) => clean(value).toLocaleUpperCase();

function push(
  rows: VisionField[],
  field: string,
  value: string,
  confidence: number,
  source: EvidenceSourceKind = 'ocr'
) {
  const cleaned = clean(value);
  if (cleaned && !rows.some((row) => row.field === field && row.value === cleaned)) {
    rows.push({ field, value: cleaned, confidence, source });
  }
}

export function normalizeBarcode(value: string) {
  return value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function inferBrand(text: string): string {
  const labelled = first(text, /(?:^|\n)\s*(?:BRAND|MANUFACTURER|MADE BY)\s*[:#-]?\s*([^\n]+)/im);
  if (labelled) return labelled;
  const brands = [
    'DeWalt', 'Milwaukee', 'Makita', 'Bosch', 'Ryobi', 'Craftsman',
    'Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'Jordan', 'Panini',
    'Topps', 'Pokemon', 'Yu-Gi-Oh'
  ];
  return brands.find((brand) => new RegExp(`\\b${brand.replace('-', '[- ]?')}\\b`, 'i').test(text)) ?? '';
}

function inferCategory(text: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\b(drill|driver|saw|grinder|impact|tool|m18|m12|20v)\b/i, 'tools'],
    [/\b(pokemon|yu-gi-oh|magic|topps|panini|psa|bgs|card)\b/i, 'cards'],
    [/\b(coin|denomination|mint mark|silver dollar|cent)\b/i, 'coins'],
    [/\b(iphone|ipad|macbook|camera|television|laptop|model no)\b/i, 'electronics'],
    [/\b(shoe|sneaker|jordan|size\s*\d)\b/i, 'shoes'],
    [/\b(shirt|jacket|pants|dress|garment)\b/i, 'clothing'],
    [/\b(sterling|karat|14k|18k|necklace|ring|bracelet)\b/i, 'jewelry']
  ];
  return rules.find(([expression]) => expression.test(text))?.[1] ?? '';
}

export function parseVisionText(
  rawText: string,
  barcodes: string[] = [],
  signals: VisionSignal[] = []
): VisionCandidate {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map(clean).filter(Boolean);
  const fields: VisionField[] = [];
  const warnings: string[] = [];
  const normalizedBarcodes = barcodes.map(normalizeBarcode).filter(Boolean);

  const year = first(text, /\b((?:18|19|20)\d{2})\b/);
  const isbn = first(text, /\b(?:ISBN(?:-1[03])?[: ]*)?((?:97[89][ -]?)?\d[\d -]{8,16}[\dX])\b/i).replace(/[ -]/g, '');
  const vin = first(text, /\b([A-HJ-NPR-Z0-9]{17})\b/i).toUpperCase();
  const serial = first(text, /(?:^|\n)\s*(?:S\/?N|SERIAL(?: NUMBER)?|SN)\s*[:#-]?\s*([A-Z0-9-]{4,32})/im);
  const model = first(text, /(?:^|\n)\s*(?:MODEL(?:\s+(?:NO|NUMBER))?|MOD\.?|M\/?N)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{1,31})/im);
  const card = first(text, /\b(?:#|NO\.?\s*)([A-Z0-9-]{1,16})\b/i);
  const size = first(text, /(?:^|\n)\s*(?:SIZE|SZ)\s*[:#-]?\s*([^\n]{1,24})/im);
  const edition = first(text, /(?:^|\n)\s*(?:EDITION|VERSION|VARIANT)\s*[:#-]?\s*([^\n]{1,64})/im);
  const color = first(text, /(?:^|\n)\s*(?:COLOR|COLOUR)\s*[:#-]?\s*([^\n]{1,48})/im);
  const material = first(text, /(?:^|\n)\s*(?:MATERIAL|FABRIC|METAL)\s*[:#-]?\s*([^\n]{1,64})/im);
  const condition = first(text, /(?:^|\n)\s*(?:CONDITION|GRADE)\s*[:#-]?\s*([^\n]{1,64})/im);
  const brand = inferBrand(text);
  const category = inferCategory(text);
  const upc = normalizedBarcodes.find((value) => /^\d{12}$/.test(value));
  const ean = normalizedBarcodes.find((value) => /^\d{13}$/.test(value));

  if (lines[0]) push(fields, 'title', lines.slice(0, 2).join(' — ').slice(0, 120), 0.66);
  push(fields, 'brand', brand, 0.86);
  push(fields, 'category', category, 0.78);
  push(fields, 'year', year, 0.92);
  push(fields, 'isbn', isbn, [10, 13].includes(isbn.length) ? 0.98 : 0);
  push(fields, 'vin', vin, 0.99);
  push(fields, 'serialNumber', serial, 0.93);
  push(fields, 'model', model, 0.9);
  push(fields, 'cardNumber', card, 0.84);
  push(fields, 'edition', edition, 0.86);
  push(fields, 'size', size, 0.82);
  push(fields, 'color', color, 0.84);
  push(fields, 'material', material, 0.82);
  push(fields, 'condition', condition, 0.76);
  push(fields, 'upc', upc ?? '', 0.99, 'barcode');
  push(fields, 'ean', ean ?? '', 0.99, 'barcode');
  for (const signal of signals) {
    push(fields, signal.field, signal.value, signal.confidence, signal.source);
  }

  if (vin && vin.length !== 17) warnings.push('VIN candidate is not 17 characters');
  if (isbn && ![10, 13].includes(isbn.length)) warnings.push('ISBN candidate failed length validation');
  if (lines.length > 0 && fields.length === 1) {
    warnings.push('OCR text found, but identifiers need manual review');
  }

  return {
    rawText: text,
    fields,
    barcodes: normalizedBarcodes,
    engine: 'Vault Vision parser',
    warnings
  };
}

export function visionCandidateToEvidence(
  candidate: VisionCandidate,
  scanId: string,
  sourceMediaId: string | null,
  createdAt = new Date().toISOString()
): ScanEvidence[] {
  return candidate.fields.map((field, index) => ({
    id: `${scanId}:${sourceMediaId ?? 'none'}:${field.field}:${index}`,
    scanId,
    field: field.field,
    value: field.value,
    normalizedValue: normalizeEvidenceValue(field.value),
    confidence: field.confidence,
    sourceKind: field.source ?? 'ocr',
    sourceMediaId,
    rawText: candidate.rawText || null,
    bounds: null,
    provider: candidate.engine,
    createdAt
  }));
}

export function mergeVisionCandidates(candidates: VisionCandidate[]): VisionCandidate {
  const scored = new Map<string, VisionField>();
  for (const candidate of candidates) {
    for (const field of candidate.fields) {
      const prior = scored.get(field.field);
      if (!prior || field.confidence > prior.confidence) scored.set(field.field, field);
    }
  }
  return {
    rawText: candidates.map((candidate) => candidate.rawText).filter(Boolean).join('\n---\n'),
    fields: [...scored.values()],
    barcodes: [...new Set(candidates.flatMap((candidate) => candidate.barcodes))],
    engine: [...new Set(candidates.map((candidate) => candidate.engine))].join(' + '),
    warnings: [...new Set(candidates.flatMap((candidate) => candidate.warnings))]
  };
}

export function listingTitle(fields: Record<string, string>, fallback = 'Untitled item') {
  return clean([
    fields.brand,
    fields.model,
    fields.name || fields.title,
    fields.year,
    fields.edition,
    fields.cardNumber && `#${fields.cardNumber}`,
    fields.size && `Size ${fields.size}`
  ].filter(Boolean).join(' ')).slice(0, 80) || fallback;
}
