import fs from 'fs';
import path from 'path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {type ChunkSize, type WordChunk, buildChunks, getChunkAt} from '../../../engine/chunker';
import {type WordToken, tokenize} from '../../../engine/tokenizer';
import {DEFAULT_READER_SETTINGS} from '../../../services/storage/db';
import type {ReaderSettings} from '../../../types';
import {
  MIN_CHUNK_SCALE,
  ReaderDisplay,
  STAGE_HEIGHT_MULTIPLIER,
  computeBaseFontSize,
  computeTransformScale,
  findLongestChunkForSession,
} from '../ReaderDisplay';

function makeChunk(
  text: string,
  chunkSize: ChunkSize
): {tokens: WordToken[]; chunk: WordChunk | null} {
  const {tokens} = tokenize(text);
  return {
    tokens,
    chunk: getChunkAt(tokens, 0, chunkSize),
  };
}

function renderChunkDisplay(
  tokens: WordToken[],
  chunk: WordChunk | null,
  chunkSize: ChunkSize,
  overrides: Partial<ReaderSettings> = {},
  isPhone = false
): string {
  const settings: ReaderSettings = {
    ...DEFAULT_READER_SETTINGS,
    wordsPerFlash: chunkSize,
    ...overrides,
  };
  return renderToStaticMarkup(
    <ReaderDisplay
      tokens={tokens}
      chunk={chunk}
      fragmentIndex={0}
      isPlaying={false}
      isCompleted={false}
      countdownRemaining={0}
      settings={settings}
      isPhone={isPhone}
      onTogglePlayPause={() => {}}
      onPrevSentence={() => {}}
      onNextSentence={() => {}}
      onAdjustWpm={() => {}}
      onRevealControls={() => {}}
    />
  );
}

function renderDisplay(
  text: string,
  chunkSize: ChunkSize,
  overrides: Partial<ReaderSettings> = {},
  isPhone = false
): string {
  const {tokens, chunk} = makeChunk(text, chunkSize);
  return renderChunkDisplay(tokens, chunk, chunkSize, overrides, isPhone);
}

function extractStageStyle(html: string): string {
  const match = html.match(/data-testid="focal-stage"\s+style="([^"]+)"/);
  return match ? match[1] : '';
}

function extractTextBoxStyle(html: string): string {
  const match = html.match(/data-testid="focal-text-box"\s+style="([^"]+)"/);
  return match ? match[1] : '';
}

describe('ReaderDisplay focal alignment', () => {
  it('highlights and aligns the ORP letter to the center axis for 1-word chunks when orpEnabled is true', () => {
    const html = renderDisplay('understanding,', 1, {
      orpEnabled: true,
      orpColor: '#dc2626',
    });

    expect(html).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(html).toContain('data-testid="orp-focal-char"');
    expect(html).toContain('>und</span>');
    expect(html).toContain('>e</span>');
    expect(html).toContain('>rstanding,</span>');
    expect(html).toContain('underline');
    expect(html).toContain('color:#dc2626');
  });

  it('centers chunks without highlight or underline at any setting when orpEnabled is false', () => {
    for (const wordsPerFlash of [1, 2, 3, 4] as const) {
      const sample = wordsPerFlash === 1 ? 'understanding,' : 'one two three four';
      const html = renderDisplay(sample, wordsPerFlash, {
        orpEnabled: false,
        orpColor: '#dc2626',
      });

      expect(html).not.toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
      expect(html).not.toContain('data-testid="orp-focal-char"');
      expect(html).not.toContain('underline');
      expect(html).not.toContain('#dc2626');
      expect(html).toContain('data-testid="centered-chunk"');
    }
  });

  it('centers 2w, 3w, and 4w chunks horizontally on the focal axis with no highlighted or underlined letter', () => {
    const cases: Array<{wordsPerFlash: 2 | 3 | 4; text: string}> = [
      {wordsPerFlash: 2, text: 'renew thyself;'},
      {wordsPerFlash: 3, text: 'the quick fox'},
      {wordsPerFlash: 4, text: 'read every single word.'},
    ];

    for (const testCase of cases) {
      const html = renderDisplay(testCase.text, testCase.wordsPerFlash, {
        orpEnabled: true,
        orpColor: '#dc2626',
        fontFamily: 'serif',
        fontWeight: 600,
        textColor: '#111827',
      });

      // Top/bottom axis tick marks sit at left-1/2 -translate-x-1/2; the centered chunk uses
      // flex justify-center inside the same focal-stage box so chunk center === axis center
      expect(html).toContain('data-testid="focal-axis-top"');
      expect(html).toContain('data-testid="focal-axis-bottom"');
      expect(html).toContain('left-1/2 -translate-x-1/2');
      expect(html).toContain('flex w-full items-baseline justify-center');
      expect(html).toContain('data-testid="centered-chunk"');
      expect(html).toContain('whitespace-nowrap text-center');
      expect(html).toContain(`>${testCase.text}</span>`);

      // No ORP split grid, highlight color, or underline on multi-word chunks
      expect(html).not.toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
      expect(html).not.toContain('data-testid="orp-focal-char"');
      expect(html).not.toContain('underline');
      expect(html).not.toContain('#dc2626');

      // Font and color settings preserved
      expect(html).toContain('font-reading-serif');
      expect(html).toContain('font-weight:600');
      expect(html).toContain('color:#111827');
    }
  });

  it('renders 1-word leftover chunks at sentence ends with no highlight when wordsPerFlash is 2, 3, or 4', () => {
    const scenarios: Array<{wordsPerFlash: 2 | 3 | 4; text: string; leftover: string}> = [
      {wordsPerFlash: 2, text: 'Read steadily today. Focus.', leftover: 'Focus.'},
      {wordsPerFlash: 3, text: 'Read steadily right now. Focus.', leftover: 'Focus.'},
      {wordsPerFlash: 4, text: 'Read steadily right here now. Focus.', leftover: 'Focus.'},
    ];

    for (const scenario of scenarios) {
      const {tokens} = tokenize(scenario.text);
      const chunks = buildChunks(tokens, scenario.wordsPerFlash);
      const sentenceEndLeftover = chunks.find(
        (c) => c.tokens.length === 1 && c.text === scenario.leftover
      );
      expect(sentenceEndLeftover).toBeDefined();

      const html = renderChunkDisplay(tokens, sentenceEndLeftover!, scenario.wordsPerFlash, {
        orpEnabled: true,
        orpColor: '#dc2626',
      });

      expect(html).toContain('data-testid="centered-chunk"');
      expect(html).toContain(`>${scenario.leftover}</span>`);
      expect(html).not.toContain('data-testid="orp-focal-char"');
      expect(html).not.toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
      expect(html).not.toContain('underline');
      expect(html).not.toContain('#dc2626');
    }
  });

  it('renders the final 1-word chunk of an odd-word document without highlight when wordsPerFlash is 2', () => {
    const {tokens} = tokenize('One two three four five');
    const chunks = buildChunks(tokens, 2);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.tokens).toHaveLength(1);
    expect(lastChunk.text).toBe('five');

    const html = renderChunkDisplay(tokens, lastChunk, 2, {
      orpEnabled: true,
      orpColor: '#dc2626',
    });

    expect(html).toContain('data-testid="centered-chunk"');
    expect(html).toContain('>five</span>');
    expect(html).not.toContain('data-testid="orp-focal-char"');
    expect(html).not.toContain('underline');
    expect(html).not.toContain('#dc2626');
  });

  it('never renders a highlighted or underlined letter across a full sample text at wordsPerFlash = 2', () => {
    const samplePath = path.resolve(process.cwd(), 'public/samples/meditations-book-4.txt');
    const sampleText = fs.readFileSync(samplePath, 'utf8');
    const {tokens} = tokenize(sampleText);
    const chunks = buildChunks(tokens, 2);

    const singleWordChunks = chunks.filter((c) => c.tokens.length === 1);
    expect(chunks.length).toBeGreaterThan(50);
    expect(singleWordChunks.length).toBeGreaterThan(0);

    for (const chunk of chunks) {
      const html = renderChunkDisplay(tokens, chunk, 2, {
        orpEnabled: true,
        orpColor: '#dc2626',
      });
      expect(html).toContain('data-testid="centered-chunk"');
      expect(html).not.toContain('data-testid="orp-focal-char"');
      expect(html).not.toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
      expect(html).not.toContain('underline');
      expect(html).not.toContain('#dc2626');
    }
  });

  it('keeps fixed stage height, axis tick positions, font-size, and vertical centering identical across varied chunks', () => {
    const documentText =
      'it is. typography. antidisestablishmentarianism. read every single word.';
    const {tokens} = tokenize(documentText);
    const expectedBaseFont = computeBaseFontSize(44);
    const expectedStageHeight = `calc(var(--reader-base-font) * ${STAGE_HEIGHT_MULTIPLIER})`;

    const sequences: Array<{chunkSize: ChunkSize; text: string}> = [
      {chunkSize: 1, text: 'it'},
      {chunkSize: 1, text: 'typography.'},
      {chunkSize: 1, text: 'antidisestablishmentarianism.'},
      {chunkSize: 2, text: 'it is.'},
      {chunkSize: 2, text: 'typography.'},
      {chunkSize: 4, text: 'read every single word.'},
    ];

    const stageStyles: string[] = [];
    const fontSizes: string[] = [];
    const lineHeights: string[] = [];

    for (const entry of sequences) {
      const {tokens: entryTokens, chunk} = makeChunk(entry.text, entry.chunkSize);
      const html = renderChunkDisplay(
        entryTokens,
        chunk,
        entry.chunkSize,
        {fontSize: 44, contextPane: 'faded'},
        true
      );

      const stageStyle = extractStageStyle(html);
      const textStyle = extractTextBoxStyle(html);
      const fontMatch = textStyle.match(/font-size:([^;]+)/);
      const lineMatch = textStyle.match(/line-height:([^;]+)/);

      stageStyles.push(stageStyle);
      fontSizes.push(fontMatch ? fontMatch[1] : '');
      lineHeights.push(lineMatch ? lineMatch[1] : '');

      expect(stageStyle).toContain(`--reader-base-font:${expectedBaseFont}`);
      expect(stageStyle).toContain(`height:${expectedStageHeight}`);
      expect(stageStyle).toContain('box-sizing:border-box');
      expect(html).toContain('absolute inset-0 flex items-center justify-center');
      expect(html).toContain('data-testid="focal-axis-top"');
      expect(html).toContain('top-0 left-1/2 -translate-x-1/2');
      expect(html).toContain('data-testid="focal-axis-bottom"');
      expect(html).toContain('bottom-0 left-1/2 -translate-x-1/2');
      expect(html).toContain('height:1em');
      expect(html).not.toContain('text-ellipsis');
    }

    // Identical stage style, font-size, and 1em line box across every chunk (1w, 4w, long word, descenders)
    expect(new Set(stageStyles).size).toBe(1);
    expect(new Set(fontSizes).size).toBe(1);
    expect(fontSizes[0]).toBe(expectedBaseFont);
    expect(new Set(lineHeights).size).toBe(1);
    expect(lineHeights[0]).toBe('1');

    // Stage resizes only when the user changes fontSize setting
    const largerHtml = renderChunkDisplay(tokens, getChunkAt(tokens, 0, 1), 1, {fontSize: 56});
    expect(extractStageStyle(largerHtml)).toContain(`--reader-base-font:${computeBaseFontSize(56)}`);
    expect(extractTextBoxStyle(largerHtml)).toContain(`font-size:${computeBaseFontSize(56)}`);
  });

  it('computes one session transform scale from the longest chunk and clamps to MIN_CHUNK_SCALE', () => {
    const {tokens} = tokenize('Short words. The internationalization experiment continues.');
    const longest = findLongestChunkForSession(tokens, 3, true);
    expect(longest.text).toBe('The internationalization experiment');

    // Shrinks via scale factor without changing font-size
    expect(computeTransformScale(343, 520)).toBe(0.651);
    // Clamped to MIN_CHUNK_SCALE (0.6) for extreme strings
    expect(computeTransformScale(343, 900)).toBe(MIN_CHUNK_SCALE);
    // Leaves scale at 1 when longest chunk already fits inside stage width
    expect(computeTransformScale(680, 520)).toBe(1);
  });
});
