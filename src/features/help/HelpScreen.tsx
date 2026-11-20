import React, {useEffect} from 'react';
import {PWAInstallButton} from '../../components/PWAInstallButton';
import {APP_NAME} from '../../config';
import {HELP_GUIDANCE, WELCOME_CONTROLS} from '../../content/guidance';
import {useAppContext} from '../../context/AppContext';

interface HelpScreenProps {
  section?: string;
  onNavigate?: (path: string) => void;
}

const SHORTCUTS = [
  {keys: 'Space', action: 'Play or pause sequential word display'},
  {keys: 'Left / Right', action: 'Previous or next sentence'},
  {keys: 'Shift + Left / Right', action: 'Previous or next paragraph'},
  {keys: 'Up / Down', action: 'Increase or decrease speed by 25 WPM'},
  {keys: 'R', action: 'Restart current document from the beginning'},
  {keys: 'Esc', action: 'Close settings or return to Library'},
];

export const HelpScreen: React.FC<HelpScreenProps> = ({section, onNavigate}) => {
  const {requestReopenWelcome} = useAppContext();

  useEffect(() => {
    if (section !== 'guidance' || typeof document === 'undefined') return;
    const target = document.getElementById('how-to-read');
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  }, [section]);

  const handleShowWelcomeAgain = () => {
    requestReopenWelcome();
    if (onNavigate) {
      onNavigate('/');
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/';
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Help &amp; Installation
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            How to read with {APP_NAME}, practice tips, navigation controls, and offline install.
          </p>
        </div>

        <button
          type="button"
          onClick={handleShowWelcomeAgain}
          className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        >
          {WELCOME_CONTROLS.showAgain}
        </button>
      </header>

      {/* How to read with Orpela */}
      <section
        id="how-to-read"
        aria-labelledby="how-to-read-title"
        className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div>
          <h2 id="how-to-read-title" className="text-base font-semibold text-[var(--text-primary)]">
            {HELP_GUIDANCE.howToRead.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {HELP_GUIDANCE.howToRead.intro}
          </p>
        </div>

        <div className="space-y-4 pt-1">
          {HELP_GUIDANCE.howToRead.steps.map((step) => (
            <div
              key={step.title}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-2"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
              {step.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-relaxed text-[var(--text-secondary)]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Words per flash, explained */}
      <section
        aria-labelledby="words-per-flash-title"
        className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div>
          <h2
            id="words-per-flash-title"
            className="text-base font-semibold text-[var(--text-primary)]"
          >
            {HELP_GUIDANCE.wordsPerFlashExplained.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {HELP_GUIDANCE.wordsPerFlashExplained.intro}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {HELP_GUIDANCE.wordsPerFlashExplained.items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {HELP_GUIDANCE.wordsPerFlashExplained.whyNoHighlight}
        </p>
      </section>

      {/* How to practice */}
      <section
        aria-labelledby="how-to-practice-title"
        className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <h2
          id="how-to-practice-title"
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          {HELP_GUIDANCE.howToPractice.title}
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-secondary)] list-disc pl-5">
          {HELP_GUIDANCE.howToPractice.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      {/* A note on speed reading */}
      <section
        aria-labelledby="speed-reading-note-title"
        className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <h2
          id="speed-reading-note-title"
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          {HELP_GUIDANCE.speedReadingNote.title}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {HELP_GUIDANCE.speedReadingNote.body}
        </p>
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

      {/* Privacy & Data Retention */}
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Privacy &amp; Data Retention
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {APP_NAME} runs 100% locally in your browser with zero accounts, analytics, or
          telemetry. Documents, progress, and session history are stored in IndexedDB on your
          device. Note that Safari may clear storage for sites unused for roughly a week unless
          installed to the Home Screen—use JSON Export in Settings as a portable backup.
        </p>
      </section>
    </div>
  );
};
