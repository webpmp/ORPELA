import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import React from 'react';
import type {ChunkSize} from '../../engine/chunker';
import type {ProgressStats} from '../../engine/navigation';
import {TIMING_CONSTANTS} from '../../engine/timing';

interface ReaderControlsProps {
  visible: boolean;
  isPlaying: boolean;
  isCountingDown: boolean;
  isPlainView: boolean;
  wpm: number;
  chunkSize: ChunkSize;
  progress: ProgressStats;
  onTogglePlayPause: () => void;
  onRestart: () => void;
  onPrevSentence: () => void;
  onNextSentence: () => void;
  onPrevParagraph: () => void;
  onNextParagraph: () => void;
  onSeekPercentage: (pct: number) => void;
  onAdjustWpm: (delta: number) => void;
  onChunkSizeChange: (size: ChunkSize) => void;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '0s left';
  const total = Math.ceil(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s left`;
  return `${mins}m ${secs}s left`;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  visible,
  isPlaying,
  isCountingDown,
  isPlainView,
  wpm,
  chunkSize,
  progress,
  onTogglePlayPause,
  onRestart,
  onPrevSentence,
  onNextSentence,
  onPrevParagraph,
  onNextParagraph,
  onSeekPercentage,
  onAdjustWpm,
  onChunkSizeChange,
}) => {
  const hiddenDuringPlay = !visible && isPlaying && !isPlainView;

  if (isPlainView) {
    return null;
  }

  return (
    <footer
      data-testid="reader-bottom-controls"
      aria-hidden={hiddenDuringPlay ? true : undefined}
      inert={hiddenDuringPlay ? true : undefined}
      className={`reader-chrome-transition fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md pb-safe transition-opacity duration-200 ${
        hiddenDuringPlay ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="mx-auto max-w-4xl space-y-3 [@media(max-height:500px)]:space-y-1.5 px-4 py-3 [@media(max-height:500px)]:py-1.5 sm:px-6 px-safe">
        {/* Progress Bar & Time Remaining */}
        <div className="space-y-1.5 [@media(max-height:500px)]:space-y-1">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={Number(progress.percentage.toFixed(1))}
            onChange={(e) => onSeekPercentage(Number(e.target.value))}
            aria-label="Reading progress"
            className="w-full h-2 accent-[var(--accent-primary)] cursor-pointer"
          />
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] tabular-nums">
                <span>
                  Word {(progress.wordIndex + 1).toLocaleString()} of{' '}
                  {progress.totalWords.toLocaleString()} ({Math.round(progress.percentage)}%)
                </span>
                <span>{formatRemaining(progress.estimatedSecondsRemaining)}</span>
              </div>
            </div>

            {/* Primary Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Navigation Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onPrevParagraph}
                  aria-label="Previous paragraph"
                  title="Previous paragraph (Shift + Left)"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronsLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onPrevSentence}
                  aria-label="Previous sentence"
                  title="Previous sentence (Left)"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  aria-label={isPlaying || isCountingDown ? 'Pause reading' : 'Play reading'}
                  className="min-h-[48px] min-w-[48px] mx-1 flex items-center justify-center rounded-2xl bg-[var(--accent-primary)] px-4 text-white shadow-sm hover:opacity-90"
                >
                  {isPlaying || isCountingDown ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onNextSentence}
                  aria-label="Next sentence"
                  title="Next sentence (Right)"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onNextParagraph}
                  aria-label="Next paragraph"
                  title="Next paragraph (Shift + Right)"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <ChevronsRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  aria-label="Restart from beginning"
                  title="Restart (R)"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {/* Speed & Chunk Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* WPM +/- */}
                <div className="inline-flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                  <button
                    type="button"
                    onClick={() => onAdjustWpm(-TIMING_CONSTANTS.WPM_STEP)}
                    aria-label="Decrease speed by 25 words per minute"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-l-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)] whitespace-nowrap">
                    {wpm} WPM
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjustWpm(TIMING_CONSTANTS.WPM_STEP)}
                    aria-label="Increase speed by 25 words per minute"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Words per flash selector */}
                <div
                  role="group"
                  aria-label="Words per flash"
                  className="inline-flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5"
                >
                  {([1, 2, 3, 4] as ChunkSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onChunkSizeChange(size)}
                      aria-pressed={chunkSize === size}
                      aria-label={`${size} ${size === 1 ? 'word' : 'words'} per flash`}
                      className={`min-h-[40px] min-w-[36px] rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors ${
                        chunkSize === size
                          ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {size}w
                    </button>
                  ))}
                </div>
              </div>
        </div>
      </div>
    </footer>
  );
};
