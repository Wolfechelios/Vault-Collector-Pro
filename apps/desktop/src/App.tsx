import React from 'react';
import type { ItemRecord } from '@vault/domain';
import type { OfflineCapture } from '@vault/capture';
import { buildStorageTree } from '@vault/storage';
import { createBackup, verifyBackup, type VaultBackup } from '@vault/backup';
import { mapImportRow, parseCsv } from '@vault/importer';
import type { AppSection, ViewMode } from '@vault/ui';
import { catalogueApi, type ItemDraft } from './lib/catalogueApi';
import { ItemEditor } from './features/items/ItemEditor';
import type { PendingIntelligenceAnalysis } from './features/vision/VisionPanel';
import { CaptureCenter } from './features/capture/CaptureCenter';
import { MarketplaceCenter } from './features/marketplace/MarketplaceCenter';
import { parseSearchQuery, type ParsedSearchQuery, type SearchFilters } from '@vault/search';
import { ScanReview } from './features/intelligence/ScanReview';
import { MobileExchange } from './features/intelligence/MobileExchange';
import { E2eProbe } from './features/intelligence/E2eProbe';
import { LearningRulesManager } from './features/learning/LearningRulesManager';
import { CategorySchemaManager } from './features/categories/CategorySchemaManager';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';
import { SearchWorkspace, type SearchView } from './features/search/SearchWorkspace';
import type { EvidenceRecord, ReviewSuggestion, RuleRecord, SavedSearchRecord, SearchHistoryRecord } from './lib/catalogueApi';

const money = (minor?: number) => minor == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const parseList = (item: ItemRecord, key: string) => { try { const parsed = JSON.parse(item.specifics[key] ?? '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
function download(name: string, data: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

export default function App() {
  const [items, setItems] = React.useState<ItemRecord[]>([]);
  const [section, setSection] = React.useState<AppSection>('dashboard');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const [category, setCategory] = React.useState('all');
  const [view, setView] = React.useState<ViewMode>('cards');
  const [editing, setEditing] = React.useState<ItemRecord | null | undefined>(undefined);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = React.useState<ReviewSuggestion[]>([]);
  const [evidence, setEvidence] = React.useState<EvidenceRecord[]>([]);
  const [rules, setRules] = React.useState<RuleRecord[]>([]);
  const [schemas, setSchemas] = React.useState<CategorySchemaRecord[]>([]);
  const [searchResults, setSearchResults] = React.useState<ItemRecord[]>([]);
  const [activeParsed, setActiveParsed] = React.useState<ParsedSearchQuery>(() => parseSearchQuery(''));
  const [searchView, setSearchView] = React.useState<SearchView>('cards');
  const [savedSearches, setSavedSearches] = React.useState<SavedSearchRecord[]>([]);
  const [searchHistory, setSearchHistory] = React.useState<SearchHistoryRecord[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const data = await catalogueApi.search({ query, category: category === 'all' ? null : category, status: status === 'active' ? null : status, limit: 2000, offset: 0 });
      setItems(status === 'active' ? data.filter(item => item.status !== 'archived') : data);
    } catch (e) { setError(String(e)); }
  }, [query, status, category]);
  React.useEffect(() => { const timer = setTimeout(load, 100); return () => clearTimeout(timer); }, [load]);

  const loadIntelligence = React.useCallback(async () => {
    try {
      const [queue, ruleRows, saved, history, schemaRows] = await Promise.all([
        catalogueApi.reviewQueue(), catalogueApi.learningRules(),
        catalogueApi.savedSearches(), catalogueApi.searchHistory(), catalogueApi.categorySchemas()
      ]);
      const itemIds = [...new Set(queue.map((row) => row.itemId))];
      const sourceRows = await Promise.all(itemIds.map((itemId) => catalogueApi.evidence(itemId)));
      setReviewQueue(queue); setRules(ruleRows); setSavedSearches(saved); setSearchHistory(history); setSchemas(schemaRows); setEvidence(sourceRows.flat());
    } catch (nextError) { setError(String(nextError)); }
  }, []);
  React.useEffect(() => { if (['review', 'learning', 'search'].includes(section)) void loadIntelligence(); }, [section, loadIntelligence]);
  React.useEffect(() => { void catalogueApi.categorySchemas().then(setSchemas).catch(nextError => setError(String(nextError))); }, []);

  async function runParsedSearch(parsed: ParsedSearchQuery) {
    try { setError(null); setActiveParsed(parsed); setSearchResults(await catalogueApi.intelligentSearch(parsed)); setSection('search'); await loadIntelligence(); }
    catch (nextError) { setError(String(nextError)); }
  }
  async function runSearch() { await runParsedSearch(parseSearchQuery(query)); }
  async function runSmartCollection(name: string, filters: SearchFilters) {
    const parsed: ParsedSearchQuery = { original: name, text: '', ftsQuery: '', filters };
    setQuery(name); await runParsedSearch(parsed);
  }
  async function decideSuggestion(id: string, decision: { action: 'accept' | 'edit' | 'reject'; value?: string }) {
    await catalogueApi.decideSuggestion(id, decision.action, decision.value); await Promise.all([load(), loadIntelligence()]);
  }
  async function toggleRule(rule: RuleRecord) { await catalogueApi.upsertLearningRule({ ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }); await loadIntelligence(); }
  async function updateRule(rule: RuleRecord) { await catalogueApi.upsertLearningRule({ ...rule, updatedAt: new Date().toISOString() }); await loadIntelligence(); }
  async function removeRule(id: string) { await catalogueApi.deleteLearningRule(id); await loadIntelligence(); }
  async function saveSchema(schema: CategorySchemaRecord) { await catalogueApi.upsertCategorySchema(schema); await loadIntelligence(); }
  async function removeSchema(category: string, key: string) { await catalogueApi.deleteCategorySchema(category, key); await loadIntelligence(); }
  async function saveCurrentSearch() {
    const name = query.trim() || `Search ${new Date().toLocaleString()}`;
    await catalogueApi.saveSearch(`saved-${Date.now().toString(36)}`, name, activeParsed); await loadIntelligence();
  }

  async function save(draft: ItemDraft, pendingAnalysis?: PendingIntelligenceAnalysis) {
    setBusy(true);
    try {
      if (editing) {
        await catalogueApi.update(editing.id, draft);
      } else {
        const created = await catalogueApi.create(draft);
        if (pendingAnalysis) {
          await catalogueApi.recordAnalysis(
            pendingAnalysis.evidence.map((row) => ({ ...row, itemId: created.id })),
            pendingAnalysis.suggestions.map((row) => ({ ...row, itemId: created.id }))
          );
        }
      }
      setEditing(undefined);
      await load();
    }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  async function archiveSelected() { for (const id of selected) await catalogueApi.archive(id); setSelected(new Set()); await load(); }
  async function importCapture(capture: OfflineCapture) {
    await catalogueApi.create({
      title: capture.title || 'Phone capture', category: 'other', subcategory: null, status: 'private', condition: 'Unknown', conditionNotes: null,
      description: capture.notes || null, quantity: 1, sku: null, serialNumber: null, brand: null, model: null, year: null, edition: null,
      purchasePrice: null, medianValue: null, suggestedPrice: null, minimumPrice: null, notes: 'Imported from Vault Phone Capture',
      specifics: { photos: JSON.stringify(capture.photos.map(photo => photo.dataUrl)), photoMetadata: JSON.stringify(capture.photos.map(photo => ({ id: photo.id, name: photo.name, width: photo.width, height: photo.height, quality: photo.quality }))), phoneCaptureId: capture.id, capturedAt: capture.createdAt }
    });
    await load();
  }

  const total = items.reduce((sum, item) => sum + (item.medianValue?.amountMinor ?? 0) * item.quantity, 0);
  const purchase = items.reduce((sum, item) => sum + (item.purchasePrice?.amountMinor ?? 0) * item.quantity, 0);
  const categories = [...new Set(items.map(item => item.category))].sort();
  const storage = buildStorageTree(items.map(item => item.specifics.storagePath).filter(Boolean));
  const missingPhotos = items.filter(item => parseList(item, 'photos').length === 0).length;
  const unvalued = items.filter(item => !item.medianValue).length;
  function exportBackup() { download(`vault-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(createBackup(items), null, 2)); }
  async function importFile(file: File) {
    try {
      const text = await file.text(); let rows: any[] = [];
      if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsv(text).map(mapImportRow);
      else { const parsed = JSON.parse(text); if (parsed.format === 'vault-backup' && !verifyBackup(parsed as VaultBackup<ItemRecord>)) throw new Error('Backup checksum failed'); rows = Array.isArray(parsed) ? parsed : parsed.items ?? []; }
      for (const row of rows) await catalogueApi.create({ title: String(row.title ?? row.name ?? 'Imported item'), category: String(row.category ?? 'other'), subcategory: row.subcategory ?? null, status: 'private', condition: String(row.condition ?? 'Unknown'), conditionNotes: row.conditionNotes ?? null, description: row.description ?? null, quantity: Number(row.quantity ?? 1), sku: row.sku ?? null, serialNumber: row.serialNumber ?? null, brand: row.brand ?? null, model: row.model ?? null, year: row.year ? Number(row.year) : null, edition: row.edition ?? null, purchasePrice: row.purchasePrice ?? null, medianValue: row.medianValue ?? null, suggestedPrice: row.suggestedPrice ?? null, minimumPrice: row.minimumPrice ?? null, notes: row.notes ?? null, specifics: row.specifics ?? {} });
      await load(); setSection('inventory');
    } catch (e) { setError(`Import failed: ${String(e)}`); }
  }
  const nav = (id: AppSection, label: string, count?: number) => <button className={section === id ? 'nav-active' : ''} onClick={() => setSection(id)}>{label}{count != null && <b>{count}</b>}</button>;

  return <div className="app-shell">{import.meta.env.VITE_E2E === '1' && <E2eProbe/>}
    <aside className="sidebar"><div className="brand"><div className="mark">V</div><div><h1>Vault</h1><span>Platform 0.7</span></div></div><nav>{nav('dashboard', '◆ Dashboard')}{nav('inventory', '▦ Inventory', items.length)}{nav('capture', '◉ Capture')}{nav('review', '✓ Scan Review', reviewQueue.length)}{nav('learning', '⌁ Learning Rules', rules.length)}{nav('search', '⌕ Smart Search')}{nav('marketplace', '◇ Value & Sell')}{nav('storage', '⌖ Storage', storage.length)}{nav('import', '⇧ Import Center')}{nav('backup', '⇩ Backup Center')}</nav><div className="side-footer">INVENTORY INTELLIGENCE<br/><strong>Private · Local-first</strong></div></aside>
    <main className="content"><header><div><p className="eyebrow">PROFESSIONAL ASSET PLATFORM</p><h2>{section === 'marketplace' ? 'Valuation & Marketplace' : section[0].toUpperCase() + section.slice(1)}</h2><p>Local catalog, evidence-backed intelligence and deterministic offline search.</p></div><div className="header-actions"><div className="global-command"><span>⌘K</span><input value={query} onChange={(event)=>setQuery(event.target.value)} onKeyDown={(event)=>event.key==='Enter'&&runSearch()} placeholder="Search inventory naturally"/><button onClick={runSearch}>Search</button></div><button className="secondary" onClick={exportBackup}>Back up</button><button className="primary" onClick={() => setEditing(null)}>＋ Add item</button></div></header>{error && <div className="banner error">{error}</div>}
      {section === 'dashboard' && <><section className="stats"><article><span>Items</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></article><article><span>Catalog value</span><strong>{money(total)}</strong></article><article><span>Estimated gain</span><strong className={total - purchase >= 0 ? 'gain' : 'loss'}>{money(total - purchase)}</strong></article><article><span>Missing photos</span><strong>{missingPhotos}</strong></article><article><span>Needs pricing</span><strong>{unvalued}</strong></article></section><section className="dashboard-grid"><article className="panel"><h3>Highest value</h3>{[...items].sort((a, b) => (b.medianValue?.amountMinor ?? 0) - (a.medianValue?.amountMinor ?? 0)).slice(0, 7).map(item => <button key={item.id} onClick={() => setEditing(item)}><span>{item.title}</span><b>{money(item.medianValue?.amountMinor)}</b></button>)}</article><article className="panel"><h3>Collection health</h3><div className="health-row"><span>Photographed</span><b>{items.length - missingPhotos}/{items.length}</b></div><div className="health-row"><span>Valued</span><b>{items.length - unvalued}/{items.length}</b></div><div className="health-row"><span>Stored</span><b>{items.filter(item => item.specifics.storagePath).length}/{items.length}</b></div></article></section></>}
      {section === 'capture' && <CaptureCenter onImportCapture={importCapture}/>}
      {section === 'review' && <ScanReview suggestions={reviewQueue} evidence={evidence} itemTitles={Object.fromEntries(items.map((item)=>[item.id,item.title]))} onDecision={decideSuggestion}/>}
      {section === 'learning' && <><LearningRulesManager rules={rules} onToggle={toggleRule} onDelete={removeRule} onUpdate={updateRule}/><CategorySchemaManager schemas={schemas} onSave={saveSchema} onDelete={removeSchema}/></>}
      {section === 'search' && <SearchWorkspace query={query} parsed={activeParsed} results={searchResults} view={searchView} saved={savedSearches} history={searchHistory} onQueryChange={(value)=>{setQuery(value);setActiveParsed(parseSearchQuery(value));}} onSearch={runSearch} onSave={saveCurrentSearch} onViewChange={setSearchView} onSmartCollection={runSmartCollection}/>}
      {section === 'marketplace' && <MarketplaceCenter items={items}/>}
      {section === 'inventory' && <><section className="toolbar"><div className="search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, brand, model, SKU, serial or tags"/></div><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active items</option><option>private</option><option>draft</option><option>listed</option><option>sold</option><option>archived</option></select><div className="view-switch">{(['cards', 'table', 'gallery'] as ViewMode[]).map(v => <button className={view === v ? 'active' : ''} key={v} onClick={() => setView(v)}>{v === 'cards' ? '▦' : v === 'table' ? '☷' : '▥'}</button>)}</div></section>{selected.size > 0 && <div className="selection-bar"><b>{selected.size} selected</b><button onClick={archiveSelected}>Archive selected</button><button onClick={() => setSelected(new Set())}>Clear</button></div>}{view === 'table' ? <div className="table-wrap"><table><thead><tr><th></th><th>Item</th><th>Category</th><th>Location</th><th>Qty</th><th>Value</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><input type="checkbox" checked={selected.has(item.id)} onChange={e => setSelected(current => { const next = new Set(current); e.target.checked ? next.add(item.id) : next.delete(item.id); return next; })}/></td><td><strong>{item.title}</strong><small>{[item.brand, item.model, item.year].filter(Boolean).join(' · ')}</small></td><td>{item.category}</td><td>{item.specifics.storagePath || '—'}</td><td>{item.quantity}</td><td>{money(item.medianValue?.amountMinor)}</td><td><button className="secondary compact" onClick={() => setEditing(item)}>Edit</button></td></tr>)}</tbody></table></div> : <section className={view === 'gallery' ? 'inventory-grid gallery' : 'inventory-grid'}>{items.map(item => { const photos = parseList(item, 'photos'); return <article className="item-card" key={item.id}>{photos[0] ? <img className="card-photo" src={photos[0]}/> : <div className="photo-placeholder">{item.category.slice(0, 1).toUpperCase()}</div>}<div className="item-body"><div className="item-meta"><span>{item.category}</span><input type="checkbox" checked={selected.has(item.id)} onChange={e => setSelected(current => { const next = new Set(current); e.target.checked ? next.add(item.id) : next.delete(item.id); return next; })}/></div><h3>{item.title}</h3>{view !== 'gallery' && <><p>{[item.brand, item.model, item.year].filter(Boolean).join(' · ') || item.condition}</p><div className="location">⌖ {item.specifics.storagePath || 'Unassigned'}</div><div className="item-value"><strong>{money(item.medianValue?.amountMinor)}</strong><button onClick={() => setEditing(item)}>Edit</button></div></>}</div></article>; })}</section>}</>}
      {section === 'storage' && <section className="panel storage-panel"><h3>Digital storage map</h3><p>{storage.length ? `${storage.length} mapped locations` : 'Assign storage paths to items to build the map.'}</p><div className="storage-tree">{storage.map(node => <div key={node.id} style={{ paddingLeft: `${Math.max(0, node.id.split('-').length - 1) * 14}px` }}><span>{node.kind}</span><b>{node.name}</b><small>{items.filter(item => item.specifics.storagePath?.includes(node.name)).length} items</small></div>)}</div></section>}
      {section === 'import' && <section className="panel center-panel"><h3>Import Center</h3><p>Import Vault backups, JSON catalogs, standards-compliant CSV files and phone capture bundles.</p><button className="primary" onClick={() => fileRef.current?.click()}>Choose file</button><input ref={fileRef} type="file" hidden accept=".json,.csv" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])}/></section>}
      {section === 'backup' && <><section className="panel center-panel"><h3>Backup Center</h3><p>Version 2 backups contain an integrity checksum and all marketplace-ready item records.</p><div className="backup-actions"><button className="primary" onClick={exportBackup}>Create verified backup</button><button className="secondary" onClick={() => fileRef.current?.click()}>Restore backup</button></div></section><MobileExchange onConflicts={()=>{setSection('review');void loadIntelligence();}}/></>}
    </main>{editing !== undefined && (
      <ItemEditor item={editing ?? null} schemas={schemas} busy={busy} onCancel={() => setEditing(undefined)} onSave={save}/>
    )}
  </div>;
}
