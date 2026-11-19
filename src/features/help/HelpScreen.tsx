import React from 'react';
import {PWAInstallButton} from '../../components/PWAInstallButton';
import {APP_NAME} from '../../config';

const SHORTCUTS = [
  {keys: 'Space', action: 'Play or pause sequential word display'},
  {keys: 'Left / Right', action: 'Previous or next sentence'},
  {keys: 'Shift + Left / Right', action: 'Previous or next paragraph'},
  {keys: 'Up / Down', action: 'Increase or decrease speed by 25 WPM'},
  {keys: 'R', action: 'Restart current document from the beginning'},
  {keys: 'Esc', action: 'Close settings or return to Library'},
];

export const HelpScreen: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="border-b border-[var(--border-hairline)] pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Help &amp; Installation
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Installing {APP_NAME}, navigation controls, and how local storage works.
        </p>
      </header>

      {/* Install Section */}
      <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Install as an Offline App
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Works completely offline once installed—including TXT, PDF, and EPUB imports.
            </p>
          </div>
          <PWAInstallButton variant="primary" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm text-[var(--text-secondary)]">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <h3 className="font-semibold text-[var(--text-primary)]">iPhone &amp; iPad (Safari)</h3>
            <ol className="mt-2 space-y-1.5 leading-relaxed">
              <li>1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
              <li>2. Choose <strong>Add to Home Screen</strong>.</li>
              <li>3. Open {APP_NAME} from your Home Screen for standalone mode.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Desktop (Chrome, Edge)</h3>
            <ol className="mt-2 space-y-1.5 leading-relaxed">
              <li>1. Click the <strong>Install {APP_NAME}</strong> button above or in the address bar.</li>
              <li>2. Launch anytime from your desktop or app launcher without internet access.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Keyboard &amp; Touch Controls
        </h2>

        <div className="divide-y divide-[var(--border-hairline)] text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-[var(--text-secondary)]">{s.action}</span>
              <kbd className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-mono text-[var(--text-primary)] whitespace-nowrap">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        <p className="pt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
          <strong>Touch gestures:</strong> Tap the focal display to play or pause. Swipe left or
          right to move between sentences. Swipe up or down to adjust WPM. Every gesture also has
          dedicated visible buttons.
        </p>
      </section>

      {/* Honest Reading Caveat & Privacy */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            About Speed Reading
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Research on sequential word display is mixed: pushing presentation speeds too high
            often trades away reading comprehension and makes regressions harder. Treat features
            like speed ramp, chunk expansion, and the context pane as optional experiments, and use
            the Plain Text view whenever careful study matters more than pace.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Privacy &amp; Data Retention
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {APP_NAME} runs 100% locally in your browser with zero accounts, analytics, or
            telemetry. Documents, progress, and session history are stored in IndexedDB on your
            device. Note that Safari may clear storage for sites unused for roughly a week unless
            installed to the Home Screen—use JSON Export in Settings as a portable backup.
          </p>
        </div>
      </section>
    </div>
  );
};
