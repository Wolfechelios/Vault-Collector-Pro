import React from 'react';
import { mergeVisionCandidates, parseVisionText } from '@vault/vision';
import type { VisionCandidate } from '@vault/vision';
import type { CategorySchemaRecord } from '@vault/intelligence-sync';
import { MobileCategoryFields } from '../categories/MobileCategoryFields';
import { recognizePhotos } from '../../recognition/workerClient';
import type { WebRecognitionResult } from '../../recognition/types';

type LocalPhoto = { name: string; type: string; size: number; dataUrl: string };
const readPhoto = (file: File) => new Promise<LocalPhoto>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error);
  reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
  reader.readAsDataURL(file);
});

export async function analyzeCapture(
  text: string,
  images: string[],
  recognizer: (images: string[]) => Promise<WebRecognitionResult> = recognizePhotos
): Promise<{candidate: VisionCandidate; warning: string}> {
  const manual = parseVisionText(text);
  if (!images.length) return {candidate: manual, warning: ''};
  try {
    const recognized = await recognizer(images);
    return {
      candidate: text.trim() ? mergeVisionCandidates([recognized, manual]) : recognized,
      warning: recognized.warnings.join(' · ')
    };
  } catch (error) {
    return {candidate: manual, warning: `Web analysis warning: ${String(error)}`};
  }
}

export function MobileCapture({ onCapture, schemas }: { onCapture: (value: any) => void; schemas: CategorySchemaRecord[] }) {
  const [text, setText] = React.useState('');
  const [result, setResult] = React.useState<any>(null);
  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);
  const [specifics, setSpecifics] = React.useState<Record<string, string>>({});
  const [warning, setWarning] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const category = result?.fields.find((field: any) => field.field === 'category')?.value ?? 'other';

  async function selectPhotos(files: FileList | null) {
    if (files) setPhotos(await Promise.all(Array.from(files).map(readPhoto)));
  }

  async function analyze() {
    setAnalyzing(true);
    setWarning('');
    const analyzed = await analyzeCapture(text, photos.map(photo => photo.dataUrl));
    setResult(analyzed.candidate);
    setWarning(analyzed.warning);
    setAnalyzing(false);
  }

  function saveCapture() {
    onCapture({ ...result, photos, specifics, capturedAt: new Date().toISOString(), rawText: result.rawText || text });
  }

  return <section><p className="eyebrow">OFFLINE CAPTURE</p><h2>Analyze an item</h2>
    <label className="capture">＋ Capture or add photos<input hidden type="file" accept="image/*" capture="environment" multiple onChange={event => void selectPhotos(event.target.files)}/></label>
    {photos.length > 0 && <div className="photo-strip">{photos.map(photo => <figure key={`${photo.name}:${photo.size}`}><img src={photo.dataUrl} alt={photo.name}/><figcaption>{photo.name}</figcaption></figure>)}</div>}
    <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Visible label text, model, serial, ISBN, condition…"/>
    <button onClick={() => void analyze()} disabled={analyzing || (!text.trim() && !photos.length)}>{analyzing ? 'Analyzing on device…' : 'Analyze locally'}</button>
    {warning && <p className="warning">{warning}</p>}
    {result && <><MobileCategoryFields definitions={schemas.filter(row => row.category === '*' || row.category.toLocaleLowerCase() === category.toLocaleLowerCase())} values={specifics} onChange={(key, value) => setSpecifics(current => ({ ...current, [key]: value }))}/><div className="cards">{result.fields.map((field: any) => <article key={field.field}><small>{field.field} · {Math.round(field.confidence * 100)}%</small><h3>{field.value}</h3></article>)}</div><button onClick={saveCapture}>Save capture offline</button></>}
  </section>;
}
