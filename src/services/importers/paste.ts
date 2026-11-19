import type {ImportResult} from '../../types';
import {normalizeImportedText} from './normalize';

export function deriveTitleFromText(normalizedText: string): string {
  const firstLine = normalizedText.split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled';
  if (firstLine.length <= 72) return firstLine;
  return `${firstLine.slice(0, 69).trimEnd()}...`;
}

export function importPastedText(rawText: string, customTitle?: string): ImportResult {
  const text = normalizeImportedText(rawText);
  if (!text) {
    throw new Error('Please paste some text before importing.');
  }

  const trimmedTitle = customTitle?.trim();
  const title = trimmedTitle ? trimmedTitle : deriveTitleFromText(text);

  return {
    title,
    text,
    source: 'paste',
    warnings: [],
  };
}
