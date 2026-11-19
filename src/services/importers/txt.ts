import {MAX_IMPORT_FILE_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_MB} from '../../config';
import type {ImportResult} from '../../types';
import {rejoinHardWrappedLines, titleFromFileName} from './normalize';

export function decodeTextBuffer(buffer: ArrayBuffer): {text: string; encoding: string} {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf-8-bom',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      encoding: 'utf-16le',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      encoding: 'utf-16be',
    };
  }
  return {
    text: new TextDecoder('utf-8').decode(bytes),
    encoding: 'utf-8',
  };
}

export function importTxtBytes(buffer: ArrayBuffer, fileName: string): ImportResult {
  if (buffer.byteLength > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_FILE_SIZE_MB} MB import limit.`);
  }

  const {text: decoded} = decodeTextBuffer(buffer);
  const text = rejoinHardWrappedLines(decoded);

  if (!text) {
    throw new Error('The selected text file appears to be empty.');
  }

  return {
    title: titleFromFileName(fileName),
    text,
    source: 'txt',
    warnings: [],
  };
}

export async function importTxtFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_FILE_SIZE_MB} MB import limit.`);
  }
  const buffer = await file.arrayBuffer();
  return importTxtBytes(buffer, file.name);
}
