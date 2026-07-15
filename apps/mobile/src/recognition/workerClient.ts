import type {RecognitionRequest, RecognitionResponse, WebRecognitionResult} from './types';

type WorkerPort = Pick<Worker, 'addEventListener' | 'postMessage'>;

export class RecognitionWorkerClient {
  private pending = new Map<string, {resolve: (value: WebRecognitionResult) => void; reject: (error: Error) => void}>();

  constructor(private worker: WorkerPort) {
    worker.addEventListener('message', (event: MessageEvent<RecognitionResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      if (event.data.result) request.resolve(event.data.result);
      else request.reject(new Error(event.data.error ?? 'Recognition worker failed'));
    });
  }

  recognizePhotos(images: string[]) {
    return new Promise<WebRecognitionResult>((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pending.set(id, {resolve, reject});
      this.worker.postMessage({id, type: 'recognize', images} satisfies RecognitionRequest);
    });
  }
}

let client: RecognitionWorkerClient | undefined;
export function recognizePhotos(images: string[]) {
  client ??= new RecognitionWorkerClient(new Worker(new URL('./recognition.worker.ts', import.meta.url), {type: 'module'}));
  return client.recognizePhotos(images);
}
