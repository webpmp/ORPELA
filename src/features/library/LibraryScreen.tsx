import {BookOpen, FilePlus2, Play, Trash2} from 'lucide-react';
import React, {useEffect, useMemo, useState} from 'react';
import {WelcomeModal} from '../../components/WelcomeModal';
import {WELCOME_SEEN_KEY} from '../../content/guidance';
import {useAppContext} from '../../context/AppContext';
import {SAMPLE_PASSAGES, type SamplePassage} from '../../services/samples';
import {computeAggregateStats} from '../../services/sessions';

interface LibraryScreenProps {
  onNavigate: (path: string) => void;
}

type SortKey = 'recent' | 'title';

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  if (mins === 0) return `${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${mins}m ${secs}s`;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({onNavigate}) => {
  const {
    isReady,
    documents,
    sessions,
    loadSamplePassage,
    updateSettings,
    deleteDocumentWithUndo,
    showToast,
    welcomeReopenRequested,
    markWelcomeShownThisVisit,
    consumeWelcomeReopenRequest,
  } = useAppContext();

  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tryingWelcomeSample, setTryingWelcomeSample] = useState(false);

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

  const sortedDocs = useMemo(() => {
    const copy = [...documents];
    if (sortBy === 'title') {
      copy.sort((a, b) => a.document.title.localeCompare(b.document.title));
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.progress?.updatedAt ?? b.document.createdAt).getTime() -
          new Date(a.progress?.updatedAt ?? a.document.createdAt).getTime()
      );
    }
    return copy;
  }, [documents, sortBy]);

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

  if (!isReady) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
        Loading your local library…
      </div>
    );
  }

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

      {/* Document List or Empty State */}
      {sortedDocs.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-10">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Start reading with sequential word display
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Paste any passage, upload a TXT, PDF, or EPUB file, or open one of the bundled
              public-domain passages below to try Orpela right away.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/import')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Paste or import file</span>
              </button>
              {SAMPLE_PASSAGES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  disabled={loadingSampleId !== null}
                  onClick={() => void handleLoadSample(sample, true)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Read {sample.title.split('—')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section aria-label="Saved documents" className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
          {sortedDocs.map(({document: doc, progress}) => {
            const wordIndex = progress?.wordIndex ?? 0;
            const pct =
              doc.totalWords <= 1
                ? 0
                : Math.min(100, Math.round((wordIndex / (doc.totalWords - 1)) * 100));
            const isConfirming = confirmDeleteId === doc.id;

            return (
              <article
                key={doc.id}
                className="flex flex-col gap-4 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--bg-canvas)]/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/read/${encodeURIComponent(doc.id)}`)}
                    className="text-left block w-full group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  >
                    <h2 className="text-base font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)]">
                      {doc.title}
                    </h2>
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
        </section>
      )}

      <WelcomeModal
        open={welcomeOpen}
        isTryingSample={tryingWelcomeSample}
        onDismiss={handleDismissWelcome}
        onTrySample={() => void handleTrySampleFromWelcome()}
      />
    </div>
  );
};
