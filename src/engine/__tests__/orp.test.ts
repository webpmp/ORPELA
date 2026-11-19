import {describe, expect, it} from 'vitest';
import {computeChunkOrp, computeCoreOrpIndex, findWordOrpIndex} from '../orp';

describe('orp', () => {
  it('computes ORP index across every length bucket', () => {
    expect(computeCoreOrpIndex(1)).toBe(0);
    expect(computeCoreOrpIndex(2)).toBe(1);
    expect(computeCoreOrpIndex(5)).toBe(1);
    expect(computeCoreOrpIndex(6)).toBe(2);
    expect(computeCoreOrpIndex(9)).toBe(2);
    expect(computeCoreOrpIndex(10)).toBe(3);
    expect(computeCoreOrpIndex(13)).toBe(3);
    expect(computeCoreOrpIndex(14)).toBe(4);
    expect(computeCoreOrpIndex(20)).toBe(4);
  });

  it('maps ORP back accurately with leading/trailing punctuation, quotes, and parens', () => {
    // "(hello!)" -> core is "hello" (len 5 -> index 1 = 'e'), leading "(" len 1 -> total index 2
    const idx1 = findWordOrpIndex('(hello!)');
    expect('(hello!)'.charAt(idx1)).toBe('e');

    // '"A"' -> core "A" (len 1 -> index 0), leading '"' len 1 -> index 1
    const idx2 = findWordOrpIndex('"A"');
    expect('"A"'.charAt(idx2)).toBe('A');

    // 'understanding,' -> core 13 -> index 3 ('e')
    const idx3 = findWordOrpIndex('understanding,');
    expect('understanding,'.charAt(idx3)).toBe('e');

    const singleLayout = computeChunkOrp(['understanding,']);
    expect(singleLayout.focalWordIndex).toBe(0);
    expect(singleLayout.orpIndex).toBe(3);
    expect(singleLayout.focalChar).toBe('e');
    expect(singleLayout.before + singleLayout.focalChar + singleLayout.after).toBe(
      'understanding,'
    );
  });

  it('returns no focal highlight index for multi-word chunks (2w, 3w, 4w)', () => {
    const twoWord = computeChunkOrp(['renew', 'thyself;']);
    expect(twoWord).toEqual({
      fullText: 'renew thyself;',
      focalWordIndex: null,
      orpIndex: null,
      before: '',
      focalChar: '',
      after: '',
    });

    const threeWord = computeChunkOrp(['the', 'quick', 'fox']);
    expect(threeWord).toEqual({
      fullText: 'the quick fox',
      focalWordIndex: null,
      orpIndex: null,
      before: '',
      focalChar: '',
      after: '',
    });

    const fourWord = computeChunkOrp(['read', 'every', 'single', 'line.'], 4);
    expect(fourWord).toEqual({
      fullText: 'read every single line.',
      focalWordIndex: null,
      orpIndex: null,
      before: '',
      focalChar: '',
      after: '',
    });
  });

  it('returns no focal highlight index for 1-word leftover chunks when wordsPerFlash is 2, 3, or 4', () => {
    for (const wordsPerFlash of [2, 3, 4] as const) {
      expect(computeChunkOrp(['much.'], wordsPerFlash)).toEqual({
        fullText: 'much.',
        focalWordIndex: null,
        orpIndex: null,
        before: '',
        focalChar: '',
        after: '',
      });
    }
  });
});
