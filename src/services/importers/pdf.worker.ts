import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {extractPdfDocumentFromBytes} from './pdfCore';

// Bind pdfjs worker handler directly inside this dedicated Web Worker so
// pdf.js runs off the main thread without spawning nested workers or calling CDNs.
(globalThis as {pdfjsWorker?: unknown}).pdfjsWorker = pdfWorker;

interface PdfWorkerRequest {
  buffer: ArrayBuffer;
  fileName: string;
}

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  try {
    const {buffer, fileName} = event.data;
    const result = await extractPdfDocumentFromBytes(
      new Uint8Array(buffer),
      fileName,
      ({page, totalPages}) => {
        self.postMessage({
          type: 'progress',
          percent: Math.round((page / Math.max(1, totalPages)) * 100),
        });
      }
    );
    self.postMessage({type: 'result', result});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse PDF file.';
    self.postMessage({type: 'error', message});
  }
};
