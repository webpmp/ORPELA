import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type ChunkSize, type WordChunk, buildChunks, clampChunkSize} from '../../engine/chunker';
import {computeChunkOrp} from '../../engine/orp';
import type {WordToken} from '../../engine/tokenizer';
import type {ReaderSettings} from '../../types';

interface ReaderDisplayProps {
  tokens: readonly WordToken[];
  chunk: WordChunk | null;
  fragmentIndex: 0 | 1;
  isPlaying: boolean;
  isCompleted: boolean;
  countdownRemaining: number;
  settings: ReaderSettings;
  isPhone: boolean;
  onTogglePlayPause: () => void;
  onPrevSentence: () => void;
  onNextSentence: () => void;
  onAdjustWpm: (delta: number) => void;
  onRevealControls: () => void;
}

export const STAGE_HEIGHT_MULTIPLIER = 3;
export const MIN_CHUNK_SCALE = 0.6;

/**
 * Computes one stable base font size from user settings and viewport width.
 * Never depends on the current chunk so the stage height and font size never change mid-session.
 */
export function computeBaseFontSize(baseFontSize: number): string {
  const clampedBase = Math.max(20, Math.round(baseFontSize));
  const minTarget = Math.max(18, Math.round(clampedBase * 0.6));
  return `clamp(${minTarget}px, 7.5vw, ${clampedBase}px)`;
}

export function computeTransformScale(availableWidth: number, requiredWidth: number): number {
  const usableWidth = availableWidth - 4;
  if (usableWidth <= 0 || requiredWidth <= 0 || requiredWidth <= usableWidth) {
    return 1;
  }
  const raw = Math.floor((usableWidth / requiredWidth) * 1000) / 1000;
  return Math.max(MIN_CHUNK_SCALE, Math.min(1, raw));
}

export function findLongestChunkForSession(
  tokens: readonly WordToken[],
  wordsPerFlash: ChunkSize,
  orpEnabled: boolean
): {text: string; words: string[]} {
  if (tokens.length === 0) {
    return {text: '', words: []};
  }

  const size = clampChunkSize(wordsPerFlash);
  const chunks = buildChunks(tokens, size);
  let bestText = '';
  let bestWords: string[] = [];
  let bestScore = -1;

  for (const ch of chunks) {
    if (size === 1 && ch.tokens.length === 1) {
      const tok = ch.tokens[0];
      const candidates =
        tok.fragments.length === 2
          ? tok.fragments.map((frag) => {
              const suffix =
                frag.isContinuation && !frag.text.endsWith('-') && !frag.text.endsWith('—')
                  ? '-'
                  : '';
              return `${frag.text}${suffix}`;
            })
          : [tok.text];

      for (const wordText of candidates) {
        let score = wordText.length;
        if (orpEnabled) {
          const layout = computeChunkOrp([wordText], 1);
          score = Math.max(layout.before.length, layout.after.length) * 2 + 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestText = wordText;
          bestWords = [wordText];
        }
      }
    } else {
      const words = ch.tokens.map((t) => t.text);
      const text = words.join(' ');
      if (text.length > bestScore) {
        bestScore = text.length;
        bestText = text;
        bestWords = words;
      }
    }
  }

  return {text: bestText, words: bestWords};
}

function getFontFamilyClass(fontFamily: string): string {
  switch (fontFamily) {
    case 'serif':
      return 'font-reading-serif';
    case 'dyslexic':
      return 'font-reading-dyslexic';
    case 'mono':
      return 'font-reading-mono';
    case 'system':
      return 'font-reading-system';
    default:
      return 'font-reading-sans';
  }
}

export const ReaderDisplay: React.FC<ReaderDisplayProps> = ({
  tokens,
  chunk,
  fragmentIndex,
  isPlaying,
  isCompleted,
  countdownRemaining,
  settings,
  isPhone,
  onTogglePlayPause,
  onPrevSentence,
  onNextSentence,
  onAdjustWpm,
  onRevealControls,
}) => {
  const touchStartRef = useRef<{x: number; y: number; time: number} | null>(null);
  const suppressTapRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const probeTextRef = useRef<HTMLSpanElement | null>(null);
  const probeBeforeRef = useRef<HTMLSpanElement | null>(null);
  const probeFocalRef = useRef<HTMLSpanElement | null>(null);
  const probeAfterRef = useRef<HTMLSpanElement | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [chunkScale, setChunkScale] = useState(1);

  const displayedWords = useMemo(() => {
    if (!chunk || chunk.tokens.length === 0) return [];
    if (
      settings.wordsPerFlash === 1 &&
      chunk.tokens.length === 1 &&
      chunk.tokens[0].fragments.length === 2
    ) {
      const frag = chunk.tokens[0].fragments[fragmentIndex];
      const suffix =
        frag.isContinuation && !frag.text.endsWith('-') && !frag.text.endsWith('—') ? '-' : '';
      return [`${frag.text}${suffix}`];
    }
    return chunk.tokens.map((t) => t.text);
  }, [chunk, fragmentIndex, settings.wordsPerFlash]);

  const orpLayout = useMemo(
    () => computeChunkOrp(displayedWords, settings.wordsPerFlash),
    [displayedWords, settings.wordsPerFlash]
  );
  const showOrpHighlight =
    settings.orpEnabled && settings.wordsPerFlash === 1 && orpLayout.orpIndex !== null;

  // One fixed base font size for the entire reading session (settings + viewport only)
  const baseFontSize = useMemo(() => computeBaseFontSize(settings.fontSize), [settings.fontSize]);

  // Longest chunk in the open document for the current wordsPerFlash setting, used to compute
  // one stable transform scale per session so text never flickers in size between chunks.
  const longestSessionChunk = useMemo(
    () => findLongestChunkForSession(tokens, settings.wordsPerFlash, settings.orpEnabled),
    [tokens, settings.wordsPerFlash, settings.orpEnabled]
  );
  const longestProbeOrp = useMemo(() => {
    if (longestSessionChunk.words.length === 0) return null;
    return computeChunkOrp(longestSessionChunk.words, settings.wordsPerFlash);
  }, [longestSessionChunk.words, settings.wordsPerFlash]);

  useLayoutEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? stageEl.clientWidth;
      setStageWidth((prev) => (Math.abs(prev - width) > 0.5 ? width : prev));
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl || !longestSessionChunk.text) {
      setChunkScale(1);
      return;
    }

    const availableWidth = stageEl.clientWidth;
    if (availableWidth <= 0) {
      setChunkScale(1);
      return;
    }

    let requiredWidth = 0;
    const probeUsesOrp =
      settings.orpEnabled && settings.wordsPerFlash === 1 && longestProbeOrp?.orpIndex !== null;

    if (probeUsesOrp) {
      const beforeW = probeBeforeRef.current?.getBoundingClientRect().width ?? 0;
      const focalW = probeFocalRef.current?.getBoundingClientRect().width ?? 0;
      const afterW = probeAfterRef.current?.getBoundingClientRect().width ?? 0;
      requiredWidth = Math.max(beforeW, afterW) * 2 + focalW;
    } else {
      requiredWidth = probeTextRef.current?.getBoundingClientRect().width ?? 0;
    }

    const nextScale = computeTransformScale(availableWidth, requiredWidth);
    setChunkScale((prev) => (prev === nextScale ? prev : nextScale));
  }, [
    baseFontSize,
    longestProbeOrp?.orpIndex,
    longestSessionChunk.text,
    settings.fontFamily,
    settings.fontWeight,
    settings.orpEnabled,
    settings.readingWidth,
    settings.wordsPerFlash,
    stageWidth,
  ]);

  // Surrounding paragraph words for optional faded context pane
  const contextParagraphTokens = useMemo(() => {
    if (settings.contextPane !== 'faded' || !chunk || chunk.tokens.length === 0) {
      return [];
    }
    const pIndex = chunk.tokens[0].paragraphIndex;
    const inPara = tokens.filter((t) => t.paragraphIndex === pIndex);
    // Keep window manageable on very long paragraphs
    if (inPara.length <= 90) return inPara;
    const currentPos = inPara.findIndex((t) => t.index === chunk.startIndex);
    const start = Math.max(0, currentPos - 35);
    const end = Math.min(inPara.length, start + 75);
    return inPara.slice(start, end);
  }, [settings.contextPane, chunk, tokens]);

  const showContextPane = settings.contextPane === 'faded' && (!isPhone || !isPlaying);

  const handleTouchStart = (e: React.TouchEvent) => {
    onRevealControls();
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {x: touch.clientX, y: touch.clientY, time: Date.now()};
    suppressTapRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 48 && absX > absY * 1.4) {
      suppressTapRef.current = true;
      if (dx < 0) {
        onNextSentence();
      } else {
        onPrevSentence();
      }
      return;
    }

    if (absY > 48 && absY > absX * 1.4) {
      suppressTapRef.current = true;
      if (dy < 0) {
        onAdjustWpm(25);
      } else {
        onAdjustWpm(-25);
      }
    }
  };

  const handleClick = () => {
    onRevealControls();
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    onTogglePlayPause();
  };

  const fontClass = getFontFamilyClass(settings.fontFamily);
  const probeUsesOrp =
    settings.orpEnabled && settings.wordsPerFlash === 1 && longestProbeOrp?.orpIndex !== null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onMouseMove={onRevealControls}
      role="region"
      aria-label="Reading focal display. Tap or press Space to play or pause."
      className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-8 select-none cursor-pointer overflow-hidden"
    >
      {/* Focal Stage Wrapper (anchors optional out-of-flow faded context pane above stage) */}
      <div
        style={{maxWidth: `${settings.readingWidth}px`}}
        className="relative w-full flex flex-col items-center"
      >
        {/* Optional Faded Context Pane (out-of-flow above focal stage so toggling never shifts stage) */}
        {showContextPane && contextParagraphTokens.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-0 right-0 mb-6 sm:mb-8 mx-auto max-w-2xl text-center text-sm sm:text-base leading-relaxed opacity-35 transition-opacity line-clamp-3"
          >
            {contextParagraphTokens.map((t) => {
              const isCurrent =
                chunk && t.index >= chunk.startIndex && t.index <= chunk.endIndex;
              return (
                <span
                  key={t.index}
                  className={isCurrent ? 'font-semibold opacity-100 underline decoration-1' : ''}
                >
                  {t.text}{' '}
                </span>
              );
            })}
          </div>
        )}

        {/* Fixed-Height Focal Stage */}
        <div
          ref={stageRef}
          data-testid="focal-stage"
          style={
            {
              '--reader-base-font': baseFontSize,
              height: `calc(var(--reader-base-font) * ${STAGE_HEIGHT_MULTIPLIER})`,
              boxSizing: 'border-box',
            } as React.CSSProperties
          }
          className="relative w-full border-y border-[var(--border-hairline)]/60"
        >
          {/* Top & Bottom Focal Reticle Axis Marks */}
          <div
            aria-hidden="true"
            data-testid="focal-axis-top"
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-3.5 w-0.5 bg-[var(--text-muted)]/60"
          />
          <div
            aria-hidden="true"
            data-testid="focal-axis-bottom"
            className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-3.5 w-0.5 bg-[var(--text-muted)]/60"
          />

          {/* Off-flow probe measuring the longest chunk in the session */}
          {longestSessionChunk.text && (
            <div
              aria-hidden="true"
              style={{
                fontSize: baseFontSize,
                fontWeight: settings.fontWeight,
              }}
              className={`pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap leading-none tracking-normal ${fontClass}`}
            >
              {probeUsesOrp && longestProbeOrp ? (
                <span>
                  <span ref={probeBeforeRef}>{longestProbeOrp.before}</span>
                  <span ref={probeFocalRef} className="font-bold">
                    {longestProbeOrp.focalChar}
                  </span>
                  <span ref={probeAfterRef}>{longestProbeOrp.after}</span>
                </span>
              ) : (
                <span ref={probeTextRef}>{longestSessionChunk.text}</span>
              )}
            </div>
          )}

          {/* Absolutely centered content slot so stage borders and axis marks never shift */}
          <div className="absolute inset-0 flex items-center justify-center">
            {countdownRemaining > 0 ? (
              <div
                className="text-4xl sm:text-5xl font-semibold tabular-nums leading-none text-[var(--accent-primary)]"
                aria-label={`Starting in ${countdownRemaining}`}
              >
                {countdownRemaining}
              </div>
            ) : orpLayout.fullText ? (
              <div
                data-testid="focal-text-box"
                style={{
                  fontSize: baseFontSize,
                  fontWeight: settings.fontWeight,
                  color: settings.textColor || undefined,
                  height: '1em',
                  lineHeight: 1,
                  transform: chunkScale < 1 ? `scale(${chunkScale})` : undefined,
                  transformOrigin: 'center center',
                }}
                className={`w-full flex items-center justify-center leading-none tracking-normal ${fontClass}`}
              >
                {showOrpHighlight ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline w-full leading-none">
                    <span className="flex justify-end whitespace-pre leading-none">
                      {orpLayout.before}
                    </span>
                    <span
                      data-testid="orp-focal-char"
                      style={{color: settings.orpColor || 'var(--orp-default)'}}
                      className="font-bold underline decoration-2 underline-offset-8 text-center leading-none"
                    >
                      {orpLayout.focalChar}
                    </span>
                    <span className="flex justify-start whitespace-pre leading-none">
                      {orpLayout.after}
                    </span>
                  </div>
                ) : (
                  <div className="flex w-full items-baseline justify-center leading-none">
                    <span
                      data-testid="centered-chunk"
                      className="inline-block whitespace-nowrap text-center leading-none"
                    >
                      {orpLayout.fullText}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-base leading-none text-[var(--text-secondary)]">
                No text loaded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reserved fixed-height status cue below stage so mounting/clearing text never shifts stage */}
      <div className="mt-6 h-6 flex items-center justify-center text-xs leading-6 whitespace-nowrap text-[var(--text-secondary)]">
        {isCompleted
          ? 'Finished passage — tap or press Space to read again'
          : !isPlaying && countdownRemaining === 0
            ? 'Paused — tap display or press Space to play'
            : ''}
      </div>
    </div>
  );
};
