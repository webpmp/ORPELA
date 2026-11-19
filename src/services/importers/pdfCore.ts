import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {ImportResult} from '../../types';
import {
  normalizeImportedText,
  rejoinHyphenatedLineBreaks,
  stripRepeatedHeadersFooters,
  titleFromFileName,
} from './normalize';

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
}

function reconstructPageLines(items: readonly PdfTextItem[]): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let lastY: number | null = null;

  for (const item of items) {
    const str = item.str ?? '';
    const y = Array.isArray(item.transform) ? item.transform[5] : undefined;

    if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 4) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    }

    if (str) {
      if (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ')) {
        currentLine += ' ';
      }
      currentLine += str;
    }

    if (item.hasEOL) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    }

    if (y !== undefined) {
      lastY = y;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}

export async function extractPdfDocumentFromBytes(
  data: Uint8Array,
  fileName: string,
  onProgress?: (progress: {page: number; totalPages: number}) => void
): Promise<ImportResult> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  let docTitle = titleFromFileName(fileName);
  let docAuthor: string | undefined;

  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info as {Title?: string; Author?: string} | undefined;
    if (info?.Title && info.Title.trim()) {
      docTitle = info.Title.trim();
    }
    if (info?.Author && info.Author.trim()) {
      docAuthor = info.Author.trim();
    }
  } catch {
    // Metadata is optional
  }

  const pagesLines: string[][] = [];
  const emptyPages: number[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const lines = reconstructPageLines(content.items as PdfTextItem[]);
    if (lines.length === 0) {
      emptyPages.push(pageNum);
    }
    pagesLines.push(lines);
    onProgress?.({page: pageNum, totalPages});
  }

  const cleanedPages = stripRepeatedHeadersFooters(pagesLines);
  const pageTexts = cleanedPages
    .map((lines) => rejoinHyphenatedLineBreaks(lines.join('\n')))
    .map((p) => p.trim())
    .filter(Boolean);

  const combined = normalizeImportedText(pageTexts.join('\n\n'));

  if (!combined) {
    throw new Error(
      'Scanned PDF, no text found. This document contains no extractable text (OCR is not supported in v1).'
    );
  }

  const warnings: string[] = [];
  if (emptyPages.length > 0 && emptyPages.length < totalPages) {
    warnings.push(
      `${emptyPages.length} of ${totalPages} page(s) contained no extractable text and were skipped.`
    );
  }

  return {
    title: docTitle,
    author: docAuthor,
    text: combined,
    source: 'pdf',
    warnings,
  };
}
