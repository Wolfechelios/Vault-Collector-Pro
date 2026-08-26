import React from 'react';
import type { ItemRecord } from '@vault/domain';
import { emptyItemForm, formToDraft, itemToForm, type ItemFormState, validateItemForm } from './itemForm';
import { VisionPanel } from '../vision/VisionPanel';
import { ValuationPanel } from '../valuation/ValuationPanel';
import { CuratorTimeline } from './CuratorTimeline';

const categories = ['handbags','shoes','clothing','jewelry','watches','art','collectibles','memorabilia','vinyl','books','cards','coins','electronics','furniture','other'];
type Props = { item: ItemRecord | null; busy: boolean; onCancel: () => void; onSave: (draft: ReturnType<typeof formToDraft>) => Promise<void> };
const readFile = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });

export function ItemEditor({ item, busy, onCancel, onSave }: Props) {
  const [form, setForm] = React.useState<ItemFormState>(() => item ? itemToForm(item) : emptyItemForm);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [visionOpen, setVisionOpen] = React.useState(false);
  const [valuationOpen, setValuationOpen] = React.useState(false);
  React.useEffect(() => setForm(item ? itemToForm(item) : emptyItemForm), [item]);
  const set = (key: keyof ItemFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(v => ({ ...v, [key]: event.target.value }));
  async function addPhotos(files: FileList | null) { if (!files) return; const picked = [...files].slice(0, 24 - form.photos.length); const encoded = await Promise.all(picked.map(readFile)); setForm(v => ({ ...v, photos: [...v.photos, ...encoded].slice(0, 24) })); }
  async function submit(e: React.FormEvent) { e.preventDefault(); const next = validateItemForm(form); setErrors(next); if (!next.length) await onSave(formToDraft(form)); }

  return <div className="modal-backdrop" onMouseDown={onCancel}>
    <form className="editor wide" onSubmit={submit} onMouseDown={e => e.stopPropagation()}>
      <div className="editor-head">
        <div><p className="eyebrow">CURATOR EXHIBIT RECORD</p><h2>{item ? 'Curate exhibit' : 'Prepare new exhibit'}</h2><p>Identity, provenance, condition, storage, valuation and marketplace data for one museum object.</p></div>
        <button type="button" className="icon-button" onClick={onCancel}>×</button>
      </div>
      {errors.length > 0 && <div className="form-error">{errors.map(x => <div key={x}>{x}</div>)}</div>}
      <div className="editor-tools">
        <button type="button" className="secondary" onClick={() => setVisionOpen(true)}>◎ Ask Curator to inspect photos</button>
        <button type="button" className="secondary" onClick={() => setValuationOpen(true)}>↗ Open valuation desk</button>
      </div>
      <div className="photo-strip">{form.photos.map((p, i) => <div className="photo-thumb" key={i}><img src={p}/><button type="button" onClick={() => setForm(v => ({ ...v, photos: v.photos.filter((_, n) => n !== i) }))}>×</button>{i === 0 && <span>Hero</span>}</div>)}<label className="photo-add">＋<input type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)}/><small>Add exhibit photos</small></label></div>
      <div className="form-grid">
        <label className="full">Exhibit title<input autoFocus value={form.title} onChange={set('title')} placeholder="Designer, object, model, era or edition"/></label>
        <label>Gallery category<select value={form.category} onChange={set('category')}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Collection / subcategory<input value={form.subcategory} onChange={set('subcategory')}/></label>
        <label>Exhibit status<select value={form.status} onChange={set('status')}><option>private</option><option>draft</option><option>listed</option><option>sold</option></select></label>
        <label>Quantity<input inputMode="numeric" value={form.quantity} onChange={set('quantity')}/></label>
        <label>Condition<input value={form.condition} onChange={set('condition')}/></label>
        <label>Condition report<input value={form.conditionNotes} onChange={set('conditionNotes')}/></label>
        <label>Designer / brand<input value={form.brand} onChange={set('brand')}/></label>
        <label>Model / style<input value={form.model} onChange={set('model')}/></label>
        <label>Year / era<input inputMode="numeric" value={form.year} onChange={set('year')}/></label>
        <label>Edition<input value={form.edition} onChange={set('edition')}/></label>
        <label>Archive SKU<input value={form.sku} onChange={set('sku')}/></label>
        <label>Serial / date code<input value={form.serialNumber} onChange={set('serialNumber')}/></label>
        <label>Acquisition cost<input inputMode="decimal" value={form.purchasePrice} onChange={set('purchasePrice')}/></label>
        <label>Current valuation<input inputMode="decimal" value={form.medianValue} onChange={set('medianValue')}/></label>
        <label>Suggested sale price<input inputMode="decimal" value={form.suggestedPrice} onChange={set('suggestedPrice')}/></label>
        <label>Minimum sale price<input inputMode="decimal" value={form.minimumPrice} onChange={set('minimumPrice')}/></label>
        <label className="full">Archive storage path<input value={form.storagePath} onChange={set('storagePath')} placeholder="Archive Room / Rack A / Shelf 2 / Case 4"/></label>
        <label className="full">Curator tags<input value={form.tags} onChange={set('tags')} placeholder="authenticated, vintage, restoration, exhibition-ready"/></label>
        <label className="full">Exhibit description<textarea rows={5} value={form.description} onChange={set('description')}/></label>
        <label className="full">Private curator notes<textarea rows={3} value={form.notes} onChange={set('notes')}/></label>
      </div>
      {item && <CuratorTimeline item={item}/>} 
      <div className="editor-actions"><button type="button" className="secondary" onClick={onCancel}>Close</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save exhibit'}</button></div>
      <VisionPanel open={visionOpen} onClose={() => setVisionOpen(false)} photos={form.photos} onApply={fields => { setForm(v => ({ ...v, title: fields.title || v.title, year: fields.year || v.year, model: fields.model || v.model, serialNumber: fields.serialNumber || v.serialNumber } as ItemFormState)); setVisionOpen(false); }}/>
      <ValuationPanel open={valuationOpen} title={form.title} onClose={() => setValuationOpen(false)} onApply={(median, suggested) => { setForm(v => ({ ...v, medianValue: (median / 100).toFixed(2), suggestedPrice: (suggested / 100).toFixed(2) })); setValuationOpen(false); }}/>
    </form>
  </div>;
}
