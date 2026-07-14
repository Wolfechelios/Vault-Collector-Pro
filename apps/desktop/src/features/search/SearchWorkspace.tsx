import React from 'react';
import type { ItemRecord } from '@vault/domain';
import type { ParsedSearchQuery, SearchFilters } from '@vault/search';
import type { SavedSearchRecord, SearchHistoryRecord } from '../../lib/catalogueApi';

export type SearchView = 'cards' | 'table' | 'closet';
type Props = {
  query: string;
  parsed: ParsedSearchQuery;
  results: ItemRecord[];
  view: SearchView;
  saved: SavedSearchRecord[];
  history: SearchHistoryRecord[];
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSave: () => void;
  onViewChange: (view: SearchView) => void;
  onSmartCollection: (name: string, filters: SearchFilters) => void;
};

const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const photo = (item: ItemRecord) => { try { return (JSON.parse(item.specifics.photos ?? '[]') as string[])[0]; } catch { return undefined; } };
const operator = (value?: { operator: string; value: number }) => value ? `${({ lt: '<', lte: '≤', eq: '=', gte: '≥', gt: '>' } as Record<string, string>)[value.operator]} ${value.value}` : '';

export function SearchWorkspace(props: Props) {
  const chips = Object.entries(props.parsed.filters).filter(([, value]) => value != null && value !== false).map(([key, value]) => {
    if (key === 'valueMinor' && typeof value === 'object') {
      const sign = ({ lt: '<', lte: '≤', eq: '=', gte: '≥', gt: '>' } as Record<string, string>)[value.operator];
      return `value: ${sign} ${money(value.value)}`;
    }
    if ((key === 'year' || key === 'quantity') && typeof value === 'object') return `${key}: ${operator(value)}`;
    return `${key}: ${String(value)}`;
  });
  const smart: Array<[string, string, SearchFilters]> = [
    ['unpriced', 'Unpriced', { unpriced: true }],
    ['unassigned', 'Unassigned', { unassigned: true }],
    ['duplicate', 'Duplicates', { duplicate: true }],
    ['missing-photo', 'Missing photos', { missingPhotos: true }],
    ['review-needed', 'Review needed', { reviewNeeded: true }]
  ];
  return <section className="search-workspace">
    <div className="command-search"><span>⌘K</span><input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.onSearch()} placeholder="Search naturally: coins before 1900 worth over $500"/><button className="primary" onClick={props.onSearch}>Search</button><button className="secondary" onClick={props.onSave}>Save</button></div>
    <div className="smart-collections">{smart.map(([id, label, filters]) => <button key={id} onClick={() => props.onSmartCollection(id, filters)}>{label}</button>)}</div>
    <div className="parsed-query"><strong>Deterministic filters</strong>{chips.length ? chips.map((chip) => <span key={chip}>{chip}</span>) : <small>Free-text search only</small>}</div>
    <div className="search-layout"><aside><h4>Saved searches</h4>{props.saved.map((row) => <button key={row.id} onClick={() => props.onQueryChange(row.queryText)}>{row.name}</button>)}<h4>Recent searches</h4>{props.history.map((row) => <button key={row.id} onClick={() => props.onQueryChange(row.queryText)}>{row.queryText}<small>{row.resultCount} results</small></button>)}</aside><div className="search-results"><div className="result-head"><b>{props.results.length} results</b><div className="view-switch"><button onClick={() => props.onViewChange('cards')}>Cards</button><button onClick={() => props.onViewChange('table')}>Table</button><button onClick={() => props.onViewChange('closet')}>Messy closet</button></div></div>
      {props.view === 'table' ? <table><thead><tr><th>Item</th><th>Category</th><th>Year</th><th>Condition</th><th>Value</th><th>Location</th></tr></thead><tbody>{props.results.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.category}</td><td>{item.year ?? '—'}</td><td>{item.condition}</td><td>{item.medianValue ? money(item.medianValue.amountMinor) : '—'}</td><td>{item.specifics.storagePath || '—'}</td></tr>)}</tbody></table> : <div className={props.view === 'closet' ? 'closet-view' : 'search-card-grid'}>{props.results.map((item, index) => <article key={item.id} style={props.view === 'closet' ? { transform: `rotate(${(index % 5) - 2}deg) translateY(${(index % 3) * -5}px)` } : undefined}>{photo(item) ? <img src={photo(item)} alt=""/> : <div className="photo-placeholder">{item.category[0]?.toUpperCase()}</div>}<small>{item.category}</small><h4>{item.title}</h4><p>{item.specifics.storagePath || 'Unassigned'}</p><b>{item.medianValue ? money(item.medianValue.amountMinor) : 'Unpriced'}</b></article>)}</div>}
    </div></div>
  </section>;
}
