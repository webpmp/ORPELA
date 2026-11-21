import {X} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {BookCoverTone} from '../content/publicDomainCatalog';
import {
  buildOpenLibraryCoverUrl,
  extractCoverCandidatesFromIdentifiers,
  resolveBookCover,
  type OpenLibraryCoverIdentifier,
  type OpenLibraryCoverIdentifiers,
  type OpenLibraryCoverSize,
} from '../services/openLibraryCovers';

const COVER_TONE_CLASSES: Record<BookCoverTone, string> = {
  slate: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/20',
  amber: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25',
  rose: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/25',
  emerald: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
  indigo: 'bg-indigo-500/12 text-indigo-800 dark:text-indigo-300 border-indigo-500/25',
  red: 'bg-red-500/12 text-red-800 dark:text-red-300 border-red-500/25',
  teal: 'bg-teal-500/12 text-teal-800 dark:text-teal-300 border-teal-500/25',
  sky: 'bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-500/25',
  purple: 'bg-purple-500/12 text-purple-800 dark:text-purple-300 border-purple-500/25',
  violet: 'bg-violet-500/12 text-violet-800 dark:text-violet-300 border-violet-500/25',
  stone: 'bg-stone-500/12 text-stone-700 dark:text-stone-300 border-stone-500/25',
  blue: 'bg-blue-500/12 text-blue-800 dark:text-blue-300 border-blue-500/25',
};

const SIZE_CLASSES: Record<OpenLibraryCoverSize, string> = {
  S: 'h-12 w-8 rounded-md',
  M: 'h-16 w-11 rounded-lg',
  L: 'w-48 sm:w-56 aspect-[2/3] rounded-xl',
};

export function getBookMonogram(title: string): string {
  const words = title
    .replace(/^(The|A|An)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'BK';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export interface BookCoverPreviewData {
  title: string;
  author?: string;
  publicationYear?: string;
  edition?: string;
  sourceName?: string;
  coverTone: BookCoverTone;
  identifier: OpenLibraryCoverIdentifier;
  triggerElement?: HTMLElement | null;
}

interface BookCoverProps {
  title: string;
  author?: string;
  publicationYear?: string;
  edition?: string;
  sourceName?: string;
  coverTone?: BookCoverTone;
  identifiers?: OpenLibraryCoverIdentifiers;
  size?: OpenLibraryCoverSize;
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  onInspect?: (preview: BookCoverPreviewData) => void;
}

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  publicationYear,
  edition,
  sourceName,
  coverTone = 'slate',
  identifiers,
  size = 'M',
  scrollRootRef,
  onInspect,
}) => {
  const directCandidates = extractCoverCandidatesFromIdentifiers(identifiers);
  const directKey = directCandidates.map((c) => `${c.key}:${c.value}`).join('|');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(directCandidates.length > 0);
  const [candidates, setCandidates] = useState<OpenLibraryCoverIdentifier[]>(directCandidates);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Lazily trigger cover lookup only when the book card approaches or enters the scroll viewport
  useEffect(() => {
    if (directCandidates.length > 0) {
      setIsVisible(true);
      return;
    }

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: scrollRootRef?.current ?? null,
        rootMargin: '120px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [directKey, scrollRootRef]);

  // Resolve Open Library cover identifiers once visible
  useEffect(() => {
    const initial = extractCoverCandidatesFromIdentifiers(identifiers);
    if (initial.length > 0) {
      setCandidates(initial);
      setCandidateIndex(0);
      setImageLoaded(false);
      return;
    }

    if (!isVisible) return;

    const controller = new AbortController();
    let active = true;

    void resolveBookCover({
      title,
      author,
      identifiers,
      signal: controller.signal,
    }).then((resolution) => {
      if (!active) return;
      setCandidates(resolution.candidates);
      setCandidateIndex(0);
      setImageLoaded(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isVisible, title, author, directKey]);

  const activeCandidate = candidates[candidateIndex] ?? null;
  const coverUrl = activeCandidate ? buildOpenLibraryCoverUrl(activeCandidate, size) : null;
  const formattedYear = publicationYear
    ? publicationYear.replace(/^c\.\s*/, '').slice(0, 4)
    : undefined;

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    // Belt-and-suspenders guard against 1x1 transparent placeholders alongside ?default=false
    if (img.naturalWidth > 0 && img.naturalWidth <= 1 && img.naturalHeight <= 1) {
      setImageLoaded(false);
      setCandidateIndex((prev) => prev + 1);
      return;
    }
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setCandidateIndex((prev) => prev + 1);
  };

  const canInspect = Boolean(onInspect && imageLoaded && activeCandidate);

  const coverVisual = (
    <>
      <div
        aria-hidden={imageLoaded ? 'true' : undefined}
        className={`absolute inset-0 flex flex-col items-center justify-center px-1 text-center select-none border ${SIZE_CLASSES[size]} ${COVER_TONE_CLASSES[coverTone]} transition-opacity duration-200 ${
          imageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span
          className={`${size === 'S' ? 'text-[10px]' : 'text-xs'} font-bold tracking-wider leading-none`}
        >
          {getBookMonogram(title)}
        </span>
        {formattedYear && size !== 'S' && (
          <span className="mt-1 text-[9px] font-medium opacity-80 leading-none truncate max-w-full">
            {formattedYear}
          </span>
        )}
      </div>

      {coverUrl && (
        <img
          key={coverUrl}
          src={coverUrl}
          alt={`Cover of ${title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`absolute inset-0 h-full w-full object-cover border border-[var(--border-hairline)] ${SIZE_CLASSES[size]} transition-opacity duration-200 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </>
  );

  if (canInspect && activeCandidate && onInspect) {
    return (
      <div ref={containerRef} className={`relative shrink-0 overflow-hidden ${SIZE_CLASSES[size]}`}>
        <button
          type="button"
          onClick={(event) =>
            onInspect({
              title,
              author,
              publicationYear,
              edition,
              sourceName,
              coverTone,
              identifier: activeCandidate,
              triggerElement: event.currentTarget,
            })
          }
          aria-label={`View larger cover for ${title}`}
          className={`relative block h-full w-full overflow-hidden ${SIZE_CLASSES[size]} cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]`}
        >
          {coverVisual}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden={!imageLoaded}
      className={`relative shrink-0 overflow-hidden ${SIZE_CLASSES[size]}`}
    >
      {coverVisual}
    </div>
  );
};

interface BookCoverModalProps {
  preview: BookCoverPreviewData | null;
  onClose: () => void;
}

export const BookCoverModal: React.FC<BookCoverModalProps> = ({preview, onClose}) => {
  const [useMediumFallback, setUseMediumFallback] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setUseMediumFallback(false);
    setImageFailed(false);
  }, [preview?.identifier.key, preview?.identifier.value]);

  useEffect(() => {
    if (!preview) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      preview.triggerElement?.focus();
    };
  }, [preview, onClose]);

  if (!preview || typeof document === 'undefined') return null;

  const largeUrl = buildOpenLibraryCoverUrl(preview.identifier, useMediumFallback ? 'M' : 'L');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Book cover for ${preview.title}`}
      data-testid="book-cover-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug text-[var(--text-primary)]">
              {preview.title}
            </h2>
            {(preview.author || preview.publicationYear) && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {[preview.author, preview.publicationYear].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close cover preview"
            className="min-h-[40px] min-w-[40px] shrink-0 inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          {!imageFailed ? (
            <img
              key={largeUrl}
              src={largeUrl}
              alt={`Large cover of ${preview.title}`}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => {
                if (!useMediumFallback) {
                  setUseMediumFallback(true);
                } else {
                  setImageFailed(true);
                }
              }}
              className="max-h-[55dvh] w-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] object-contain shadow-sm"
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center border ${SIZE_CLASSES.L} ${COVER_TONE_CLASSES[preview.coverTone]}`}
            >
              <span className="text-2xl font-bold tracking-wider">
                {getBookMonogram(preview.title)}
              </span>
              {preview.publicationYear && (
                <span className="mt-2 text-xs opacity-80">{preview.publicationYear}</span>
              )}
            </div>
          )}
        </div>

        {(preview.edition || preview.sourceName) && (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {[preview.edition, preview.sourceName].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};
