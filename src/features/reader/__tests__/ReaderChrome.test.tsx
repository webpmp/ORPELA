import {IDBKeyRange, indexedDB} from 'fake-indexeddb';
import fs from 'fs';
import path from 'path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {AppShell} from '../../../components/AppShell';
import {ReaderChromeProvider} from '../../../context/ReaderChromeContext';
import {getChunkAt} from '../../../engine/chunker';
import {SwdScheduler, type SchedulerClock} from '../../../engine/scheduler';
import {tokenize} from '../../../engine/tokenizer';
import {createReadingSession, finalizeReadingSession} from '../../../services/sessions';
import {DEFAULT_READER_SETTINGS, OrpelaDatabase} from '../../../services/storage/db';
import {
  getDocumentRecord,
  saveImportedDocument,
  saveReadingProgress,
} from '../../../services/storage/repositories';
import {ReaderControls} from '../ReaderControls';
import {ReaderDisplay} from '../ReaderDisplay';
import {READER_AUTO_HIDE_DELAY_MS} from '../ReaderScreen';

const noop = () => {};

class FakeClock implements SchedulerClock {
  public time = 0;
  private nextId = 1;
  private callbacks = new Map<number, (ts: number) => void>();

  now = (): number => this.time;

  requestFrame = (cb: (timestamp: number) => void): number => {
    const id = this.nextId++;
    this.callbacks.set(id, cb);
    return id;
  };

  cancelFrame = (id: number): void => {
    this.callbacks.delete(id);
  };

  advanceBy(ms: number, stepMs = 16): void {
    const target = this.time + ms;
    while (this.time < target) {
      this.time = Math.min(target, this.time + stepMs);
      const pending = Array.from(this.callbacks.entries());
      this.callbacks.clear();
      for (const [, cb] of pending) {
        cb(this.time);
      }
    }
  }
}

function extractFocalStageMarkup(html: string): string {
  const start = html.indexOf('data-testid="focal-stage"');
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('<div class="mt-6 h-6', start);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('Reader chrome overlay, auto-hide, focal stability, and exit cleanup', () => {
  it('fades out both shared header and reader toolbar plus bottom controls as fixed overlays with inert and pointer-events-none', () => {
    const sample = 'The quick brown fox jumps cleanly over the lazy dog.';
    const {tokens} = tokenize(sample);
    const chunk = getChunkAt(tokens, 0, 1);

    const renderWithChromeHidden = (chromeHidden: boolean) =>
      renderToStaticMarkup(
        <ReaderChromeProvider
          initialToolbar={{
            title: 'Sample Document',
            isPlainView: false,
            onTogglePlainView: noop,
            onOpenSettings: noop,
          }}
          initialChromeHidden={chromeHidden}
        >
          <AppShell route={{name: 'read', documentId: 'doc-1'}} onNavigate={noop}>
            <div className="relative h-[100dvh] flex flex-col overflow-hidden">
              <div className="relative flex-1 flex flex-col min-h-0">
                <ReaderDisplay
                  tokens={tokens}
                  chunk={chunk}
                  fragmentIndex={0}
                  isPlaying={chromeHidden}
                  isCompleted={false}
                  countdownRemaining={0}
                  settings={DEFAULT_READER_SETTINGS}
                  isPhone={false}
                  onTogglePlayPause={noop}
                  onPrevSentence={noop}
                  onNextSentence={noop}
                  onAdjustWpm={noop}
                  onRevealControls={noop}
                />
              </div>
              <ReaderControls
                visible={!chromeHidden}
                isPlaying={chromeHidden}
                isCountingDown={false}
                isPlainView={false}
                wpm={300}
                chunkSize={1}
                progress={{
                  wordIndex: 0,
                  totalWords: tokens.length,
                  wordsRead: 0,
                  wordsRemaining: tokens.length,
                  percentage: 0,
                  estimatedSecondsRemaining: 10,
                }}
                onTogglePlayPause={noop}
                onRestart={noop}
                onPrevSentence={noop}
                onNextSentence={noop}
                onPrevParagraph={noop}
                onNextParagraph={noop}
                onSeekPercentage={noop}
                onAdjustWpm={noop}
                onChunkSizeChange={noop}
              />
            </div>
          </AppShell>
        </ReaderChromeProvider>
      );

    const visibleHtml = renderWithChromeHidden(false);
    const hiddenHtml = renderWithChromeHidden(true);

    // Top chrome wrapper overlays viewport (fixed top-0) and contains both shared header + toolbar
    expect(visibleHtml).toContain('data-testid="reader-top-chrome"');
    expect(visibleHtml).toContain('fixed top-0 left-0 right-0');
    expect(visibleHtml).toContain('data-testid="app-header"');
    expect(visibleHtml).toContain('data-testid="reader-toolbar"');
    expect(visibleHtml).toContain('data-testid="reader-bottom-controls"');
    expect(visibleHtml).toContain('fixed bottom-0 left-0 right-0');
    expect(visibleHtml).not.toContain('aria-label="Back to library"');

    // When hidden during playback, BOTH top chrome (header + toolbar) and bottom controls are non-interactive & non-focusable
    expect(hiddenHtml).toMatch(
      /data-testid="reader-top-chrome"[^>]*aria-hidden="true"[^>]*inert=""[^>]*opacity-0 pointer-events-none/
    );
    expect(hiddenHtml).toMatch(
      /data-testid="reader-bottom-controls"[^>]*aria-hidden="true"[^>]*inert=""[^>]*opacity-0 pointer-events-none/
    );
    expect(hiddenHtml).toContain('reader-chrome-transition');

    // Focal stage height, style, and reticle axis marks do not depend on chrome visibility
    const visibleStage = extractFocalStageMarkup(visibleHtml);
    const hiddenStage = extractFocalStageMarkup(hiddenHtml);
    expect(hiddenStage).toBe(visibleStage);
  });

  it('uses ~2s inactivity delay and respects prefers-reduced-motion, keyboard reveal, and tap-to-pause', () => {
    expect(READER_AUTO_HIDE_DELAY_MS).toBe(2000);

    const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(indexCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(indexCss).toContain('.reader-chrome-transition');
    expect(indexCss).toContain('transition: none !important');

    const readerScreenSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/reader/ReaderScreen.tsx'),
      'utf8'
    );
    expect(readerScreenSrc).toContain('revealControls();');
    expect(readerScreenSrc).toContain('onPointerMove={revealControls}');
    expect(readerScreenSrc).toContain('onPointerDown={revealControls}');
    expect(readerScreenSrc).toContain('onTouchStart={revealControls}');
    expect(readerScreenSrc).toContain('flushAndPauseForExit');

    const appShellSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AppShell.tsx'),
      'utf8'
    );
    expect(appShellSrc).toContain('pauseForMenu()');
    expect(appShellSrc).toContain('await runExitGuard()');
    expect(appShellSrc).toContain("e.key === 'Escape'");
  });

  it('pauses playback, closes the active session, and saves reading progress to IndexedDB on exit', async () => {
    const dbName = `orpela-exit-test-${Date.now()}`;
    const testDb = new OrpelaDatabase(dbName, {indexedDB, IDBKeyRange});
    await testDb.open();

    const sample = 'One two three four five six seven eight nine ten eleven twelve.';
    const {tokens} = tokenize(sample);
    const imported = await saveImportedDocument(
      {
        title: 'Exit Persistence Test',
        source: 'paste',
        text: sample,
        warnings: [],
      },
      tokens.length,
      undefined,
      testDb
    );

    const clock = new FakeClock();
    const scheduler = new SwdScheduler({
      tokens,
      initialIndex: 0,
      wpm: 300,
      chunkSize: 1,
      punctuationPauseStrength: 0,
      paragraphAutoPause: false,
      countdownSeconds: 0,
      clock,
    });

    const session = await createReadingSession(imported.document.id, 0, testDb);
    scheduler.play();
    expect(scheduler.getState().isPlaying).toBe(true);

    // Advance clock through several words (300 WPM = 200ms per word)
    clock.advanceBy(1100, 16);
    const wordBeforeExit = scheduler.getState().wordIndex;
    expect(wordBeforeExit).toBeGreaterThan(0);

    // Simulate exit guard sequence: pause, flush progress, finalize active session
    scheduler.pause();
    await Promise.all([
      saveReadingProgress(imported.document.id, wordBeforeExit, testDb),
      finalizeReadingSession(session, wordBeforeExit, scheduler.getState().activeSeconds, testDb),
    ]);

    expect(scheduler.getState().isPlaying).toBe(false);
    const reloaded = await getDocumentRecord(imported.document.id, testDb);
    expect(reloaded?.progress?.wordIndex).toBe(wordBeforeExit);

    const savedSessions = await testDb.sessions.toArray();
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].endedAt).toBeDefined();
    expect(savedSessions[0].endWordIndex).toBe(wordBeforeExit);

    scheduler.destroy();
    testDb.close();
  });
});
