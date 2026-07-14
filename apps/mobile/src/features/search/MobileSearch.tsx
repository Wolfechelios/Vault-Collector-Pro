import React from 'react';
import { parseSearchQuery } from '@vault/search';

type Item = Record<string, any>;
const textOf = (item: Item) => [item.title,item.description,item.notes,item.brand,item.model,item.sku,item.serialNumber,item.category,item.condition,Object.values(item.specifics??{}).join(' ')].filter(Boolean).join(' ').toLowerCase();

export function searchLocalItems(items: Item[], query: string): Item[] {
  const parsed = parseSearchQuery(query);
  const terms = parsed.text.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const text = textOf(item);
    if (!terms.every(term => text.includes(term))) return false;
    const filters = parsed.filters;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.location && !String(item.specifics?.storagePath??'').toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.missingPhotos && JSON.parse(item.specifics?.photos??'[]').length) return false;
    if (filters.year && !compare(Number(item.year), filters.year.operator, filters.year.value)) return false;
    if (filters.valueMinor && !compare(Number(item.medianValue?.amountMinor??0), filters.valueMinor.operator, filters.valueMinor.value)) return false;
    if (filters.listed != null && (item.status === 'listed') !== filters.listed) return false;
    return true;
  });
}
function compare(left:number, operator:string, right:number) { return operator==='lt'?left<right:operator==='lte'?left<=right:operator==='gt'?left>right:operator==='gte'?left>=right:left===right; }
export function smartCollections(items: Item[], suggestions: Item[]) {
  return {
    unpriced: items.filter(item => !item.medianValue),
    unassigned: items.filter(item => !item.specifics?.storagePath),
    duplicate: items.filter(item => item.specifics?.duplicate === 'true'),
    missingPhoto: items.filter(item => { try { return JSON.parse(item.specifics?.photos??'[]').length===0; } catch { return true; } }),
    reviewNeeded: items.filter(item => suggestions.some(row => row.itemId===item.id && (row.status==='pending'||row.verificationState==='flagged')))
  };
}

export function MobileSearch({ items, onSave }: { items: Item[]; onSave:(query:string)=>void }) {
  const [query,setQuery]=React.useState(''); const results=searchLocalItems(items,query);
  return <section><p className="eyebrow">OFFLINE SEARCH</p><h2>Find anything</h2><div className="searchbox"><input aria-label="Natural-language search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="yellow DeWalt drill"/><button onClick={()=>onSave(query)}>Save</button></div><p>{results.length} result(s)</p><div className="cards">{results.map(item=><article key={item.id}><small>{item.category}</small><h3>{item.title}</h3><p>{item.specifics?.storagePath||'Unassigned'}</p></article>)}</div></section>;
}

export function MobileCollections({items,suggestions}:{items:Item[];suggestions:Item[]}) { const groups=smartCollections(items,suggestions); return <section><p className="eyebrow">SMART COLLECTIONS</p><h2>Collection health</h2><div className="collection-grid">{Object.entries(groups).map(([name,rows])=><article key={name}><b>{rows.length}</b><span>{name.replace(/([A-Z])/g,' $1')}</span></article>)}</div></section>; }
