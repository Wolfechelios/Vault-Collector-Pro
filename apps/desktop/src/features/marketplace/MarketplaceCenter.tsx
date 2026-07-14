import React from 'react';
import type { ItemRecord } from '@vault/domain';
import { createListingDraft, exportListingsCsv, trendPercent, valueItem, type ListingDraft, type ProviderResult, type ValuationSnapshot } from '@vault/marketplace';
import type { SaleComparable } from '@vault/pricing';

const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const storeKey = (name: string) => `vault-marketplace-${name}`;
const readJson = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const download = (name: string, data: string, type = 'application/json') => { const url = URL.createObjectURL(new Blob([data], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };

export function MarketplaceCenter({ items }: { items: ItemRecord[] }) {
  const [itemId, setItemId] = React.useState(items[0]?.id ?? '');
  const [comparables, setComparables] = React.useState<SaleComparable[]>([]);
  const [drafts, setDrafts] = React.useState<ListingDraft[]>(() => readJson(storeKey('drafts'), []));
  const [history, setHistory] = React.useState<ValuationSnapshot[]>(() => readJson(storeKey('history'), []));
  const [provider, setProvider] = React.useState('ebay');
  const [compTitle, setCompTitle] = React.useState('');
  const [compPrice, setCompPrice] = React.useState('');
  const selected = items.find(item => item.id === itemId) ?? items[0];

  React.useEffect(() => { localStorage.setItem(storeKey('drafts'), JSON.stringify(drafts)); }, [drafts]);
  React.useEffect(() => { localStorage.setItem(storeKey('history'), JSON.stringify(history)); }, [history]);
  React.useEffect(() => { if (!itemId && items[0]) setItemId(items[0].id); }, [itemId, items]);

  function addComparable() {
    const amount = Math.round(Number(compPrice) * 100);
    if (!selected || !compTitle.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setComparables(current => [...current, { id: crypto.randomUUID(), provider, title: compTitle.trim(), soldAmountMinor: amount, quantity: 1, soldAt: new Date().toISOString(), condition: selected.condition }]);
    setCompTitle(''); setCompPrice('');
  }

  function createSnapshot() {
    if (!selected || comparables.length === 0) return;
    const result: ProviderResult = { provider: provider as ProviderResult['provider'], health: 'ready', comparables };
    const snapshot = valueItem(selected, [result]);
    setHistory(current => [...current, snapshot]);
  }

  function createDraft() {
    if (!selected) return;
    const next = createListingDraft(selected, 'ebay');
    setDrafts(current => [next, ...current.filter(draft => draft.itemId !== selected.id || draft.marketplace !== 'ebay')]);
  }

  function exportAllCsv() { if (drafts.length) download(`vault-marketplace-${new Date().toISOString().slice(0, 10)}.csv`, exportListingsCsv(drafts), 'text/csv'); }
  const itemHistory = selected ? history.filter(snapshot => snapshot.itemId === selected.id) : [];
  const itemDraft = selected ? drafts.find(draft => draft.itemId === selected.id && draft.marketplace === 'ebay') : undefined;
  const latest = itemHistory.at(-1);
  const trend = trendPercent(itemHistory);

  if (!selected) return <section className="panel center-panel"><h3>Valuation & Marketplace</h3><p>Add inventory before creating valuations or listings.</p></section>;

  return <section className="marketplace-layout">
    <article className="panel marketplace-control">
      <div className="marketplace-head"><div><p className="eyebrow">VALUATION WORKBENCH</p><h3>{selected.title}</h3></div><select value={itemId} onChange={event => { setItemId(event.target.value); setComparables([]); }}>{items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      <div className="valuation-cards"><article><span>Current median</span><strong>{money(latest?.summary.weightedMedianMinor || selected.medianValue?.amountMinor || 0)}</strong></article><article><span>Confidence</span><strong>{latest ? `${Math.round(latest.summary.confidence * 100)}%` : '—'}</strong></article><article><span>Comparables</span><strong>{latest?.summary.sampleCount ?? 0}</strong></article><article><span>Trend</span><strong className={(trend ?? 0) >= 0 ? 'gain' : 'loss'}>{trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}</strong></article></div>
      <h4>Add sold comparable</h4>
      <div className="comparable-entry"><select value={provider} onChange={event => setProvider(event.target.value)}><option value="ebay">eBay</option><option value="tcgplayer">TCGplayer</option><option value="pricecharting">PriceCharting</option><option value="discogs">Discogs</option><option value="manual">Manual</option></select><input value={compTitle} onChange={event => setCompTitle(event.target.value)} placeholder="Sold listing title"/><input value={compPrice} onChange={event => setCompPrice(event.target.value)} inputMode="decimal" placeholder="Sold price"/><button className="primary" onClick={addComparable}>Add</button></div>
      <div className="comparables-list">{comparables.map(row => <div key={row.id}><span>{row.provider}</span><b>{row.title}</b><strong>{money(row.soldAmountMinor + (row.shippingMinor ?? 0))}</strong><button onClick={() => setComparables(current => current.filter(value => value.id !== row.id))}>×</button></div>)}{comparables.length === 0 && <p className="empty-note">Add sold listings manually now; official provider adapters activate after credentials are configured.</p>}</div>
      <div className="marketplace-actions"><button className="primary" onClick={createSnapshot} disabled={comparables.length === 0}>Calculate and save valuation</button><button className="secondary" onClick={() => setComparables([])}>Clear comparables</button></div>
    </article>

    <article className="panel listing-workbench">
      <div className="marketplace-head"><div><p className="eyebrow">MARKETPLACE DRAFT</p><h3>eBay-style listing</h3></div><button className="primary" onClick={createDraft}>Generate draft</button></div>
      {itemDraft ? <><div className="listing-score"><div><span>Completeness</span><strong>{itemDraft.completeness}%</strong></div><progress max={100} value={itemDraft.completeness}/></div><label>Title<input value={itemDraft.title} onChange={event => setDrafts(current => current.map(draft => draft.id === itemDraft.id ? { ...draft, title: event.target.value, updatedAt: new Date().toISOString() } : draft))}/></label><label>Description<textarea rows={10} value={itemDraft.description} onChange={event => setDrafts(current => current.map(draft => draft.id === itemDraft.id ? { ...draft, description: event.target.value, updatedAt: new Date().toISOString() } : draft))}/></label><div className="listing-grid"><label>Price<input value={(itemDraft.priceMinor / 100).toFixed(2)} onChange={event => setDrafts(current => current.map(draft => draft.id === itemDraft.id ? { ...draft, priceMinor: Math.round(Number(event.target.value) * 100), updatedAt: new Date().toISOString() } : draft))}/></label><label>Minimum<input value={(itemDraft.minimumPriceMinor / 100).toFixed(2)} onChange={event => setDrafts(current => current.map(draft => draft.id === itemDraft.id ? { ...draft, minimumPriceMinor: Math.round(Number(event.target.value) * 100), updatedAt: new Date().toISOString() } : draft))}/></label></div><div className="shipping-card"><span>{itemDraft.shippingProfile.service}</span><b>{itemDraft.shippingProfile.packageType} · {itemDraft.shippingProfile.estimatedWeightOz} oz · {itemDraft.shippingProfile.handlingDays} day handling</b><p>{itemDraft.shippingProfile.rationale}</p></div>{itemDraft.missingFields.length > 0 && <div className="banner error">Missing before listing: {itemDraft.missingFields.join(', ')}</div>}<div className="marketplace-actions"><button className="secondary" onClick={() => download(`vault-listing-${selected.id}.json`, JSON.stringify(itemDraft, null, 2))}>Export JSON</button><button className="secondary" onClick={exportAllCsv}>Export all CSV</button></div></> : <p className="empty-note">Generate a listing draft from the selected inventory record. User edits are preserved in local storage.</p>}
    </article>
  </section>;
}
