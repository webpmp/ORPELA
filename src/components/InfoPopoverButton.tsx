import {Info, X} from 'lucide-react';
import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {CONTROL_INFO_TOPICS, type ControlInfoTopicId} from '../content/guidance';

interface InfoPopoverButtonProps {
  topicId: ControlInfoTopicId;
  onBeforeOpen?: () => void;
  className?: string;
}

export const InfoPopoverButton: React.FC<InfoPopoverButtonProps> = ({
  topicId,
  onBeforeOpen,
  className = '',
}) => {
  const topic = CONTROL_INFO_TOPICS[topicId];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const openPopover = useCallback(() => {
    onBeforeOpen?.();
    setOpen(true);
  }, [onBeforeOpen]);

  const closePopover = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      queueMicrotask(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePopover(true);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, closePopover]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      if (open) {
        closePopover(true);
      } else {
        openPopover();
      }
    }
  };

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (open) {
      closePopover(true);
    } else {
      openPopover();
    }
  };

  const popoverOverlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-testid={`info-popover-${topicId}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onClick={(e) => {
              e.stopPropagation();
              closePopover(true);
            }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[1px] sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 pt-3 pb-6 sm:p-5 shadow-2xl pb-safe"
            >
              <div className="sm:hidden pb-2.5 flex justify-center" aria-hidden="true">
                <div className="h-1.5 w-10 rounded-full bg-[var(--border-hairline)]" />
              </div>

              <div className="flex items-start justify-between gap-3">
                <h3
                  id={titleId}
                  className="text-base font-semibold text-[var(--text-primary)] pt-1.5"
                >
                  {topic.title}
                </h3>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => closePopover(true)}
                  aria-label={`Close ${topic.title} info`}
                  className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <p
                id={descId}
                className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]"
              >
                {topic.description}
              </p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={`info-btn-${topicId}`}
        aria-label={topic.ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ${className}`}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {popoverOverlay}
    </>
  );
};
