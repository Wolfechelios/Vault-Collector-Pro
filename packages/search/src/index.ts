export type ComparisonOperator = 'lt' | 'lte' | 'eq' | 'gte' | 'gt';
export type NumericComparison = { operator: ComparisonOperator; value: number };

export type SearchFilters = {
  category?: string;
  color?: string;
  brand?: string;
  model?: string;
  year?: NumericComparison;
  valueMinor?: NumericComparison;
  quantity?: NumericComparison;
  status?: string;
  condition?: string;
  location?: string;
  gradingCompany?: string;
  grade?: string;
  listed?: boolean;
  missingPhotos?: boolean;
  unpriced?: boolean;
  unassigned?: boolean;
  duplicate?: boolean;
  reviewNeeded?: boolean;
};

export type ParsedSearchQuery = {
  original: string;
  text: string;
  ftsQuery: string;
  filters: SearchFilters;
};

const categories: Array<[RegExp, string]> = [
  [/\bcoins?\b/i, 'coins'],
  [/\bcards?\b/i, 'cards'],
  [/\b(comics?|comic books?)\b/i, 'comics'],
  [/\b(electronics?|computers?|laptops?|phones?)\b/i, 'electronics'],
  [/\b(shoes?|sneakers?)\b/i, 'shoes'],
  [/\bclothing\b/i, 'clothing'],
  [/\bjewelry\b/i, 'jewelry'],
  [/\btools?\b/i, 'tools']
];
const toolClues = /\b(drill|driver|saw|grinder|impact|wrench)\b/i;
const colors = ['yellow', 'red', 'blue', 'green', 'black', 'white', 'silver', 'gold', 'orange', 'purple', 'brown', 'gray', 'grey'];
const brands = ['DeWalt', 'Milwaukee', 'Makita', 'Bosch', 'Ryobi', 'Craftsman', 'Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'Jordan'];

function consume(source: string, expression: RegExp): string {
  return source.replace(expression, ' ');
}

function ftsEscape(text: string): string {
  const value = text.trim().replace(/"/g, '""');
  if (!value) return '';
  return value.includes(' ') ? `"${value}"` : value;
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const filters: SearchFilters = {};
  let working = input.trim();
  const quoted: string[] = [];
  working = working.replace(/"([^"]+)"/g, (_match, value: string) => {
    quoted.push(value.trim());
    return ' ';
  });

  const location = working.match(/\b(?:everything|items?)\s+in\s+(.+)$/i);
  if (location) {
    filters.location = location[1].trim();
    working = consume(working, location[0] ? new RegExp(location[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : /$^/);
  }

  if (/\b(?:items?\s+)?missing\s+photos?\b/i.test(working)) {
    filters.missingPhotos = true;
    working = consume(working, /\b(?:items?\s+)?missing\s+photos?\b/ig);
  }
  if (/\bnot\s+listed\b/i.test(working)) {
    filters.listed = false;
    working = consume(working, /\bnot\s+listed\b/ig);
  } else if (/\blisted\b/i.test(working)) {
    filters.listed = true;
    working = consume(working, /\blisted\b/ig);
  }

  const year = working.match(/\b(before|after|in)\s+((?:18|19|20)\d{2})\b/i);
  if (year) {
    filters.year = { operator: year[1].toLowerCase() === 'before' ? 'lt' : year[1].toLowerCase() === 'after' ? 'gt' : 'eq', value: Number(year[2]) };
    working = consume(working, year[0] ? new RegExp(year[0], 'i') : /$^/);
  }

  const value = working.match(/\b(?:worth|value|valued)\s*(over|under|at least|at most)\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
  if (value) {
    const operators: Record<string, ComparisonOperator> = { over: 'gt', under: 'lt', 'at least': 'gte', 'at most': 'lte' };
    filters.valueMinor = { operator: operators[value[1].toLowerCase()], value: Math.round(Number(value[2].replace(/,/g, '')) * 100) };
    working = consume(working, value[0] ? new RegExp(value[0].replace('$', '\\$'), 'i') : /$^/);
  }

  const quantity = working.match(/\bquantity\s*(over|under|at least|at most|equals?|=)\s*(\d+)\b/i);
  if (quantity) {
    const operators: Record<string, ComparisonOperator> = {
      over: 'gt', under: 'lt', 'at least': 'gte', 'at most': 'lte', equal: 'eq', equals: 'eq', '=': 'eq'
    };
    filters.quantity = { operator: operators[quantity[1].toLowerCase()], value: Number(quantity[2]) };
    working = consume(working, new RegExp(quantity[0], 'i'));
  }

  const status = working.match(/\bstatus\s+(private|draft|listed|sold|archived)\b/i);
  if (status) {
    filters.status = status[1].toLowerCase();
    working = consume(working, new RegExp(status[0], 'i'));
  }

  const condition = working.match(/\bcondition\s+([a-z][a-z -]*?)(?=\s+(?:status|quantity|before|after|worth|value)\b|$)/i);
  if (condition) {
    filters.condition = condition[1].trim().toLowerCase();
    working = consume(working, new RegExp(condition[0], 'i'));
  }

  const grade = working.match(/\b(PSA|BGS|CGC|SGC)\s+(\d+(?:\.\d+)?)\b/i);
  if (grade) {
    filters.gradingCompany = grade[1].toUpperCase();
    filters.grade = grade[2];
    working = consume(working, new RegExp(grade[0], 'i'));
  }

  for (const [expression, category] of categories) {
    if (expression.test(working)) {
      filters.category = category;
      working = consume(working, new RegExp(expression.source, 'ig'));
      break;
    }
  }
  if (!filters.category && toolClues.test(working)) filters.category = 'tools';

  for (const color of colors) {
    const expression = new RegExp(`\\b${color}\\b`, 'i');
    if (expression.test(working)) {
      filters.color = color === 'grey' ? 'gray' : color;
      working = consume(working, expression);
      break;
    }
  }
  for (const brand of brands) {
    const expression = new RegExp(`\\b${brand}\\b`, 'i');
    if (expression.test(working)) {
      filters.brand = brand;
      working = consume(working, expression);
      break;
    }
  }

  const unquoted = working
    .replace(/\b(items?|everything)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const text = [...quoted, unquoted].filter(Boolean).join(' ').trim();
  return { original: input, text, ftsQuery: ftsEscape(text), filters };
}

export const smartCollections: Record<string, SearchFilters> = {
  unpriced: { unpriced: true },
  unassigned: { unassigned: true },
  duplicate: { duplicate: true },
  'missing-photo': { missingPhotos: true },
  'review-needed': { reviewNeeded: true }
};
