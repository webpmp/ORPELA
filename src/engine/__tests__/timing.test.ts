import {describe, expect, it} from 'vitest';
import {getChunkAt} from '../chunker';
import {TIMING_CONSTANTS, computeChunkDurationMs} from '../timing';
import {tokenize} from '../tokenizer';

describe('timing', () => {
  it('computes base timing at WPM extremes (100 and 1,000)', () => {
    const doc = tokenize('word next.');
    const chunk = getChunkAt(doc.tokens, 0, 1)!;

    expect(computeChunkDurationMs(chunk, 100, 1)).toBe(600);
    expect(computeChunkDurationMs(chunk, 1000, 1)).toBe(60);
    // Clamps outside range
    expect(computeChunkDurationMs(chunk, 50, 1)).toBe(600);
    expect(computeChunkDurationMs(chunk, 2000, 1)).toBe(60);
  });

  it('applies clause, terminal, paragraph, and long-word multipliers', () => {
    const baseMs = 60000 / 300; // 200ms

    const commaDoc = tokenize('Hello, world.');
    const commaChunk = getChunkAt(commaDoc.tokens, 0, 1)!;
    expect(computeChunkDurationMs(commaChunk, 300, 1)).toBeCloseTo(
      baseMs * (1 + TIMING_CONSTANTS.PAUSE_CLAUSE_ADDITION)
    );

    const terminalDoc = tokenize('First sentence.\n\nSecond paragraph.');
    const sentenceEndChunk = getChunkAt(terminalDoc.tokens, 1, 1)!;
    // Both terminal punctuation (+1.0) and paragraph end (+1.5) apply on "sentence."
    expect(computeChunkDurationMs(sentenceEndChunk, 300, 1)).toBeCloseTo(
      baseMs *
        (1 +
          TIMING_CONSTANTS.PAUSE_TERMINAL_ADDITION +
          TIMING_CONSTANTS.PAUSE_PARAGRAPH_ADDITION)
    );

    const longWordDoc = tokenize('Extraordinary day.');
    const longChunk = getChunkAt(longWordDoc.tokens, 0, 1)!;
    expect(computeChunkDurationMs(longChunk, 300, 1)).toBeCloseTo(
      baseMs * (1 + TIMING_CONSTANTS.LONG_WORD_ADDITION)
    );
  });

  it('scales additions linearly with punctuationPauseStrength (0 to 2)', () => {
    const doc = tokenize('Wait, now.');
    const chunk = getChunkAt(doc.tokens, 0, 1)!;
    const baseMs = 200;

    expect(computeChunkDurationMs(chunk, 300, 0)).toBeCloseTo(baseMs);
    expect(computeChunkDurationMs(chunk, 300, 1)).toBeCloseTo(baseMs * 1.5);
    expect(computeChunkDurationMs(chunk, 300, 2)).toBeCloseTo(baseMs * 2.0);
  });
});
