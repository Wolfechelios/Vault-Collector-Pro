import { registerPlugin } from '@capacitor/core';
import { parseVisionText, type VisionCandidate, type VisionSignal } from '@vault/vision';

export type NativeVisionImage = { id: string; dataUrl: string };
export type NativeVisionSignal = {
  kind: 'logo' | 'object' | 'metadata';
  field: string;
  value: string;
  confidence: number;
  sourceImageId: string;
  engine: string;
  bounds?: { x: number; y: number; width: number; height: number };
};
export type NativeVisionResult = { rawText: string; barcodes: string[]; signals: NativeVisionSignal[]; warnings: string[] };

interface VaultVisionPlugin { analyze(options: { images: NativeVisionImage[] }): Promise<NativeVisionResult> }
export const VaultVision = registerPlugin<VaultVisionPlugin>('VaultVision');

export function nativeResultToCandidate(result: NativeVisionResult): VisionCandidate {
  const signals: VisionSignal[] = result.signals.map(signal => ({
    field: signal.field,
    value: signal.value,
    confidence: Math.max(0, Math.min(1, signal.confidence)),
    source: signal.kind
  }));
  const parsed = parseVisionText(result.rawText, result.barcodes, signals);
  const explicitFields = new Set(signals.map(signal => signal.field));
  return {
    ...parsed,
    fields: [...parsed.fields.filter(field => !explicitFields.has(field.field)), ...signals],
    engine: [...new Set(result.signals.map(signal => signal.engine).filter(Boolean))].join(' + ') || 'Native mobile vision',
    warnings: [...new Set([...parsed.warnings, ...result.warnings])]
  };
}

export async function analyzeNativePhotos(images: NativeVisionImage[], plugin: VaultVisionPlugin = VaultVision) {
  if (!images.length) throw new Error('Native vision needs at least one image.');
  return nativeResultToCandidate(await plugin.analyze({ images }));
}
