import React from 'react';
import type { ItemRecord } from '@vault/domain';
import type { OfflineCapture } from '@vault/capture';
import { buildStorageTree } from '@vault/storage';
import type { StorageNode } from '@vault/storage-management';
import { createBackup, verifyBackup, type VaultBackup } from '@vault/backup';
import { mapImportRow, parseCsv } from '@vault/importer';
import type { AppSection, ViewMode } from '@vault/ui';
import { catalogueApi, type ItemDraft } from './lib/catalogueApi';
import { ItemEditor } from './features/items/ItemEditor';
import { CaptureCenter } from './features/capture/CaptureCenter';
import { MarketplaceCenter } from './features/marketplace/MarketplaceCenter';
import { StorageManager } from './features/storage/StorageManager';

const money = (minor?: number) => minor == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const parseList = (item: ItemRecord, key: string) => { try { const parsed = JSON.parse(item.specifics[key] ?? '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
function download(name: string, data: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

const sectionTitle: Record<AppSection, string> = {
  dashboard: 'Grand Hall',
  inventory: 'Exhibition Galleries',
  capture: 'Intake Studio',
  marketplace: 'Valuation Office',
  storage: 'Archive Storage',
  import: 'Curator Intake',
  backup: 'Collection Vault'
};

const sectionDescription: Record<AppSection, string> = {
  dashboard: 'A living overview of the museum, collection health, value, and exhibits that need curator attention.',
  inventory: 'Browse, search, and curate every exhibit across the Archive Boutique museum.',
  capture: 'Photograph an object and let Curator Intelligence identify, classify, and prepare the exhibit record.',
  marketplace: 'Review market evidence, historical value, and marketplace-ready exhibit drafts.',
  storage: 'Manage the packed back room: racks, shelves, cases, bins, and the real-world location of every exhibit.',
  import: 'Bring existing collection records and phone captures into the museum.',
  backup: 'Protect the archive with verified local backups and restore points.'
};

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
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const data = await catalogueApi.search({ query, category: category === 'all' ? null : category, status: status === 'active' ? null : status, limit: 2000, offset: 0 });
      setItems(status === 'active' ? data.filter(item => item.status !== 'archived') : data);
    } catch (e) { setError(String(e)); }
  }, [query, status, category]);

  React.useEffect(() => { const timer = setTimeout(load, 100); return () => clearTimeout(timer); }, [load]);

  async function save(draft: ItemDraft) { setBusy(true); try { editing ? await catalogueApi.update(editing.id, draft) : await catalogueApi.create(draft); setEditing(undefined); await load(); } catch (e) { setError(String(e)); } finally { setBusy(false); } }
  async function archiveSelected() { for (const id of selected) await catalogueApi.archive(id); setSelected(new Set()); await load(); }
  async function assignStorage(itemIds: string[], node: StorageNode, path: string) { for (const id of itemIds) { const item = items.find(value => value.id === id); if (!item) continue; await catalogueApi.update(id, { title:item.title,category:item.category,subcategory:item.subcategory,status:item.status,condition:item.condition,conditionNotes:item.conditionNotes,description:item.description,quantity:item.quantity,sku:item.sku,serialNumber:item.serialNumber,brand:item.brand,model:item.model,year:item.year,edition:item.edition,purchasePrice:item.purchasePrice,medianValue:item.medianValue,suggestedPrice:item.suggestedPrice,minimumPrice:item.minimumPrice,storageLocationId:node.id,acquiredAt:item.acquiredAt,notes:item.notes,specifics:{...item.specifics,storagePath:path} }); } await load(); }
  async function importCapture(capture: OfflineCapture) { await catalogueApi.create({ title:capture.title||'New phone capture',category:'other',subcategory:null,status:'private',condition:'Unknown',conditionNotes:null,description:capture.notes||null,quantity:1,sku:null,serialNumber:null,brand:null,model:null,year:null,edition:null,purchasePrice:null,medianValue:null,suggestedPrice:null,minimumPrice:null,notes:'Imported through Archive Boutique Intake Studio',specifics:{photos:JSON.stringify(capture.photos.map(photo=>photo.dataUrl)),photoMetadata:JSON.stringify(capture.photos.map(photo=>({id:photo.id,name:photo.name,width:photo.width,height:photo.height,quality:photo.quality}))),phoneCaptureId:capture.id,capturedAt:capture.createdAt} }); await load(); }

  const total = items.reduce((sum, item) => sum + (item.medianValue?.amountMinor ?? 0) * item.quantity, 0);
  const purchase = items.reduce((sum, item) => sum + (item.purchasePrice?.amountMinor ?? 0) * item.quantity, 0);
  const categories = [...new Set(items.map(item => item.category))].sort();
  const storage = buildStorageTree(items.map(item => item.specifics.storagePath).filter(Boolean));
  const missingPhotos = items.filter(item => parseList(item, 'photos').length === 0).length;
  const unvalued = items.filter(item => !item.medianValue).length;
  function exportBackup() { download(`archive-boutique-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(createBackup(items), null, 2)); }
  async function importFile(file: File) { try { const text = await file.text(); let rows: any[] = []; if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsv(text).map(mapImportRow); else { const parsed = JSON.parse(text); if (parsed.format === 'vault-backup' && !verifyBackup(parsed as VaultBackup<ItemRecord>)) throw new Error('Backup checksum failed'); rows = Array.isArray(parsed) ? parsed : parsed.items ?? []; } for (const row of rows) await catalogueApi.create({ title:String(row.title??row.name??'Imported exhibit'),category:String(row.category??'other'),subcategory:row.subcategory??null,status:'private',condition:String(row.condition??'Unknown'),conditionNotes:row.conditionNotes??null,description:row.description??null,quantity:Number(row.quantity??1),sku:row.sku??null,serialNumber:row.serialNumber??null,brand:row.brand??null,model:row.model??null,year:row.year?Number(row.year):null,edition:row.edition??null,purchasePrice:row.purchasePrice??null,medianValue:row.medianValue??null,suggestedPrice:row.suggestedPrice??null,minimumPrice:row.minimumPrice??null,notes:row.notes??null,specifics:row.specifics??{} }); await load(); setSection('inventory'); } catch (e) { setError(`Import failed: ${String(e)}`); } }
  const nav = (id: AppSection, label: string, count?: number) => <button className={section === id ? 'nav-active' : ''} onClick={() => setSection(id)}>{label}{count != null && <b>{count}</b>}</button>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="mark">A</div><div><h1>Archive Boutique</h1><span>Private Museum</span></div></div>
      <nav>
        {nav('dashboard','◆ Grand Hall')}
        {nav('inventory','▦ Galleries',items.length)}
        {nav('capture','◉ Intake Studio')}
        {nav('marketplace','◇ Valuation Office')}
        {nav('storage','⌖ Archive Storage',storage.length)}
        {nav('import','⇧ Curator Intake')}
        {nav('backup','⇩ Collection Vault')}
      </nav>
      <div className="side-footer">MUSEUM + CURATOR INTELLIGENCE<br/><strong>Private · Local-first</strong></div>
    </aside>

    <main className="content">
      <header>
        <div><p className="eyebrow">ARCHIVE BOUTIQUE · PRIVATE MUSEUM</p><h2>{sectionTitle[section]}</h2><p>{sectionDescription[section]}</p></div>
        <div className="header-actions"><button className="secondary" onClick={exportBackup}>Protect archive</button><button className="primary" onClick={() => setEditing(null)}>＋ New exhibit</button></div>
      </header>
      {error && <div className="banner error">{error}</div>}

      {section === 'dashboard' && <><section className="stats"><article><span>Exhibits</span><strong>{items.reduce((sum,item)=>sum+item.quantity,0)}</strong></article><article><span>Collection value</span><strong>{money(total)}</strong></article><article><span>Estimated gain</span><strong className={total-purchase>=0?'gain':'loss'}>{money(total-purchase)}</strong></article><article><span>Needs photography</span><strong>{missingPhotos}</strong></article><article><span>Needs valuation</span><strong>{unvalued}</strong></article></section><section className="dashboard-grid"><article className="panel"><h3>Treasury highlights</h3>{[...items].sort((a,b)=>(b.medianValue?.amountMinor??0)-(a.medianValue?.amountMinor??0)).slice(0,7).map(item=><button key={item.id} onClick={()=>setEditing(item)}><span>{item.title}</span><b>{money(item.medianValue?.amountMinor)}</b></button>)}</article><article className="panel"><h3>Curator attention</h3><div className="health-row"><span>Photographed</span><b>{items.length-missingPhotos}/{items.length}</b></div><div className="health-row"><span>Valued</span><b>{items.length-unvalued}/{items.length}</b></div><div className="health-row"><span>Placed in archive</span><b>{items.filter(item=>item.storageLocationId||item.specifics.storagePath).length}/{items.length}</b></div></article></section></>}

      {section === 'capture' && <CaptureCenter onImportCapture={importCapture}/>} 
      {section === 'marketplace' && <MarketplaceCenter items={items}/>} 
      {section === 'storage' && <StorageManager items={items} onAssign={assignStorage}/>} 

      {section === 'inventory' && <><section className="toolbar"><div className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask the Curator: Louis Vuitton, heavy patina, shelf B, over $500…"/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All galleries</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active exhibits</option><option>private</option><option>draft</option><option>listed</option><option>sold</option><option>archived</option></select><div className="view-switch">{(['cards','table','gallery']as ViewMode[]).map(v=><button className={view===v?'active':''} key={v} onClick={()=>setView(v)}>{v==='cards'?'▦':v==='table'?'☷':'▥'}</button>)}</div></section>{selected.size>0&&<div className="selection-bar"><b>{selected.size} exhibits selected</b><button onClick={archiveSelected}>Move to historical archive</button><button onClick={()=>setSelected(new Set())}>Clear</button></div>}{view==='table'?<div className="table-wrap"><table><thead><tr><th></th><th>Exhibit</th><th>Gallery</th><th>Archive location</th><th>Qty</th><th>Value</th><th></th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><input type="checkbox" checked={selected.has(item.id)} onChange={e=>setSelected(current=>{const next=new Set(current);e.target.checked?next.add(item.id):next.delete(item.id);return next})}/></td><td><strong>{item.title}</strong><small>{[item.brand,item.model,item.year].filter(Boolean).join(' · ')}</small></td><td>{item.category}</td><td>{item.specifics.storagePath||'—'}</td><td>{item.quantity}</td><td>{money(item.medianValue?.amountMinor)}</td><td><button className="secondary compact" onClick={()=>setEditing(item)}>Curate</button></td></tr>)}</tbody></table></div>:<section className={view==='gallery'?'inventory-grid gallery':'inventory-grid'}>{items.map(item=>{const photos=parseList(item,'photos');return <article className="item-card" key={item.id}>{photos[0]?<img className="card-photo" src={photos[0]}/>:<div className="photo-placeholder">{item.category.slice(0,1).toUpperCase()}</div>}<div className="item-body"><div className="item-meta"><span>{item.category}</span><input type="checkbox" checked={selected.has(item.id)} onChange={e=>setSelected(current=>{const next=new Set(current);e.target.checked?next.add(item.id):next.delete(item.id);return next})}/></div><h3>{item.title}</h3>{view!=='gallery'&&<><p>{[item.brand,item.model,item.year].filter(Boolean).join(' · ')||item.condition}</p><div className="location">⌖ {item.specifics.storagePath||'Awaiting archive placement'}</div><div className="item-value"><strong>{money(item.medianValue?.amountMinor)}</strong><button onClick={()=>setEditing(item)}>Curate</button></div></>}</div></article>})}</section>}</>}

      {section === 'import' && <section className="panel center-panel"><h3>Curator Intake</h3><p>Import existing Archive Boutique records, verified backups, CSV catalogs, JSON collections, and phone capture bundles.</p><button className="primary" onClick={()=>fileRef.current?.click()}>Choose collection file</button><input ref={fileRef} type="file" hidden accept=".json,.csv" onChange={e=>e.target.files?.[0]&&importFile(e.target.files[0])}/></section>}
      {section === 'backup' && <section className="panel center-panel"><h3>Collection Vault</h3><p>Create verified local snapshots of the museum catalog, exhibit records, marketplace data, and collection history.</p><div className="backup-actions"><button className="primary" onClick={exportBackup}>Create verified archive backup</button><button className="secondary" onClick={()=>fileRef.current?.click()}>Restore archive</button></div></section>}
    </main>

    {editing !== undefined && <ItemEditor item={editing ?? null} busy={busy} onCancel={() => setEditing(undefined)} onSave={save}/>} 
  </div>;
}
