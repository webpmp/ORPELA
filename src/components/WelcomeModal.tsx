import {X} from 'lucide-react';
import React, {useEffect, useId, useState} from 'react';
import {WELCOME_CONTROLS, WELCOME_STEPS} from '../content/guidance';

interface WelcomeModalProps {
  open: boolean;
  isTryingSample?: boolean;
  onDismiss: () => void;
  onTrySample: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  open,
  isTryingSample = false,
  onDismiss,
  onTrySample,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onDismiss]);

  if (!open) return null;

  const step = WELCOME_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WELCOME_STEPS.length - 1;

  return (
    <div
      data-testid="welcome-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4"
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-2xl pb-safe flex flex-col max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-label={`Step ${stepIndex + 1} of ${WELCOME_STEPS.length}`}>
            {WELCOME_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                aria-label={`Step ${idx + 1}: ${s.title}`}
                aria-current={idx === stepIndex ? 'step' : undefined}
                className="min-h-[32px] min-w-[20px] flex items-center justify-center"
              >
                <span
                  className={`block h-2 rounded-full transition-all ${
                    idx === stepIndex
                      ? 'w-6 bg-[var(--accent-primary)]'
                      : 'w-2 bg-[var(--border-hairline)]'
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <span>{WELCOME_CONTROLS.skip}</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex-1">
          <h2
            id={titleId}
            className="text-xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            {step.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
            {step.body}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-4 pb-5 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            disabled={isFirst || isTryingSample}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
          >
            {WELCOME_CONTROLS.back}
          </button>

          <div className="flex items-center gap-2">
            {isLast ? (
              <>
                <button
                  type="button"
                  disabled={isTryingSample}
                  onClick={onDismiss}
                  className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                >
                  {WELCOME_CONTROLS.close}
                </button>
                <button
                  type="button"
                  disabled={isTryingSample}
                  onClick={onTrySample}
                  className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isTryingSample ? 'Loading…' : WELCOME_CONTROLS.trySample}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(WELCOME_STEPS.length - 1, i + 1))}
                className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {WELCOME_CONTROLS.next}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
