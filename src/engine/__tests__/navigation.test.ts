import {describe, expect, it} from 'vitest';
import {
  computeProgress,
  nextParagraph,
  nextSentence,
  prevParagraph,
  prevSentence,
  seekByPercentage,
} from '../navigation';
import {tokenize} from '../tokenizer';

describe('navigation', () => {
  const sample =
    'One two three. Four five six.\n\nSeven eight nine. Ten eleven twelve.';
  const doc = tokenize(sample);

  it('navigates sentences properly from mid-sentence and sentence starts', () => {
    // Index 4 is "five" (mid-sentence of sentence 1 starting at 3)
    expect(prevSentence(doc.tokens, doc.sentenceStarts, 4)).toBe(3);
    // From start of sentence 1 (index 3), goes to start of sentence 0 (index 0)
    expect(prevSentence(doc.tokens, doc.sentenceStarts, 3)).toBe(0);
    // From start of sentence 0, clamps to 0
    expect(prevSentence(doc.tokens, doc.sentenceStarts, 0)).toBe(0);

    expect(nextSentence(doc.tokens, doc.sentenceStarts, 1)).toBe(3);
    expect(nextSentence(doc.tokens, doc.sentenceStarts, 10)).toBe(9);
  });

  it('navigates paragraphs properly from mid-paragraph and paragraph starts', () => {
    expect(prevParagraph(doc.tokens, doc.paragraphStarts, 8)).toBe(6);
    expect(prevParagraph(doc.tokens, doc.paragraphStarts, 6)).toBe(0);
    expect(nextParagraph(doc.tokens, doc.paragraphStarts, 2)).toBe(6);
    expect(nextParagraph(doc.tokens, doc.paragraphStarts, 8)).toBe(6);
  });

  it('seeks by percentage and estimates remaining time with punctuation additions', () => {
    expect(seekByPercentage(doc.tokens, 0)).toBe(0);
    expect(seekByPercentage(doc.tokens, 100)).toBe(doc.tokens.length - 1);

    const progress = computeProgress(doc.tokens, 0, 300, 1, 1);
    expect(progress.totalWords).toBe(12);
    expect(progress.percentage).toBe(0);
    // With sentence/paragraph pauses, remaining time > plain 12 * 0.2s = 2.4s
    expect(progress.estimatedSecondsRemaining).toBeGreaterThan(2.4);
  });
});
