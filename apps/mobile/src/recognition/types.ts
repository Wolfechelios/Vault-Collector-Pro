import type {VisionCandidate} from '@vault/vision';

export type RecognitionReadiness = 'ready' | 'partial' | 'unavailable';
export type ObjectLabel = {label: string; score: number};
export type RawRecognition = {rawText: string; barcodes: string[]; labels: ObjectLabel[]; warnings: string[]};
export type WebRecognitionResult = VisionCandidate & {readiness: RecognitionReadiness};
export type RecognitionRequest = {id: string; type: 'recognize'; images: string[]};
export type RecognitionResponse = {id: string; result?: WebRecognitionResult; error?: string};
