/// <reference lib="webworker" />
import {createWorker} from 'tesseract.js';
import {BinaryBitmap, HybridBinarizer, MultiFormatReader, RGBLuminanceSource} from '@zxing/library';
import {buildRecognitionResult} from './webRecognition';
import type {ObjectLabel, RecognitionRequest, RecognitionResponse} from './types';

declare const self: DedicatedWorkerGlobalScope;
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | undefined;
let classifier: ((image: string, options?: object) => Promise<Array<{label: string; score: number}>>) | undefined;

async function runOcr(image: string) {
  ocrWorker ??= await createWorker('eng', 1, {langPath: `${self.location.origin}/Vault-Collector-Pro/models/tesseract`});
  return (await ocrWorker.recognize(image)).data.text;
}

async function imageData(image: string) {
  const blob = await (await fetch(image)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function runBarcode(image: string) {
  if ('BarcodeDetector' in self) {
    const Detector = (self as unknown as {BarcodeDetector: new (options: object) => {detect(source: ImageBitmap): Promise<Array<{rawValue: string}>>}}).BarcodeDetector;
    const bitmap = await createImageBitmap(await (await fetch(image)).blob());
    return (await new Detector({formats: ['aztec', 'code_128', 'code_39', 'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e']}).detect(bitmap)).map(row => row.rawValue);
  }
  const pixels = await imageData(image);
  const source = new RGBLuminanceSource(pixels.data, pixels.width, pixels.height);
  return [new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(source))).getText()];
}

async function runLabels(image: string): Promise<ObjectLabel[]> {
  if (!classifier) {
    const {pipeline} = await import('@huggingface/transformers');
    classifier = await pipeline('image-classification', 'Xenova/mobilenet_v2_1.0_224') as typeof classifier;
  }
  return (await classifier!(image, {top_k: 5})).map(row => ({label: row.label, score: row.score}));
}

self.addEventListener('message', async (event: MessageEvent<RecognitionRequest>) => {
  const warnings: string[] = [];
  try {
    const text: string[] = [];
    const barcodes: string[] = [];
    const labels: ObjectLabel[] = [];
    for (const image of event.data.images) {
      try { text.push(await runOcr(image)); } catch (error) { warnings.push(`OCR unavailable: ${String(error)}`); }
      try { barcodes.push(...await runBarcode(image)); } catch { /* no barcode is normal */ }
      try { labels.push(...await runLabels(image)); } catch (error) { warnings.push(`Object model unavailable: ${String(error)}`); }
    }
    const result = buildRecognitionResult({rawText: text.join('\n'), barcodes, labels, warnings});
    self.postMessage({id: event.data.id, result} satisfies RecognitionResponse);
  } catch (error) {
    self.postMessage({id: event.data.id, error: String(error)} satisfies RecognitionResponse);
  }
});
