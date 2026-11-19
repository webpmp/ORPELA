import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {PROGRESS_SAVE_INTERVAL_MS} from '../config';
import type {ChunkSize} from '../engine/chunker';
import {
  computeProgress,
  nextParagraph,
  nextSentence,
  prevParagraph,
  prevSentence,
  seekByPercentage,
} from '../engine/navigation';
import {SwdScheduler, type SchedulerState} from '../engine/scheduler';
import {TIMING_CONSTANTS, clampWpm} from '../engine/timing';
import {tokenize} from '../engine/tokenizer';
import {createReadingSession, finalizeReadingSession} from '../services/sessions';
import {
  remapWordIndexOnVersionChange,
  saveReadingProgress,
} from '../services/storage/repositories';
import type {LibraryDocument, ReaderSettings, ReadingSession} from '../types';
import {useWakeLock} from './useWakeLock';

interface UseSpeedReaderOptions {
  document: LibraryDocument;
  text: string;
  initialWordIndex: number;
  savedTokenizerVersion: number;
  settings: ReaderSettings;
  onWpmChange: (wpm: number) => void;
  onChunkSizeChange: (size: ChunkSize) => void;
  onStorageError: (message: string) => void;
  onPlaybackChange?: (playing: boolean) => void;
  onSessionCompleted?: () => void;
}

export function useSpeedReader({
  document: libraryDoc,
  text,
  initialWordIndex,
  savedTokenizerVersion,
  settings,
  onWpmChange,
  onChunkSizeChange,
  onStorageError,
  onPlaybackChange,
  onSessionCompleted,
}: UseSpeedReaderOptions) {
  const tokenized = useMemo(() => tokenize(text), [text]);

  const remappedStart = useMemo(
    () =>
      remapWordIndexOnVersionChange(
        initialWordIndex,
        savedTokenizerVersion,
        libraryDoc.totalWords,
        tokenized.tokens.length
      ),
    [initialWordIndex, savedTokenizerVersion, libraryDoc.totalWords, tokenized.tokens.length]
  );

  // Store callback props in refs so lifecycle effects remain stable across renders
  const onWpmChangeRef = useRef(onWpmChange);
  onWpmChangeRef.current = onWpmChange;
  const onChunkSizeChangeRef = useRef(onChunkSizeChange);
  onChunkSizeChangeRef.current = onChunkSizeChange;
  const onStorageErrorRef = useRef(onStorageError);
  onStorageErrorRef.current = onStorageError;
  const onPlaybackChangeRef = useRef(onPlaybackChange);
  onPlaybackChangeRef.current = onPlaybackChange;
  const onSessionCompletedRef = useRef(onSessionCompleted);
  onSessionCompletedRef.current = onSessionCompleted;

  // Create the scheduler instance once and retain it across renders & StrictMode double-invocations
  const schedulerRef = useRef<SwdScheduler | null>(null);
  const loadedDocKeyRef = useRef<string>('');
  if (schedulerRef.current === null) {
    loadedDocKeyRef.current = `${libraryDoc.id}:${tokenized.tokens.length}`;
    schedulerRef.current = new SwdScheduler({
      tokens: tokenized.tokens,
      initialIndex: remappedStart.wordIndex,
      wpm: settings.wpm,
      chunkSize: settings.wordsPerFlash,
      punctuationPauseStrength: settings.punctuationPauseStrength,
      paragraphAutoPause: settings.paragraphAutoPause,
      countdownSeconds: settings.countdownSeconds,
      maxWpmCap: settings.maxWpmCap,
      speedRamp: settings.speedRamp,
      chunkExpansion: settings.chunkExpansion,
    });
  }

  const subscribe = useCallback((onStoreChange: () => void) => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return () => {};
    return scheduler.subscribe(() => onStoreChange(), false);
  }, []);

  const getSnapshot = useCallback((): SchedulerState => {
    return schedulerRef.current!.getState();
  }, []);

  const schedulerState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const countdownRemaining = schedulerState.countdownSecondsRemaining;

  const [announcement, setAnnouncement] = useState<string>('');

  const activeSessionRef = useRef<ReadingSession | null>(null);
  const pendingSessionPromiseRef = useRef<Promise<ReadingSession> | null>(null);
  const isExitingOrUnmountedRef = useRef<boolean>(false);
  const sessionStartActiveSecondsRef = useRef<number>(0);
  const lastSavedAtRef = useRef<number>(0);
  const latestWordIndexRef = useRef<number>(schedulerState.wordIndex);
  const latestActiveSecondsRef = useRef<number>(schedulerState.activeSeconds);

  latestWordIndexRef.current = schedulerState.wordIndex;
  latestActiveSecondsRef.current = schedulerState.activeSeconds;

  useWakeLock(schedulerState.isPlaying || schedulerState.phase === 'countdown');

  const persistProgressNow = useCallback(
    async (wordIndex: number) => {
      try {
        lastSavedAtRef.current = Date.now();
        await saveReadingProgress(libraryDoc.id, wordIndex);
      } catch (err) {
        onStorageErrorRef.current(
          err instanceof Error ? err.message : 'Unable to save reading progress.'
        );
      }
    },
    [libraryDoc.id]
  );

  const closeActiveSession = useCallback(
    async (endWordIndex: number, activeSeconds: number) => {
      if (pendingSessionPromiseRef.current) {
        try {
          const resolved = await pendingSessionPromiseRef.current;
          if (!activeSessionRef.current) {
            activeSessionRef.current = resolved;
          }
        } catch {
          // Ignore non-fatal session creation failure
        } finally {
          pendingSessionPromiseRef.current = null;
        }
      }
      const current = activeSessionRef.current;
      if (!current) return;
      activeSessionRef.current = null;
      const deltaSeconds = Math.max(0, activeSeconds - sessionStartActiveSecondsRef.current);
      try {
        await finalizeReadingSession(current, endWordIndex, deltaSeconds);
        onSessionCompletedRef.current?.();
      } catch {
        // Ignore non-fatal session write failure
      }
    },
    []
  );

  // Update tokens only if document changes while reader stays mounted
  useEffect(() => {
    const nextKey = `${libraryDoc.id}:${tokenized.tokens.length}`;
    if (loadedDocKeyRef.current !== nextKey) {
      loadedDocKeyRef.current = nextKey;
      schedulerRef.current?.setTokens(tokenized.tokens, remappedStart.wordIndex);
    }
  }, [libraryDoc.id, tokenized, remappedStart.wordIndex]);

  // Sync live settings changes into scheduler
  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    scheduler.setWpm(settings.wpm);
    scheduler.setChunkSize(settings.wordsPerFlash);
    scheduler.setPunctuationPauseStrength(settings.punctuationPauseStrength);
    scheduler.setParagraphAutoPause(settings.paragraphAutoPause);
    scheduler.setCountdownSeconds(settings.countdownSeconds);
    scheduler.setMaxWpmCap(settings.maxWpmCap);
    scheduler.setSpeedRamp(settings.speedRamp);
    scheduler.setChunkExpansion(settings.chunkExpansion);
  }, [settings]);

  // Notify parent of playback state, announce phase changes, & manage reading sessions
  useEffect(() => {
    onPlaybackChangeRef.current?.(schedulerState.isPlaying);

    if (schedulerState.phase === 'countdown') {
      setAnnouncement(`Starting in ${schedulerState.countdownSecondsRemaining} seconds.`);
    } else if (schedulerState.isPlaying) {
      setAnnouncement(`Playing at ${schedulerState.wpm} words per minute.`);
      if (!activeSessionRef.current && !pendingSessionPromiseRef.current) {
        sessionStartActiveSecondsRef.current = schedulerState.activeSeconds;
        const promise = createReadingSession(libraryDoc.id, schedulerState.wordIndex);
        pendingSessionPromiseRef.current = promise;
        void promise
          .then((s) => {
            if (pendingSessionPromiseRef.current === promise) {
              pendingSessionPromiseRef.current = null;
            }
            if (isExitingOrUnmountedRef.current || !schedulerRef.current?.getState().isPlaying) {
              const deltaSeconds = Math.max(
                0,
                latestActiveSecondsRef.current - sessionStartActiveSecondsRef.current
              );
              return finalizeReadingSession(s, latestWordIndexRef.current, deltaSeconds).then(() => {
                onSessionCompletedRef.current?.();
              });
            }
            activeSessionRef.current = s;
            return undefined;
          })
          .catch(() => {
            if (pendingSessionPromiseRef.current === promise) {
              pendingSessionPromiseRef.current = null;
            }
          });
      }
    } else {
      if (activeSessionRef.current || pendingSessionPromiseRef.current) {
        void closeActiveSession(schedulerState.wordIndex, schedulerState.activeSeconds);
      }
    }
  }, [
    schedulerState.phase,
    schedulerState.countdownSecondsRemaining,
    schedulerState.isPlaying,
    schedulerState.wpm,
    libraryDoc.id,
    closeActiveSession,
    schedulerState.wordIndex,
    schedulerState.activeSeconds,
  ]);

  // Throttled progress writes during playback (at most every 3 seconds)
  useEffect(() => {
    if (!schedulerState.isPlaying) return;
    const now = Date.now();
    if (now - lastSavedAtRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
      void persistProgressNow(schedulerState.wordIndex);
    }
  }, [schedulerState.isPlaying, schedulerState.wordIndex, persistProgressNow]);

  const flushAndPauseForExit = useCallback(async () => {
    schedulerRef.current?.pause();
    onPlaybackChangeRef.current?.(false);
    setAnnouncement('Paused.');
    const wordIdx = latestWordIndexRef.current;
    const activeSecs = latestActiveSecondsRef.current;
    await Promise.all([persistProgressNow(wordIdx), closeActiveSession(wordIdx, activeSecs)]);
    onSessionCompletedRef.current?.();
  }, [persistProgressNow, closeActiveSession]);

  // Save on visibilitychange, pagehide, browser back (hashchange/popstate), and unmount
  useEffect(() => {
    isExitingOrUnmountedRef.current = false;

    const handleVisibilityChange = () => {
      if (window.document.hidden) {
        schedulerRef.current?.handleVisibilityChange(true);
        void persistProgressNow(latestWordIndexRef.current);
        void closeActiveSession(latestWordIndexRef.current, latestActiveSecondsRef.current);
      }
    };

    const handleImmediateExit = () => {
      schedulerRef.current?.pause();
      onPlaybackChangeRef.current?.(false);
      const wordIdx = latestWordIndexRef.current;
      const activeSecs = latestActiveSecondsRef.current;
      void Promise.all([
        persistProgressNow(wordIdx),
        closeActiveSession(wordIdx, activeSecs),
      ]).then(() => {
        onSessionCompletedRef.current?.();
      });
    };

    window.document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleImmediateExit);
    window.addEventListener('hashchange', handleImmediateExit);
    window.addEventListener('popstate', handleImmediateExit);

    return () => {
      isExitingOrUnmountedRef.current = true;
      window.document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleImmediateExit);
      window.removeEventListener('hashchange', handleImmediateExit);
      window.removeEventListener('popstate', handleImmediateExit);
      handleImmediateExit();
    };
  }, [persistProgressNow, closeActiveSession]);

  const play = useCallback(() => {
    schedulerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    schedulerRef.current?.pause();
    setAnnouncement('Paused.');
    void persistProgressNow(latestWordIndexRef.current);
  }, [persistProgressNow]);

  const togglePlayPause = useCallback(() => {
    const state = schedulerRef.current?.getState();
    if (!state) return;
    if (state.isPlaying || state.phase === 'countdown') {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  const seek = useCallback(
    (index: number) => {
      schedulerRef.current?.seek(index);
      void persistProgressNow(index);
    },
    [persistProgressNow]
  );

  const seekPercentage = useCallback(
    (pct: number) => {
      const target = seekByPercentage(tokenized.tokens, pct);
      seek(target);
    },
    [tokenized.tokens, seek]
  );

  const restart = useCallback(() => {
    schedulerRef.current?.restart();
    setAnnouncement('Restarted from beginning.');
    void persistProgressNow(0);
  }, [persistProgressNow]);

  const stepPrevSentence = useCallback(() => {
    const target = prevSentence(
      tokenized.tokens,
      tokenized.sentenceStarts,
      latestWordIndexRef.current
    );
    seek(target);
  }, [tokenized, seek]);

  const stepNextSentence = useCallback(() => {
    const target = nextSentence(
      tokenized.tokens,
      tokenized.sentenceStarts,
      latestWordIndexRef.current
    );
    seek(target);
  }, [tokenized, seek]);

  const stepPrevParagraph = useCallback(() => {
    const target = prevParagraph(
      tokenized.tokens,
      tokenized.paragraphStarts,
      latestWordIndexRef.current
    );
    seek(target);
  }, [tokenized, seek]);

  const stepNextParagraph = useCallback(() => {
    const target = nextParagraph(
      tokenized.tokens,
      tokenized.paragraphStarts,
      latestWordIndexRef.current
    );
    seek(target);
  }, [tokenized, seek]);

  const adjustWpm = useCallback(
    (delta: number) => {
      const next = clampWpm(settings.wpm + delta);
      const capped = settings.maxWpmCap ? Math.min(next, settings.maxWpmCap) : next;
      onWpmChangeRef.current(capped);
    },
    [settings.wpm, settings.maxWpmCap]
  );

  const setChunkSize = useCallback((size: ChunkSize) => {
    onChunkSizeChangeRef.current(size);
  }, []);

  const progressStats = useMemo(
    () =>
      computeProgress(
        tokenized.tokens,
        schedulerState.wordIndex,
        schedulerState.wpm,
        schedulerState.chunkSize,
        settings.punctuationPauseStrength
      ),
    [
      tokenized.tokens,
      schedulerState.wordIndex,
      schedulerState.wpm,
      schedulerState.chunkSize,
      settings.punctuationPauseStrength,
    ]
  );

  return {
    tokenized,
    schedulerState,
    countdownRemaining,
    announcement,
    progressStats,
    remappedOnLoad: remappedStart.remapped,
    play,
    pause,
    flushAndPauseForExit,
    togglePlayPause,
    seek,
    seekPercentage,
    restart,
    stepPrevSentence,
    stepNextSentence,
    stepPrevParagraph,
    stepNextParagraph,
    adjustWpm,
    setChunkSize,
    wpmStep: TIMING_CONSTANTS.WPM_STEP,
  };
}
