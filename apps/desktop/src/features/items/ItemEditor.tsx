import React from 'react';
import type { ItemRecord } from '@vault/domain';
import { emptyItemForm, formToDraft, itemToForm, type ItemFormState, validateItemForm } from './itemForm';
import { VisionPanel, type PendingIntelligenceAnalysis } from '../vision/VisionPanel';
import { ValuationPanel } from '../valuation/ValuationPanel';
import { CategorySpecificFields } from './CategorySpecificFields';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';

const categories = ['cards','comics','magazines','books','coins','cash','vhs','vinyl','actionFigures','electronics','memorabilia','posters','furniture','cars','tools','shoes','clothing','jewelry','art','other'];
type Props = { item: ItemRecord | null; schemas: CategorySchemaRecord[]; busy: boolean; onCancel: () => void; onSave: (draft: ReturnType<typeof formToDraft>, analysis?: PendingIntelligenceAnalysis) => Promise<void> };
const readFile = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });

export function ItemEditor({ item, schemas, busy, onCancel, onSave }: Props) {
  const [form, setForm] = React.useState<ItemFormState>(() => item ? itemToForm(item) : emptyItemForm);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [visionOpen, setVisionOpen] = React.useState(false);
  const [valuationOpen, setValuationOpen] = React.useState(false);
  const [pendingAnalysis, setPendingAnalysis] = React.useState<PendingIntelligenceAnalysis>();
  React.useEffect(() => setForm(item ? itemToForm(item) : emptyItemForm), [item]);
  const set = (key: keyof ItemFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));
  async function addPhotos(files: FileList | null) { if (!files) return; const picked = [...files].slice(0, 8 - form.photos.length); const encoded = await Promise.all(picked.map(readFile)); setForm((value) => ({ ...value, photos: [...value.photos, ...encoded].slice(0, 8) })); }
  async function submit(event: React.FormEvent) { event.preventDefault(); const next = validateItemForm(form); setErrors(next); if (!next.length) await onSave(formToDraft(form), pendingAnalysis); }
  const applyVision = (fields: Record<string, string>) => setForm((value) => ({
    ...value,
    title: fields.title || value.title,
    category: fields.category || value.category,
    condition: fields.condition || value.condition,
    brand: fields.brand || value.brand,
    model: fields.model || value.model,
    year: fields.year || value.year,
    edition: fields.edition || value.edition,
    serialNumber: fields.serialNumber || value.serialNumber,
    specifics: { ...value.specifics, ...Object.fromEntries(Object.entries(fields).filter(([key]) => !['title','category','condition','brand','model','year','edition','serialNumber'].includes(key))) },
    inferredFields: [...new Set([...value.inferredFields, ...Object.keys(fields).filter((key) => key !== 'title')])]
  }));
  return <div className="modal-backdrop" onMouseDown={onCancel}><form className="editor wide" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
    <div className="editor-head"><div><p className="eyebrow">EBAY-STYLE PRIVATE RECORD</p><h2>{item ? 'Edit item' : 'Add item'}</h2></div><button type="button" className="icon-button" onClick={onCancel}>×</button></div>
    {errors.length > 0 && <div className="form-error">{errors.map((error) => <div key={error}>{error}</div>)}</div>}
    <div className="editor-tools"><button type="button" className="secondary" onClick={() => setVisionOpen(true)}>◎ Analyze all photos</button><button type="button" className="secondary" onClick={() => setValuationOpen(true)}>↗ Calculate median value</button></div>
    <div className="photo-strip">{form.photos.map((photo, index) => <div className="photo-thumb" key={index}><img src={photo}/><button type="button" onClick={() => setForm((value) => ({ ...value, photos: value.photos.filter((_, number) => number !== index) }))}>×</button>{index === 0 && <span>Primary</span>}</div>)}<label className="photo-add">＋<input type="file" accept="image/*" multiple hidden onChange={(event) => addPhotos(event.target.files)}/><small>Add photos</small></label></div>
    <div className="form-grid">
      <label className="full">Listing title<input autoFocus value={form.title} onChange={set('title')} placeholder="Exact title, model, year, edition"/></label>
      <label>Category<select value={form.category} onChange={set('category')}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Subcategory<input value={form.subcategory} onChange={set('subcategory')}/></label>
      <label>Status<select value={form.status} onChange={set('status')}><option>private</option><option>draft</option><option>listed</option><option>sold</option></select></label>
      <label>Quantity<input inputMode="numeric" value={form.quantity} onChange={set('quantity')}/></label>
      <label>Condition<input value={form.condition} onChange={set('condition')}/></label>
      <label>Condition notes<input value={form.conditionNotes} onChange={set('conditionNotes')}/></label>
      <label>Brand<input value={form.brand} onChange={set('brand')}/></label><label>Model<input value={form.model} onChange={set('model')}/></label>
      <label>Year<input inputMode="numeric" value={form.year} onChange={set('year')}/></label><label>Edition<input value={form.edition} onChange={set('edition')}/></label>
      <label>SKU<input value={form.sku} onChange={set('sku')}/></label><label>Serial number<input value={form.serialNumber} onChange={set('serialNumber')}/></label>
      <label>Purchase price<input inputMode="decimal" value={form.purchasePrice} onChange={set('purchasePrice')}/></label><label>Median value<input inputMode="decimal" value={form.medianValue} onChange={set('medianValue')}/></label>
      <label>Suggested price<input inputMode="decimal" value={form.suggestedPrice} onChange={set('suggestedPrice')}/></label><label>Minimum price<input inputMode="decimal" value={form.minimumPrice} onChange={set('minimumPrice')}/></label>
      <label className="full">Storage path<input value={form.storagePath} onChange={set('storagePath')} placeholder="House / Garage / Shelf A / Bin 3"/></label>
      <label className="full">Tags<input value={form.tags} onChange={set('tags')} placeholder="rare, insured, needs grading"/></label>
      <CategorySpecificFields category={form.category} definitions={schemas} values={form.specifics} protectedFields={form.protectedFields} onChange={(key, value) => setForm((current) => ({ ...current, specifics: { ...current.specifics, [key]: value }, protectedFields: [...new Set([...current.protectedFields, key])] }))}/>
      <label className="full">Description<textarea rows={5} value={form.description} onChange={set('description')}/></label><label className="full">Private notes<textarea rows={3} value={form.notes} onChange={set('notes')}/></label>
    </div>
    <div className="editor-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button></div>
    <VisionPanel open={visionOpen} itemId={item?.id} onClose={() => setVisionOpen(false)} photos={form.photos} onApply={(fields, analysis) => { applyVision(fields); if (!item) setPendingAnalysis(analysis); setVisionOpen(false); }}/>
    <ValuationPanel open={valuationOpen} title={form.title} onClose={() => setValuationOpen(false)} onApply={(median, suggested) => { setForm((value) => ({ ...value, medianValue: (median / 100).toFixed(2), suggestedPrice: (suggested / 100).toFixed(2) })); setValuationOpen(false); }}/>
  </form></div>;
}
