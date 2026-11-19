import {MAX_IMPORT_FILE_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_MB} from '../../config';
import type {ImportResult} from '../../types';

export async function importPdfFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_FILE_SIZE_MB} MB import limit.`);
  }

  const buffer = await file.arrayBuffer();

  if (typeof Worker !== 'undefined') {
    return await new Promise<ImportResult>((resolve, reject) => {
      const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (
        event: MessageEvent<
          | {type: 'progress'; percent: number}
          | {type: 'result'; result: ImportResult}
          | {type: 'error'; message: string}
        >
      ) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          onProgress?.(msg.percent);
        } else if (msg.type === 'result') {
          worker.terminate();
          resolve(msg.result);
        } else if (msg.type === 'error') {
          worker.terminate();
          reject(new Error(msg.message));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || 'PDF worker failed unexpectedly.'));
      };

      worker.postMessage({buffer, fileName: file.name}, [buffer]);
    });
  }

  const {extractPdfDocumentFromBytes} = await import('./pdfCore');
  return extractPdfDocumentFromBytes(new Uint8Array(buffer), file.name, ({page, totalPages}) => {
    onProgress?.(Math.round((page / Math.max(1, totalPages)) * 100));
  });
}
