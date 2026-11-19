import {describe, expect, it} from 'vitest';
import {TOKENIZER_VERSION, tokenize} from '../tokenizer';

describe('tokenizer', () => {
  it('handles empty and whitespace-only input', () => {
    expect(tokenize('')).toEqual({
      version: TOKENIZER_VERSION,
      tokens: [],
      sentenceStarts: [],
      paragraphStarts: [],
    });
    expect(tokenize('   \n\n  \t  ').tokens).toHaveLength(0);
  });

  it('does not break sentences on abbreviations, decimals, URLs, or lowercase ellipses', () => {
    const text =
      'Dr. Smith and Mr. Jones visited the U.S. at 3.14 p.m. to check e.g. https://example.com/a.b and wait... then left.';
    const res = tokenize(text);
    expect(res.sentenceStarts).toEqual([0]);
    expect(res.tokens[res.tokens.length - 1].isSentenceEnd).toBe(true);
    expect(res.tokens.filter((t) => t.isSentenceEnd)).toHaveLength(1);
  });

  it('splits sentences cleanly across closing quotes and uppercase ellipses', () => {
    const text = '"Hello world!" She paused... Then she asked, "Really?" Yes.';
    const res = tokenize(text);
    const ends = res.tokens.filter((t) => t.isSentenceEnd).map((t) => t.text);
    expect(ends).toEqual(['world!"', 'paused...', '"Really?"', 'Yes.']);
    expect(res.sentenceStarts).toHaveLength(4);
  });

  it('splits on em dashes and double hyphens while keeping punctuation attached', () => {
    const res = tokenize('Wait—what happened? Alpha--beta tested.');
    expect(res.tokens.map((t) => t.text)).toEqual([
      'Wait—',
      'what',
      'happened?',
      'Alpha--',
      'beta',
      'tested.',
    ]);
  });

  it('splits words longer than 14 chars into two display fragments counted as one word', () => {
    const res = tokenize('Short electroencephalograph done.');
    expect(res.tokens).toHaveLength(3);
    expect(res.tokens[1].index).toBe(1);
    expect(res.tokens[1].fragments).toHaveLength(2);
    expect(res.tokens[1].fragments[0].isContinuation).toBe(true);
    expect(res.tokens[1].fragments[1].isContinuation).toBe(false);
    expect(
      res.tokens[1].fragments[0].text + res.tokens[1].fragments[1].text
    ).toBe('electroencephalograph');
  });

  it('tracks paragraph breaks and starts accurately', () => {
    const res = tokenize('First para one. Two.\n\nSecond para starts here.');
    expect(res.paragraphStarts).toEqual([0, 4]);
    expect(res.tokens[3].isParagraphEnd).toBe(true);
    expect(res.tokens[3].paragraphIndex).toBe(0);
    expect(res.tokens[4].paragraphIndex).toBe(1);
  });

  it('is strictly deterministic across repeated runs', () => {
    const sample =
      'Dr. Lin read 2.5 pages—quickly—before "stopping." Then she slept.\n\nNext day: fresh start!';
    const a = tokenize(sample);
    const b = tokenize(sample);
    expect(a).toEqual(b);
  });
});
