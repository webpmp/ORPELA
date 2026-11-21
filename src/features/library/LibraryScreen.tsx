import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  Play,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BookCover, BookCoverModal, type BookCoverPreviewData} from '../../components/BookCover';
import {WelcomeModal} from '../../components/WelcomeModal';
import {WELCOME_SEEN_KEY} from '../../content/guidance';
import {
  PUBLIC_DOMAIN_BOOKS,
  PUBLIC_DOMAIN_EXCERPTS,
  type PublicDomainBook,
  type PublicDomainExcerpt,
} from '../../content/publicDomainCatalog';
import {useAppContext} from '../../context/AppContext';
import {SAMPLE_PASSAGES, type SamplePassage} from '../../services/samples';
import {computeAggregateStats} from '../../services/sessions';
import {
  READING_DESCRIPTIONS,
  type DocumentWithProgress,
  type LibraryDocument,
  type ReadingDescription,
} from '../../types';

interface LibraryScreenProps {
  onNavigate: (path: string) => void;
}

type SortKey = 'recent' | 'title';
type DescriptionFilter = 'all' | ReadingDescription;

const DESCRIPTION_BADGE_CLASSES: Record<ReadingDescription, string> = {
  Accessible:
    'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  Intermediate:
    'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  Advanced:
    'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  Expert:
    'border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-300',
};

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  if (mins === 0) return `${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${mins}m ${secs}s`;
}

function matchesSearch(query: string, fields: Array<string | undefined>): boolean {
  if (!query) return true;
  return fields.some((field) => field && field.toLowerCase().includes(query));
}

function findLinkedBook(
  doc: LibraryDocument,
  bookById: Map<string, PublicDomainBook>
): PublicDomainBook | undefined {
  if (doc.bookId) {
    const direct = bookById.get(doc.bookId);
    if (direct) return direct;
  }

  const normalizedDocTitle = doc.title.trim().toLowerCase();
  const normalizedBookTitle = doc.bookTitle?.trim().toLowerCase();

  for (const sample of SAMPLE_PASSAGES) {
    if (
      (doc.excerptId && doc.excerptId === sample.id) ||
      (doc.sourceMeta?.fileName && doc.sourceMeta.fileName === sample.filePath) ||
      normalizedDocTitle === sample.title.toLowerCase()
    ) {
      return bookById.get(sample.bookId);
    }
  }

  for (const book of PUBLIC_DOMAIN_BOOKS) {
    const lowerTitle = book.title.toLowerCase();
    if (
      normalizedBookTitle === lowerTitle ||
      normalizedDocTitle === lowerTitle ||
      normalizedDocTitle.startsWith(`${lowerTitle}:`) ||
      normalizedDocTitle.startsWith(`${lowerTitle} —`) ||
      normalizedDocTitle.startsWith(`${lowerTitle} –`) ||
      normalizedDocTitle.startsWith(`${lowerTitle} -`)
    ) {
      return book;
    }
  }

  return undefined;
}

function getPreferredScrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function scrollContainerTo(container: HTMLElement, top: number, behavior: ScrollBehavior): void {
  const clampedTop = Math.max(0, top);
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({top: clampedTop, behavior});
  } else {
    container.scrollTop = clampedTop;
  }
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({onNavigate}) => {
  const {
    isReady,
    documents,
    sessions,
    loadSamplePassage,
    openPublicDomainExcerpt,
    updateSettings,
    deleteDocumentWithUndo,
    showToast,
    welcomeReopenRequested,
    markWelcomeShownThisVisit,
    consumeWelcomeReopenRequest,
  } = useAppContext();

  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [selectedDescription, setSelectedDescription] = useState<DescriptionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBookIds, setExpandedBookIds] = useState<Record<string, boolean>>({});
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [loadingExcerptId, setLoadingExcerptId] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tryingWelcomeSample, setTryingWelcomeSample] = useState(false);
  const [coverPreview, setCoverPreview] = useState<BookCoverPreviewData | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bookListRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const bookCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pendingScrollBookIdRef = useRef<string | null>(null);
  const pendingScrollTopRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    let shouldOpen = welcomeReopenRequested;
    if (!shouldOpen) {
      try {
        shouldOpen = localStorage.getItem(WELCOME_SEEN_KEY) !== '1';
      } catch {
        shouldOpen = false;
      }
    }
    if (shouldOpen) {
      setWelcomeOpen(true);
      markWelcomeShownThisVisit();
    }
    if (welcomeReopenRequested) {
      consumeWelcomeReopenRequest();
    }
  }, [isReady, welcomeReopenRequested, markWelcomeShownThisVisit, consumeWelcomeReopenRequest]);

  const markWelcomeSeen = () => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Ignore storage failure
    }
  };

  const handleDismissWelcome = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  const handleTrySampleFromWelcome = async () => {
    setTryingWelcomeSample(true);
    try {
      markWelcomeSeen();
      const doc = await loadSamplePassage(SAMPLE_PASSAGES[0]);
      await updateSettings({wordsPerFlash: 1, wpm: 250});
      setWelcomeOpen(false);
      onNavigate(`/read/${encodeURIComponent(doc.id)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load sample text.');
    } finally {
      setTryingWelcomeSample(false);
    }
  };

  const stats = useMemo(() => computeAggregateStats(sessions), [sessions]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Map saved documents by excerptId so catalog rows can display Resume & progress seamlessly
  const savedByExcerptId = useMemo(() => {
    const map = new Map<string, DocumentWithProgress>();
    for (const entry of documents) {
      if (entry.document.excerptId) {
        map.set(entry.document.excerptId, entry);
      } else if (
        entry.document.sourceMeta?.fileName === SAMPLE_PASSAGES[0].filePath ||
        entry.document.title === SAMPLE_PASSAGES[0].title
      ) {
        map.set(SAMPLE_PASSAGES[0].id, entry);
      }
    }
    return map;
  }, [documents]);

  // Filter & sort saved documents using the unified Search, Description, and Sort controls
  const filteredSavedDocs = useMemo(() => {
    const filtered = documents.filter(({document: doc}) => {
      if (selectedDescription !== 'all' && doc.description !== selectedDescription) {
        return false;
      }
      return matchesSearch(normalizedQuery, [
        doc.title,
        doc.author,
        doc.bookTitle,
        doc.description,
      ]);
    });

    if (sortBy === 'title') {
      filtered.sort((a, b) => a.document.title.localeCompare(b.document.title));
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.progress?.updatedAt ?? b.document.createdAt).getTime() -
          new Date(a.progress?.updatedAt ?? a.document.createdAt).getTime()
      );
    }
    return filtered;
  }, [documents, selectedDescription, normalizedQuery, sortBy]);

  const bookById = useMemo(() => {
    const map = new Map<string, PublicDomainBook>();
    for (const book of PUBLIC_DOMAIN_BOOKS) {
      map.set(book.id, book);
    }
    return map;
  }, []);

  // Group and filter the 22 public-domain books & their excerpts (including the preserved default excerpt)
  const excerptsByBookId = useMemo(() => {
    const map = new Map<string, PublicDomainExcerpt[]>();
    for (const excerpt of PUBLIC_DOMAIN_EXCERPTS) {
      const list = map.get(excerpt.bookId) ?? [];
      list.push(excerpt);
      map.set(excerpt.bookId, list);
    }
    return map;
  }, []);

  // Compute Description filter counts respecting the active search query
  const descriptionCounts = useMemo(() => {
    const counts: Record<DescriptionFilter, number> = {
      all: 0,
      Accessible: 0,
      Intermediate: 0,
      Advanced: 0,
      Expert: 0,
    };
    for (const book of PUBLIC_DOMAIN_BOOKS) {
      const excerpts = excerptsByBookId.get(book.id) ?? [];
      for (const ex of excerpts) {
        const match = matchesSearch(normalizedQuery, [
          book.title,
          book.author,
          book.publicationYear,
          ex.title,
          ex.description,
        ]);
        if (match) {
          counts.all += 1;
          counts[ex.description] += 1;
        }
      }
    }
    return counts;
  }, [excerptsByBookId, normalizedQuery]);

  const filteredBooks = useMemo(() => {
    const entries: Array<{book: PublicDomainBook; excerpts: PublicDomainExcerpt[]}> = [];

    for (const book of PUBLIC_DOMAIN_BOOKS) {
      const allBookExcerpts = excerptsByBookId.get(book.id) ?? [];
      const bookMatchesSearch = matchesSearch(normalizedQuery, [
        book.title,
        book.author,
        book.publicationYear,
        book.edition,
      ]);

      const matchingExcerpts = allBookExcerpts.filter((ex) => {
        if (selectedDescription !== 'all' && ex.description !== selectedDescription) {
          return false;
        }
        if (!normalizedQuery) return true;
        return (
          bookMatchesSearch ||
          matchesSearch(normalizedQuery, [ex.title, ex.description])
        );
      });

      if (matchingExcerpts.length > 0) {
        entries.push({book, excerpts: matchingExcerpts});
      }
    }

    if (sortBy === 'title') {
      entries.sort((a, b) => a.book.title.localeCompare(b.book.title));
    }

    return entries;
  }, [excerptsByBookId, selectedDescription, normalizedQuery, sortBy]);

  const totalMatchingExcerpts = useMemo(
    () => filteredBooks.reduce((sum, entry) => sum + entry.excerpts.length, 0),
    [filteredBooks]
  );

  const allBooksCollapsed =
    filteredBooks.length > 0 &&
    filteredBooks.every(({book}) => !expandedBookIds[book.id]);

  const updateBottomFade = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      setShowBottomFade(false);
      return;
    }
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    const hasOverflowBelow = el.scrollHeight > el.clientHeight + 2 && remaining > 2;
    setShowBottomFade(hasOverflowBelow);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!isReady || !container) {
      setShowBottomFade(false);
      return;
    }

    updateBottomFade();

    let rafId: number | null = null;
    let rafPending = false;
    const handleScroll = () => {
      if (rafPending) return;
      rafPending = true;
      rafId = window.requestAnimationFrame(() => {
        rafPending = false;
        rafId = null;
        updateBottomFade();
      });
    };

    container.addEventListener('scroll', handleScroll, {passive: true});

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateBottomFade();
      });
      resizeObserver.observe(container);
      if (bookListRef.current) {
        resizeObserver.observe(bookListRef.current);
      }
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && bottomSentinelRef.current) {
      intersectionObserver = new IntersectionObserver(
        () => {
          updateBottomFade();
        },
        {root: container, threshold: 0}
      );
      intersectionObserver.observe(bottomSentinelRef.current);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafPending && rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [isReady, filteredBooks.length, updateBottomFade]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (pendingScrollTopRef.current) {
      pendingScrollTopRef.current = false;
      scrollContainerTo(container, 0, getPreferredScrollBehavior());
      updateBottomFade();
      return;
    }

    const bookId = pendingScrollBookIdRef.current;
    if (bookId) {
      pendingScrollBookIdRef.current = null;
      const card = bookCardRefs.current.get(bookId);
      if (card) {
        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        if (containerRect.height > 0) {
          const edgePadding = 12;
          if (cardRect.top < containerRect.top) {
            const delta = cardRect.top - containerRect.top - edgePadding;
            scrollContainerTo(
              container,
              container.scrollTop + delta,
              getPreferredScrollBehavior()
            );
          } else if (cardRect.bottom > containerRect.bottom) {
            const overflowBottom = cardRect.bottom - containerRect.bottom + edgePadding;
            const maxShiftKeepingTopVisible = Math.max(
              0,
              cardRect.top - containerRect.top - edgePadding
            );
            const delta = Math.min(overflowBottom, maxShiftKeepingTopVisible);
            if (delta > 0) {
              scrollContainerTo(
                container,
                container.scrollTop + delta,
                getPreferredScrollBehavior()
              );
            }
          }
        }
      }
    }

    updateBottomFade();
  }, [expandedBookIds, updateBottomFade]);

  const handleToggleAllBooks = () => {
    pendingScrollBookIdRef.current = null;
    if (allBooksCollapsed) {
      const next: Record<string, boolean> = {};
      for (const {book} of filteredBooks) {
        next[book.id] = true;
      }
      setExpandedBookIds(next);
    } else {
      pendingScrollTopRef.current = true;
      setExpandedBookIds({});
    }
  };

  const handleToggleBook = (bookId: string) => {
    const willExpand = !expandedBookIds[bookId];
    if (willExpand) {
      pendingScrollBookIdRef.current = bookId;
    }
    setExpandedBookIds((prev) => ({
      ...prev,
      [bookId]: !prev[bookId],
    }));
  };

  const handleLoadSample = async (sample: SamplePassage, openImmediately = false) => {
    setLoadingSampleId(sample.id);
    try {
      const doc = await loadSamplePassage(sample);
      if (openImmediately) {
        onNavigate(`/read/${encodeURIComponent(doc.id)}`);
      } else {
        showToast(`Added "${doc.title}" to your library.`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load sample text.');
    } finally {
      setLoadingSampleId(null);
    }
  };

  const handleOpenExcerpt = async (excerpt: PublicDomainExcerpt) => {
    const existing = savedByExcerptId.get(excerpt.id);
    if (existing) {
      onNavigate(`/read/${encodeURIComponent(existing.document.id)}`);
      return;
    }

    setLoadingExcerptId(excerpt.id);
    try {
      const doc = await openPublicDomainExcerpt(excerpt.id);
      onNavigate(`/read/${encodeURIComponent(doc.id)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open excerpt.');
    } finally {
      setLoadingExcerptId(null);
    }
  };

  const handleResetFilters = () => {
    setSelectedDescription('all');
    setSearchQuery('');
  };

  if (!isReady) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
        Loading your local library…
      </div>
    );
  }

  const hasActiveFilter = selectedDescription !== 'all' || normalizedQuery.length > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-hairline)] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Library
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Stored locally on this device. No accounts or external servers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Sort documents"
            className="inline-flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1"
          >
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              className={`min-h-[38px] rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                sortBy === 'recent'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Date Added
            </button>
            <button
              type="button"
              onClick={() => setSortBy('title')}
              className={`min-h-[38px] rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                sortBy === 'title'
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Title
            </button>
          </div>

          <button
            type="button"
            disabled={loadingSampleId !== null}
            onClick={() => void handleLoadSample(SAMPLE_PASSAGES[0], false)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>{loadingSampleId ? 'Loading…' : 'Load sample text'}</span>
          </button>
        </div>
      </section>

      {/* Honest Session Summary (only when user has completed sessions) */}
      {stats.totalSessions > 0 && (
        <section
          aria-label="Reading statistics"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <div className="text-xs text-[var(--text-secondary)]">Words read</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
              {stats.totalWordsRead.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <div className="text-xs text-[var(--text-secondary)]">Active time</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
              {formatDuration(stats.totalActiveSeconds)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <div className="text-xs text-[var(--text-secondary)]">Average pace</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
              {stats.averageWpm > 0 ? `${stats.averageWpm} WPM` : '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <div className="text-xs text-[var(--text-secondary)]">Sessions</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
              {stats.totalSessions}
            </div>
          </div>
        </section>
      )}

      {/* Saved / In-Progress Documents */}
      {documents.length > 0 && (
        <section aria-label="Saved documents" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Your Saved Reading
            </h2>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {filteredSavedDocs.length} of {documents.length}
            </span>
          </div>

          {filteredSavedDocs.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-sm text-[var(--text-secondary)]">
              No saved documents match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              {filteredSavedDocs.map(({document: doc, progress}) => {
                const wordIndex = progress?.wordIndex ?? 0;
                const pct =
                  doc.totalWords <= 1
                    ? 0
                    : Math.min(100, Math.round((wordIndex / (doc.totalWords - 1)) * 100));
                const isConfirming = confirmDeleteId === doc.id;
                const linkedBook = findLinkedBook(doc, bookById);
                const showSavedCover = Boolean(linkedBook || doc.author);

                return (
                  <article
                    key={doc.id}
                    className="flex flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--bg-canvas)]/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {showSavedCover && (
                        <BookCover
                          title={linkedBook?.title ?? doc.bookTitle ?? doc.title}
                          author={linkedBook?.author ?? doc.author}
                          publicationYear={linkedBook?.publicationYear ?? doc.publicationYear}
                          edition={linkedBook?.edition}
                          sourceName={linkedBook?.sourceName ?? doc.sourceAttribution}
                          coverTone={linkedBook?.coverTone ?? 'slate'}
                          identifiers={linkedBook?.coverIdentifiers}
                          size="S"
                          onInspect={setCoverPreview}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/read/${encodeURIComponent(doc.id)}`)}
                          className="text-left block w-full group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)]">
                              {doc.title}
                            </h3>
                          {doc.description && (
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${DESCRIPTION_BADGE_CLASSES[doc.description]}`}
                            >
                              {doc.description}
                            </span>
                          )}
                        </div>
                        {doc.author && (
                          <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
                            {doc.author}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)] tabular-nums">
                          <span>{doc.totalWords.toLocaleString()} words</span>
                          <span aria-hidden="true">·</span>
                          <span>{pct}% read</span>
                          <span aria-hidden="true">·</span>
                          <span>{doc.source.toUpperCase()}</span>
                        </div>
                      </button>

                      {/* Subtle progress bar */}
                      <div
                        className="mt-3 h-1 w-full max-w-md rounded-full bg-[var(--bg-subtle)] overflow-hidden"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full bg-[var(--accent-primary)]"
                          style={{width: `${pct}%`}}
                        />
                      </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/read/${encodeURIComponent(doc.id)}`)}
                        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] whitespace-nowrap hover:opacity-90"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>{wordIndex > 0 ? 'Resume' : 'Read'}</span>
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              void deleteDocumentWithUndo(doc.id);
                            }}
                            className="min-h-[44px] rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(doc.id)}
                          aria-label={`Delete ${doc.title}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-red-600 hover:bg-[var(--bg-subtle)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Unified Search & Description Filter Bar */}
      <section
        aria-label="Filter library"
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search library"
            placeholder="Search books, authors, or excerpts…"
            className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)] mr-1">
              Description
            </span>
            <div
              role="group"
              aria-label="Filter by Description"
              className="flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                data-testid="description-filter-all"
                aria-pressed={selectedDescription === 'all'}
                onClick={() => setSelectedDescription('all')}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedDescription === 'all'
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>All Descriptions</span>
                <span className="tabular-nums opacity-75">{descriptionCounts.all}</span>
              </button>

              {READING_DESCRIPTIONS.map((desc) => {
                const active = selectedDescription === desc;
                return (
                  <button
                    key={desc}
                    type="button"
                    data-testid={`description-filter-${desc}`}
                    aria-pressed={active}
                    onClick={() => setSelectedDescription(desc)}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{desc}</span>
                    <span className="tabular-nums opacity-75">{descriptionCounts[desc]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="self-start sm:self-auto min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* Curated Public-Domain Reading Collection: header stays fixed above a bounded scrollable book list */}
      <section aria-label="Public-domain collection" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Public-Domain Collection
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)] tabular-nums">
              Showing {totalMatchingExcerpts} {totalMatchingExcerpts === 1 ? 'excerpt' : 'excerpts'}{' '}
              across {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
              {selectedDescription !== 'all' ? ` · Description: ${selectedDescription}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {documents.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigate('/import')}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs sm:text-sm font-medium text-white hover:opacity-90"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Paste or import file</span>
              </button>
            )}
            {filteredBooks.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAllBooks}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] whitespace-nowrap"
              >
                {allBooksCollapsed ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Expand all</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Collapse all</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No public-domain excerpts match your current search and Description filter.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              Show all descriptions
            </button>
          </div>
        ) : (
          <div className="relative w-full min-w-0">
            <div
              ref={scrollContainerRef}
              data-testid="public-domain-scroll"
              role="region"
              aria-label="Public-domain books, scrollable list"
              tabIndex={0}
              className="public-domain-scroll w-full min-w-0 max-h-[clamp(14rem,60dvh,36rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3 sm:p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              <div
                ref={bookListRef}
                data-testid="public-domain-book-list"
                className="grid grid-cols-1 gap-4"
              >
                {filteredBooks.map(({book, excerpts}) => {
                  const isCollapsed = !expandedBookIds[book.id];
                  return (
                    <article
                      key={book.id}
                      ref={(node) => {
                        if (node) {
                          bookCardRefs.current.set(book.id, node);
                        } else {
                          bookCardRefs.current.delete(book.id);
                        }
                      }}
                      data-testid={`book-card-${book.id}`}
                      className="scroll-mt-3 scroll-mb-12 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
                    >
                      {/* Book Metadata Header */}
                      <div className="flex items-start gap-3.5 p-4 sm:p-5">
                        <BookCover
                          title={book.title}
                          author={book.author}
                          publicationYear={book.publicationYear}
                          edition={book.edition}
                          sourceName={book.sourceName}
                          coverTone={book.coverTone}
                          identifiers={book.coverIdentifiers}
                          size="M"
                          scrollRootRef={scrollContainerRef}
                          onInspect={setCoverPreview}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold leading-snug text-[var(--text-primary)]">
                                {book.title}
                              </h3>
                              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                {book.author} · {book.publicationYear}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleBook(book.id)}
                              aria-expanded={!isCollapsed}
                              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${book.title}`}
                              className="scroll-mt-3 scroll-mb-12 min-h-[40px] min-w-[40px] shrink-0 inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                            >
                              {isCollapsed ? (
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                            {book.sourceName} · {book.edition} · {book.publicDomainStatus}
                          </p>
                        </div>
                      </div>

                      {/* Excerpts List */}
                      {!isCollapsed && (
                        <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
                          {excerpts.map((excerpt) => {
                            const saved = savedByExcerptId.get(excerpt.id);
                            const savedWordIndex = saved?.progress?.wordIndex ?? 0;
                            const savedPct =
                              saved && saved.document.totalWords > 1
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (savedWordIndex / (saved.document.totalWords - 1)) * 100
                                    )
                                  )
                                : 0;
                            const isOpening = loadingExcerptId === excerpt.id;

                            return (
                              <div
                                key={excerpt.id}
                                data-testid={`excerpt-row-${excerpt.id}`}
                                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 hover:bg-[var(--bg-canvas)]/60 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                                      {excerpt.title}
                                    </span>
                                    {excerpt.isDefault && (
                                      <span className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)] tabular-nums">
                                    <span
                                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${DESCRIPTION_BADGE_CLASSES[excerpt.description]}`}
                                    >
                                      {excerpt.description}
                                    </span>
                                    <span>{excerpt.wordCount.toLocaleString()} words</span>
                                    {saved && savedWordIndex > 0 && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span>{savedPct}% read</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={loadingExcerptId !== null}
                                  onClick={() => void handleOpenExcerpt(excerpt)}
                                  aria-label={`${saved && savedWordIndex > 0 ? 'Resume' : 'Read'} ${excerpt.title}`}
                                  className="scroll-mt-3 scroll-mb-12 min-h-[44px] shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap hover:bg-[var(--text-primary)] hover:text-[var(--bg-canvas)] hover:border-[var(--text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] disabled:opacity-50"
                                >
                                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>
                                    {isOpening
                                      ? 'Opening…'
                                      : saved && savedWordIndex > 0
                                        ? 'Resume'
                                        : 'Read'}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full shrink-0" />
            </div>

            {showBottomFade && (
              <div
                data-testid="public-domain-scroll-fade"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-px bottom-px h-10 rounded-b-2xl bg-gradient-to-t from-[var(--bg-subtle)] via-[var(--bg-subtle)]/80 to-transparent"
              />
            )}
          </div>
        )}
      </section>

      <WelcomeModal
        open={welcomeOpen}
        isTryingSample={tryingWelcomeSample}
        onDismiss={handleDismissWelcome}
        onTrySample={() => void handleTrySampleFromWelcome()}
      />

      <BookCoverModal preview={coverPreview} onClose={() => setCoverPreview(null)} />
    </div>
  );
};
