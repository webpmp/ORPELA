import {describe, expect, it} from 'vitest';
import {buildChunks, getChunkAt} from '../chunker';
import {tokenize} from '../tokenizer';

describe('chunker', () => {
  it('supports all four chunk sizes and respects sentence boundaries', () => {
    const doc = tokenize('One two three four five. Six seven.');

    const size1 = buildChunks(doc.tokens, 1);
    expect(size1.map((c) => c.text)).toEqual([
      'One',
      'two',
      'three',
      'four',
      'five.',
      'Six',
      'seven.',
    ]);

    const size2 = buildChunks(doc.tokens, 2);
    expect(size2.map((c) => c.text)).toEqual([
      'One two',
      'three four',
      'five.',
      'Six seven.',
    ]);

    const size3 = buildChunks(doc.tokens, 3);
    expect(size3.map((c) => c.text)).toEqual([
      'One two three',
      'four five.',
      'Six seven.',
    ]);

    const size4 = buildChunks(doc.tokens, 4);
    expect(size4.map((c) => c.text)).toEqual([
      'One two three four',
      'five.',
      'Six seven.',
    ]);
  });

  it('handles final partial chunks cleanly', () => {
    const doc = tokenize('Alpha beta gamma delta epsilon.');
    const chunks = buildChunks(doc.tokens, 4);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].tokens).toHaveLength(1);
    expect(chunks[1].text).toBe('epsilon.');
    expect(getChunkAt(doc.tokens, 10, 2)).toBeNull();
  });
});
