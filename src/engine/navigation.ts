import {buildChunks, type ChunkSize} from './chunker';
import {computeChunkDurationMs} from './timing';
import type {WordToken} from './tokenizer';

export interface ProgressStats {
  wordIndex: number;
  totalWords: number;
  percentage: number;
  wordsRead: number;
  wordsRemaining: number;
  estimatedSecondsRemaining: number;
}

export function prevSentence(
  tokens: readonly WordToken[],
  sentenceStarts: readonly number[],
  currentIndex: number
): number {
  if (tokens.length === 0 || sentenceStarts.length === 0) return 0;
  const clamped = Math.max(0, Math.min(tokens.length - 1, currentIndex));
  const sentenceIdx = tokens[clamped].sentenceIndex;
  const currentSentenceStart = sentenceStarts[sentenceIdx] ?? 0;

  if (clamped > currentSentenceStart) {
    return currentSentenceStart;
  }
  const prevIdx = Math.max(0, sentenceIdx - 1);
  return sentenceStarts[prevIdx] ?? 0;
}

export function nextSentence(
  tokens: readonly WordToken[],
  sentenceStarts: readonly number[],
  currentIndex: number
): number {
  if (tokens.length === 0 || sentenceStarts.length === 0) return 0;
  const clamped = Math.max(0, Math.min(tokens.length - 1, currentIndex));
  const sentenceIdx = tokens[clamped].sentenceIndex;
  const nextIdx = sentenceIdx + 1;
  if (nextIdx >= sentenceStarts.length) {
    return sentenceStarts[sentenceStarts.length - 1] ?? tokens.length - 1;
  }
  return sentenceStarts[nextIdx];
}

export function prevParagraph(
  tokens: readonly WordToken[],
  paragraphStarts: readonly number[],
  currentIndex: number
): number {
  if (tokens.length === 0 || paragraphStarts.length === 0) return 0;
  const clamped = Math.max(0, Math.min(tokens.length - 1, currentIndex));
  const paragraphIdx = tokens[clamped].paragraphIndex;
  const currentParagraphStart = paragraphStarts[paragraphIdx] ?? 0;

  if (clamped > currentParagraphStart) {
    return currentParagraphStart;
  }
  const prevIdx = Math.max(0, paragraphIdx - 1);
  return paragraphStarts[prevIdx] ?? 0;
}

export function nextParagraph(
  tokens: readonly WordToken[],
  paragraphStarts: readonly number[],
  currentIndex: number
): number {
  if (tokens.length === 0 || paragraphStarts.length === 0) return 0;
  const clamped = Math.max(0, Math.min(tokens.length - 1, currentIndex));
  const paragraphIdx = tokens[clamped].paragraphIndex;
  const nextIdx = paragraphIdx + 1;
  if (nextIdx >= paragraphStarts.length) {
    return paragraphStarts[paragraphStarts.length - 1] ?? tokens.length - 1;
  }
  return paragraphStarts[nextIdx];
}

export function seekByPercentage(tokens: readonly WordToken[], percentage: number): number {
  if (tokens.length <= 1) return 0;
  const clampedPct = Math.max(0, Math.min(100, percentage));
  return Math.round((clampedPct / 100) * (tokens.length - 1));
}

export function computeProgress(
  tokens: readonly WordToken[],
  currentIndex: number,
  wpm: number,
  chunkSize: ChunkSize,
  punctuationPauseStrength = 1
): ProgressStats {
  const totalWords = tokens.length;
  if (totalWords === 0) {
    return {
      wordIndex: 0,
      totalWords: 0,
      percentage: 0,
      wordsRead: 0,
      wordsRemaining: 0,
      estimatedSecondsRemaining: 0,
    };
  }

  const clamped = Math.max(0, Math.min(totalWords - 1, currentIndex));
  const percentage = totalWords === 1 ? 100 : (clamped / (totalWords - 1)) * 100;
  const wordsRead = clamped;
  const wordsRemaining = totalWords - clamped;

  const remainingChunks = buildChunks(tokens, chunkSize, clamped);
  let totalRemainingMs = 0;
  for (const chunk of remainingChunks) {
    totalRemainingMs += computeChunkDurationMs(chunk, wpm, punctuationPauseStrength);
  }

  return {
    wordIndex: clamped,
    totalWords,
    percentage,
    wordsRead,
    wordsRemaining,
    estimatedSecondsRemaining: totalRemainingMs / 1000,
  };
}
