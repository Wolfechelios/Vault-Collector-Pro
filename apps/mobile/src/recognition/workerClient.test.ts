import {describe, expect, it} from 'vitest';
import {RecognitionWorkerClient} from './workerClient';

describe('recognition worker client', () => {
  it('correlates a worker response by request id', async () => {
    const listeners: Array<(event: MessageEvent) => void> = [];
    const worker = {
      addEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.push(listener),
      postMessage: (request: {id: string}) => listeners[0]({data: {id: request.id, result: {rawText: '', fields: [], barcodes: [], engine: 'Web', warnings: [], readiness: 'ready'}}} as MessageEvent)
    };
    const client = new RecognitionWorkerClient(worker as never);
    await expect(client.recognizePhotos(['data:image/png;base64,a'])).resolves.toEqual(expect.objectContaining({readiness: 'ready'}));
  });
});
