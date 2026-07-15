import {parseVisionText} from '@vault/vision';
import type {VisionSignal} from '@vault/vision';
import type {RawRecognition, WebRecognitionResult} from './types';

const categories: Array<[RegExp, string]> = [
  [/drill|saw|tool|hammer|wrench|screwdriver/i, 'tools'],
  [/shoe|sneaker|footwear/i, 'shoes'],
  [/shirt|jacket|dress|clothing/i, 'clothing'],
  [/coin|currency/i, 'coins'],
  [/card|trading card/i, 'cards'],
  [/laptop|phone|camera|television|electronics/i, 'electronics']
];
const brands = ['DeWalt', 'Milwaukee', 'Makita', 'Bosch', 'Ryobi', 'Craftsman', 'Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'Jordan', 'Panini', 'Topps'];

export function buildRecognitionResult(raw: RawRecognition): WebRecognitionResult {
  const labels = raw.labels.filter(row => row.score >= 0.35);
  const joined = labels.map(row => row.label).join(' ');
  const signals: VisionSignal[] = [];
  const category = categories.find(([pattern]) => pattern.test(joined));
  if (category) signals.push({field: 'category', value: category[1], confidence: Math.min(0.82, labels[0]?.score ?? 0.6), source: 'object'});
  const brand = brands.find(value => new RegExp(`\\b${value}\\b`, 'i').test(`${raw.rawText} ${joined}`));
  if (brand) signals.push({field: 'brand', value: brand, confidence: 0.68, source: 'logo'});
  const result = parseVisionText(raw.rawText, raw.barcodes, signals);
  result.engine = 'WolfeVault Web Intelligence';
  result.warnings = [...new Set([...result.warnings, ...raw.warnings])];
  return {...result, readiness: raw.warnings.length ? 'partial' : 'ready'};
}
