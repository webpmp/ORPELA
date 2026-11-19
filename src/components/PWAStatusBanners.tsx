import {RefreshCw, RotateCcw, WifiOff, X} from 'lucide-react';
import React, {useEffect} from 'react';
import {useAppContext} from '../context/AppContext';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {usePWAUpdate} from '../hooks/usePWAUpdate';

export const PWAStatusBanners: React.FC = () => {
  const {
    isPlaybackActive,
    toastMessage,
    dismissToast,
    undoPayload,
    undoLastDelete,
    dismissUndo,
  } = useAppContext();

  const isOnline = useOnlineStatus();
  const {needRefresh, applyUpdate, dismissUpdate} = usePWAUpdate(isPlaybackActive);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(dismissToast, 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage, dismissToast]);

  useEffect(() => {
    if (!undoPayload) return;
    const timer = window.setTimeout(dismissUndo, 6500);
    return () => window.clearTimeout(timer);
  }, [undoPayload, dismissUndo]);

  return (
    <div className="pointer-events-none fixed bottom-20 md:bottom-5 left-4 right-4 z-50 flex flex-col items-center gap-2 pb-safe">
      {!isOnline && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] shadow-lg"
        >
          <WifiOff className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
          <span>Offline mode — local library and reader remain available.</span>
        </div>
      )}

      {needRefresh && !isPlaybackActive && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-lg"
        >
          <RefreshCw className="h-4 w-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
          <span>Update available.</span>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="min-h-[36px] rounded-lg bg-[var(--accent-primary)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 whitespace-nowrap"
          >
            Update now
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            aria-label="Dismiss update notification"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {undoPayload && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)] shadow-lg"
        >
          <span className="truncate max-w-[200px]">
            Deleted &ldquo;{undoPayload.document.title}&rdquo;
          </span>
          <button
            type="button"
            onClick={() => void undoLastDelete()}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={dismissUndo}
            aria-label="Dismiss delete notice"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-lg"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
