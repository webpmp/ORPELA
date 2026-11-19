import {Download, Share, X} from 'lucide-react';
import React, {useState} from 'react';
import {APP_NAME} from '../config';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'secondary';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({variant = 'secondary'}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ${
          variant === 'primary'
            ? 'bg-[var(--accent-primary)] text-white hover:opacity-90'
            : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
        }`}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Install {APP_NAME}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap shrink-0 hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        >
          <Share className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h2 id="ios-install-title" className="text-lg font-semibold text-[var(--text-primary)]">
                  Install {APP_NAME} on iOS
                </h2>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                <li>
                  1. Open this page in <strong>Safari</strong> on your iPhone or iPad.
                </li>
                <li>
                  2. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  3. Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  4. Launch {APP_NAME} from your Home Screen for full-screen standalone reading and
                  safer local storage retention.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[var(--text-primary)] text-[var(--bg-surface)] text-sm font-medium hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
