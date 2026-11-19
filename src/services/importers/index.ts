import {MAX_IMPORT_FILE_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_MB} from '../../config';
import type {ImportResult} from '../../types';
import {importTxtFile} from './txt';

export {importPastedText} from './paste';
export {importTxtFile} from './txt';

export async function importDocumentFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_FILE_SIZE_MB} MB import limit.`);
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt') || file.type === 'text/plain') {
    onProgress?.(50);
    const res = await importTxtFile(file);
    onProgress?.(100);
    return res;
  }

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    const {importPdfFile} = await import('./pdf');
    return importPdfFile(file, onProgress);
  }

  if (lower.endsWith('.epub') || file.type === 'application/epub+zip') {
    const {importEpubFile} = await import('./epub');
    return importEpubFile(file, onProgress);
  }

  throw new Error('Unsupported file format. Please choose a .txt, .pdf, or .epub file.');
}
