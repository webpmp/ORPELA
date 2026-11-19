import {extractEpubFromBytes} from './epubCore';

interface EpubWorkerRequest {
  buffer: ArrayBuffer;
  fileName: string;
}

self.onmessage = async (event: MessageEvent<EpubWorkerRequest>) => {
  try {
    const {buffer, fileName} = event.data;
    const result = await extractEpubFromBytes(new Uint8Array(buffer), fileName, (percent) => {
      self.postMessage({type: 'progress', percent});
    });
    self.postMessage({type: 'result', result});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse EPUB file.';
    self.postMessage({type: 'error', message});
  }
};
