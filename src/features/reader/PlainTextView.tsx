import React, {useMemo} from 'react';
import type {WordToken} from '../../engine/tokenizer';

interface PlainTextViewProps {
  title: string;
  author?: string;
  tokens: readonly WordToken[];
  currentWordIndex: number;
  onJumpToWord: (wordIndex: number) => void;
}

export const PlainTextView: React.FC<PlainTextViewProps> = ({
  title,
  author,
  tokens,
  currentWordIndex,
  onJumpToWord,
}) => {
  const paragraphs = useMemo(() => {
    const groups: Array<{paragraphIndex: number; startIndex: number; text: string}> = [];
    let currentParaIdx = -1;
    let currentStart = 0;
    let words: string[] = [];

    for (const token of tokens) {
      if (token.paragraphIndex !== currentParaIdx) {
        if (words.length > 0) {
          groups.push({
            paragraphIndex: currentParaIdx,
            startIndex: currentStart,
            text: words.join(' '),
          });
        }
        currentParaIdx = token.paragraphIndex;
        currentStart = token.index;
        words = [token.text];
      } else {
        words.push(token.text);
      }
    }

    if (words.length > 0) {
      groups.push({
        paragraphIndex: currentParaIdx,
        startIndex: currentStart,
        text: words.join(' '),
      });
    }

    return groups;
  }, [tokens]);

  const activeParagraphIndex = tokens[currentWordIndex]?.paragraphIndex ?? 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-28 md:pt-34 [@media(max-height:500px)]:pt-24 pb-8 pb-safe">
      <article className="mx-auto max-w-2xl space-y-6">
        <header className="border-b border-[var(--border-hairline)] pb-5">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
          {author && <p className="mt-1 text-sm text-[var(--text-secondary)]">{author}</p>}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Plain scrolling view. Tap any paragraph to resume sequential word display from that
            point.
          </p>
        </header>

        <div className="space-y-5 text-base sm:text-lg leading-relaxed text-[var(--text-primary)] font-reading-serif">
          {paragraphs.map((p) => {
            const isActive = p.paragraphIndex === activeParagraphIndex;
            return (
              <p key={p.paragraphIndex}>
                <button
                  type="button"
                  onClick={() => onJumpToWord(p.startIndex)}
                  className={`text-left w-full rounded-xl p-2 -mx-2 transition-colors hover:bg-[var(--bg-subtle)] ${
                    isActive ? 'bg-[var(--bg-subtle)]/80 ring-1 ring-[var(--border-hairline)]' : ''
                  }`}
                >
                  {p.text}
                </button>
              </p>
            );
          })}
        </div>
      </article>
    </div>
  );
};
