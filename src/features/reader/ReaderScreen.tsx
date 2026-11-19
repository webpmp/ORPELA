import {AlertCircle, X} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useAppContext} from '../../context/AppContext';
import {useReaderChrome} from '../../context/ReaderChromeContext';
import {useResponsiveLayout} from '../../hooks/useResponsiveLayout';
import {useSpeedReader} from '../../hooks/useSpeedReader';
import {getDocumentRecord} from '../../services/storage/repositories';
import type {LibraryDocument, ReadingProgress} from '../../types';
import {PlainTextView} from './PlainTextView';
import {ReaderControls} from './ReaderControls';
import {ReaderDisplay} from './ReaderDisplay';
import {ReaderSettingsSheet} from './ReaderSettingsSheet';

interface ReaderScreenProps {
  documentId: string;
  onNavigate: (path: string) => void;
}

export const READER_AUTO_HIDE_DELAY_MS = 2000;
const COMFORT_NOTICE_KEY = 'orpela-comfort-notice-seen';

export const ReaderScreen: React.FC<ReaderScreenProps> = ({documentId, onNavigate}) => {
  const {settings, updateSettings, setIsPlaybackActive, refreshLibrary, showToast} =
    useAppContext();
  const {isPhone} = useResponsiveLayout();

  const [loadedRecord, setLoadedRecord] = useState<{
    document: LibraryDocument;
    text: string;
    progress?: ReadingProgress;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    void getDocumentRecord(documentId)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setLoadError('Document not found in local library.');
        } else {
          setLoadedRecord({
            document: res.document,
            text: res.content.text,
            progress: res.progress,
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to open document.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-canvas)] text-sm text-[var(--text-secondary)]">
        Opening document…
      </div>
    );
  }

  if (loadError || !loadedRecord) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[var(--bg-canvas)] p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
        <p className="text-base font-medium text-[var(--text-primary)]">
          {loadError || 'Unable to load document.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="min-h-[44px] rounded-xl bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-canvas)]"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <ActiveReaderSession
      document={loadedRecord.document}
      text={loadedRecord.text}
      initialWordIndex={loadedRecord.progress?.wordIndex ?? 0}
      savedTokenizerVersion={
        loadedRecord.progress?.tokenizerVersion ?? loadedRecord.document.tokenizerVersion
      }
      settings={settings}
      isPhone={isPhone}
      onUpdateSettings={updateSettings}
      onPlaybackChange={setIsPlaybackActive}
      onRefreshLibrary={refreshLibrary}
      onStorageError={showToast}
      onExit={() => onNavigate('/')}
    />
  );
};

interface ActiveReaderSessionProps {
  document: LibraryDocument;
  text: string;
  initialWordIndex: number;
  savedTokenizerVersion: number;
  settings: ReturnType<typeof useAppContext>['settings'];
  isPhone: boolean;
  onUpdateSettings: ReturnType<typeof useAppContext>['updateSettings'];
  onPlaybackChange: (playing: boolean) => void;
  onRefreshLibrary: () => Promise<void>;
  onStorageError: (msg: string) => void;
  onExit: () => void;
}

const ActiveReaderSession: React.FC<ActiveReaderSessionProps> = ({
  document,
  text,
  initialWordIndex,
  savedTokenizerVersion,
  settings,
  isPhone,
  onUpdateSettings,
  onPlaybackChange,
  onRefreshLibrary,
  onStorageError,
  onExit,
}) => {
  const {setToolbar, setChromeHidden, registerExitGuard, registerPauseForMenu} =
    useReaderChrome();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlainView, setIsPlainView] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showComfortNotice, setShowComfortNotice] = useState(() => {
    try {
      return localStorage.getItem(COMFORT_NOTICE_KEY) !== '1';
    } catch {
      return false;
    }
  });

  const hideTimerRef = useRef<number | null>(null);

  const reader = useSpeedReader({
    document,
    text,
    initialWordIndex,
    savedTokenizerVersion,
    settings,
    onWpmChange: (wpm) => void onUpdateSettings({wpm}),
    onChunkSizeChange: (wordsPerFlash) => void onUpdateSettings({wordsPerFlash}),
    onStorageError,
    onPlaybackChange,
    onSessionCompleted: () => void onRefreshLibrary(),
  });

  const shouldAllowAutoHide = reader.schedulerState.isPlaying && !isPlainView && !isSettingsOpen;

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (shouldAllowAutoHide) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, READER_AUTO_HIDE_DELAY_MS);
    }
  }, [shouldAllowAutoHide]);

  useEffect(() => {
    if (!shouldAllowAutoHide) {
      setControlsVisible(true);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    } else {
      revealControls();
    }
  }, [shouldAllowAutoHide, revealControls]);

  const handleTogglePlainView = useCallback(() => {
    reader.pause();
    setIsPlainView((v) => !v);
  }, [reader.pause]);

  const handleOpenSettings = useCallback(() => {
    reader.pause();
    setIsSettingsOpen(true);
  }, [reader.pause]);

  // Register reader toolbar with shared AppShell header
  useEffect(() => {
    setToolbar({
      title: document.title,
      isPlainView,
      onTogglePlainView: handleTogglePlainView,
      onOpenSettings: handleOpenSettings,
    });
    return () => setToolbar(null);
  }, [document.title, isPlainView, handleTogglePlainView, handleOpenSettings, setToolbar]);

  // Keep top shared header & toolbar auto-hide synchronized with bottom controls
  const chromeHidden = !controlsVisible && shouldAllowAutoHide;
  useEffect(() => {
    setChromeHidden(chromeHidden);
    return () => setChromeHidden(false);
  }, [chromeHidden, setChromeHidden]);

  // Register navigation/exit guard and mobile-menu pause hook
  useEffect(() => {
    registerExitGuard(reader.flushAndPauseForExit);
    registerPauseForMenu(reader.pause);
    return () => {
      registerExitGuard(null);
      registerPauseForMenu(null);
    };
  }, [reader.flushAndPauseForExit, reader.pause, registerExitGuard, registerPauseForMenu]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      onPlaybackChange(false);
      void onRefreshLibrary();
    };
  }, [onPlaybackChange, onRefreshLibrary]);

  // Keyboard shortcuts (any key reveals hidden chrome; Space, Left/Right, Shift+Left/Right, Up/Down, R, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      revealControls();

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        if (e.key === 'Escape' && isSettingsOpen) {
          setIsSettingsOpen(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else {
          void reader.flushAndPauseForExit().then(() => onExit());
        }
        return;
      }

      if (isSettingsOpen || isPlainView) return;

      if (e.code === 'Space') {
        e.preventDefault();
        reader.togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
          reader.stepPrevParagraph();
        } else {
          reader.stepPrevSentence();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
          reader.stepNextParagraph();
        } else {
          reader.stepNextSentence();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        reader.adjustWpm(reader.wpmStep);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        reader.adjustWpm(-reader.wpmStep);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reader.restart();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen, isPlainView, onExit, reader, revealControls]);

  const dismissComfortNotice = (capWpm?: number) => {
    try {
      localStorage.setItem(COMFORT_NOTICE_KEY, '1');
    } catch {
      // Ignore storage error
    }
    if (capWpm) {
      void onUpdateSettings({
        maxWpmCap: capWpm,
        wpm: Math.min(settings.wpm, capWpm),
      });
    }
    setShowComfortNotice(false);
  };

  return (
    <div
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onTouchStart={revealControls}
      style={{
        backgroundColor: settings.backgroundColor || undefined,
        color: settings.textColor || undefined,
      }}
      className="relative h-[100dvh] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden"
    >
      {/* Screen reader live announcement for play/pause state */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {reader.announcement}
      </div>

      {isPlainView ? (
        <PlainTextView
          title={document.title}
          author={document.author}
          tokens={reader.tokenized.tokens}
          currentWordIndex={reader.schedulerState.wordIndex}
          onJumpToWord={(wordIdx) => {
            reader.seek(wordIdx);
            setIsPlainView(false);
          }}
        />
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0">
          {/* First-session comfort notice (out-of-flow overlay positioned below fixed header+toolbar) */}
          {showComfortNotice && (
            <div
              role="region"
              aria-label="Comfort notice"
              className="pointer-events-none absolute top-28 md:top-34 [@media(max-height:500px)]:top-24 pt-safe left-0 right-0 z-20 mx-auto max-w-xl px-4"
            >
              <div className="pointer-events-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-secondary)] shadow-sm">
                <p className="leading-relaxed">
                  Rapidly changing text may feel intense or tiring for some readers. You can switch
                  to Plain Text anytime or set a comfortable speed cap.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => dismissComfortNotice(500)}
                    className="min-h-[36px] rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
                  >
                    Cap at 500 WPM
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissComfortNotice()}
                    aria-label="Dismiss comfort notice"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <ReaderDisplay
            tokens={reader.tokenized.tokens}
            chunk={reader.schedulerState.currentChunk}
            fragmentIndex={reader.schedulerState.fragmentIndex}
            isPlaying={reader.schedulerState.isPlaying}
            isCompleted={reader.schedulerState.isCompleted}
            countdownRemaining={reader.countdownRemaining}
            settings={settings}
            isPhone={isPhone}
            onTogglePlayPause={reader.togglePlayPause}
            onPrevSentence={reader.stepPrevSentence}
            onNextSentence={reader.stepNextSentence}
            onAdjustWpm={reader.adjustWpm}
            onRevealControls={revealControls}
          />
        </div>
      )}

      <ReaderControls
        visible={controlsVisible}
        isPlaying={reader.schedulerState.isPlaying}
        isCountingDown={reader.countdownRemaining > 0}
        isPlainView={isPlainView}
        wpm={reader.schedulerState.wpm}
        chunkSize={reader.schedulerState.chunkSize}
        progress={reader.progressStats}
        onTogglePlayPause={reader.togglePlayPause}
        onRestart={reader.restart}
        onPrevSentence={reader.stepPrevSentence}
        onNextSentence={reader.stepNextSentence}
        onPrevParagraph={reader.stepPrevParagraph}
        onNextParagraph={reader.stepNextParagraph}
        onSeekPercentage={reader.seekPercentage}
        onAdjustWpm={reader.adjustWpm}
        onChunkSizeChange={reader.setChunkSize}
      />

      <ReaderSettingsSheet
        open={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
