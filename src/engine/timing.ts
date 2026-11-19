import type {WordChunk} from './chunker';
import {stripSurroundingPunctuation} from './orp';

export const TIMING_CONSTANTS = {
  MIN_WPM: 100,
  MAX_WPM: 1000,
  DEFAULT_WPM: 300,
  WPM_STEP: 25,
  PAUSE_CLAUSE_ADDITION: 0.5, // comma, semicolon, colon
  PAUSE_TERMINAL_ADDITION: 1.0, // period, question mark, exclamation mark
  PAUSE_PARAGRAPH_ADDITION: 1.5, // paragraph end
  LONG_WORD_ADDITION: 0.2, // any word of 10+ characters in chunk
  LONG_WORD_CHAR_THRESHOLD: 10,
} as const;

const CLOSING_WRAPPERS_RE = /["'”’»)\]}]+$/;

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return TIMING_CONSTANTS.DEFAULT_WPM;
  return Math.max(TIMING_CONSTANTS.MIN_WPM, Math.min(TIMING_CONSTANTS.MAX_WPM, Math.round(wpm)));
}

export function clampPauseStrength(strength: number): number {
  if (!Number.isFinite(strength)) return 1;
  return Math.max(0, Math.min(2, strength));
}

export function computeChunkAdditionFactor(chunk: WordChunk): number {
  if (chunk.tokens.length === 0) return 0;

  let addition = 0;
  const lastToken = chunk.tokens[chunk.tokens.length - 1];
  const cleanedLast = lastToken.text.replace(CLOSING_WRAPPERS_RE, '');
  const lastChar = cleanedLast.charAt(cleanedLast.length - 1);

  if (lastChar === ',' || lastChar === ';' || lastChar === ':') {
    addition += TIMING_CONSTANTS.PAUSE_CLAUSE_ADDITION;
  } else if (lastChar === '.' || lastChar === '?' || lastChar === '!' || lastChar === '…') {
    addition += TIMING_CONSTANTS.PAUSE_TERMINAL_ADDITION;
  }

  if (lastToken.isParagraphEnd) {
    addition += TIMING_CONSTANTS.PAUSE_PARAGRAPH_ADDITION;
  }

  const hasLongWord = chunk.tokens.some((token) => {
    const {core} = stripSurroundingPunctuation(token.text);
    return core.length >= TIMING_CONSTANTS.LONG_WORD_CHAR_THRESHOLD;
  });

  if (hasLongWord) {
    addition += TIMING_CONSTANTS.LONG_WORD_ADDITION;
  }

  return addition;
}

export function computeChunkDurationMs(
  chunk: WordChunk,
  wpm: number,
  punctuationPauseStrength = 1
): number {
  const safeWpm = clampWpm(wpm);
  const safeStrength = clampPauseStrength(punctuationPauseStrength);
  const baseWordTimeMs = 60000 / safeWpm;
  const wordsInChunk = Math.max(1, chunk.tokens.length);
  const additions = computeChunkAdditionFactor(chunk);

  return baseWordTimeMs * wordsInChunk * (1 + additions * safeStrength);
}
