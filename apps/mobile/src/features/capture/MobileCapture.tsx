import React from 'react';
import { parseVisionText } from '@vault/vision';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';
import { MobileCategoryFields } from '../categories/MobileCategoryFields';
import { runtimePlatform } from '../../native/runtime';
import { analyzeNativePhotos } from '../../native/vision';

type LocalPhoto = { name: string; type: string; size: number; dataUrl: string };
const readPhoto = (file: File) => new Promise<LocalPhoto>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error);
  reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
  reader.readAsDataURL(file);
});

export function MobileCapture({ onCapture, schemas }: { onCapture: (value: any) => void; schemas: CategorySchemaRecord[] }) {
  const [text, setText] = React.useState('');
  const [result, setResult] = React.useState<any>(null);
  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);
  const [specifics, setSpecifics] = React.useState<Record<string, string>>({});
  const [warning, setWarning] = React.useState('');
  const category = result?.fields.find((field: any) => field.field === 'category')?.value ?? 'other';

  async function selectPhotos(files: FileList | null) {
    if (files) setPhotos(await Promise.all(Array.from(files).map(readPhoto)));
  }

  async function analyze() {
    let parsed = parseVisionText(text);
    if (runtimePlatform() !== 'web' && photos.length) {
      try {
        parsed = await analyzeNativePhotos(photos.map((photo, index) => ({ id: `photo-${index}`, dataUrl: photo.dataUrl })));
      } catch (error) {
        setWarning(`Native analysis warning: ${String(error)}`);
      }
    }
    setResult(parsed);
  }

  function saveCapture() {
    onCapture({ ...result, photos, specifics, capturedAt: new Date().toISOString(), rawText: result.rawText || text });
  }

  return <section><p className="eyebrow">OFFLINE CAPTURE</p><h2>Analyze an item</h2>
    <label className="capture">＋ Capture or add photos<input hidden type="file" accept="image/*" capture="environment" multiple onChange={event => void selectPhotos(event.target.files)}/></label>
    {photos.length > 0 && <div className="photo-strip">{photos.map(photo => <figure key={`${photo.name}:${photo.size}`}><img src={photo.dataUrl} alt={photo.name}/><figcaption>{photo.name}</figcaption></figure>)}</div>}
    <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Visible label text, model, serial, ISBN, condition…"/>
    <button onClick={() => void analyze()} disabled={!text.trim() && !photos.length}>Analyze locally</button>
    {warning && <p className="warning">{warning}</p>}
    {result && <><MobileCategoryFields definitions={schemas.filter(row => row.category === '*' || row.category.toLocaleLowerCase() === category.toLocaleLowerCase())} values={specifics} onChange={(key, value) => setSpecifics(current => ({ ...current, [key]: value }))}/><div className="cards">{result.fields.map((field: any) => <article key={field.field}><small>{field.field} · {Math.round(field.confidence * 100)}%</small><h3>{field.value}</h3></article>)}</div><button onClick={saveCapture}>Save capture offline</button></>}
  </section>;
}
