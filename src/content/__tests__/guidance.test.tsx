// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from '../../App';
import {AppProvider} from '../../context/AppContext';
import {ReaderChromeProvider} from '../../context/ReaderChromeContext';
import {getChunkAt} from '../../engine/chunker';
import {tokenize} from '../../engine/tokenizer';
import {HelpScreen} from '../../features/help/HelpScreen';
import {ReaderControls} from '../../features/reader/ReaderControls';
import {ReaderDisplay} from '../../features/reader/ReaderDisplay';
import {ReaderSettingsSheet} from '../../features/reader/ReaderSettingsSheet';
import {DEFAULT_READER_SETTINGS, db} from '../../services/storage/db';
import {loadGlobalSettings} from '../../services/storage/repositories';
import {CONTROL_INFO_TOPICS, type ControlInfoTopicId, WELCOME_SEEN_KEY} from '../guidance';

function installBrowserStubs() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}

async function clearStorageState() {
  localStorage.clear();
  window.location.hash = '#/';
  await db.documents.clear();
  await db.contents.clear();
  await db.progress.clear();
  await db.sessions.clear();
  await db.settings.clear();
}

describe('guidance copy & onboarding flows', () => {
  beforeEach(async () => {
    installBrowserStubs();
    await clearStorageState();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps src/content/guidance.ts free of em dashes, en dashes, and the retired acronym', () => {
    const guidancePath = path.resolve(process.cwd(), 'src/content/guidance.ts');
    const source = fs.readFileSync(guidancePath, 'utf8');
    const retiredAcronym = new RegExp(String.fromCharCode(114, 115, 118, 112), 'i');

    expect(source).not.toContain('\u2014');
    expect(source).not.toContain('\u2013');
    expect(source).not.toMatch(retiredAcronym);
  });

  it('shows the welcome tour once on first launch on Library, remembers dismissal across launches, and reopens from Help', async () => {
    const firstMount = render(<App />);

    // Welcome modal appears on Library at Step 1
    expect(await screen.findByTestId('welcome-modal')).toBeTruthy();
    expect(screen.getByText('Read one word at a time')).toBeTruthy();
    expect(screen.getByRole('button', {name: /Step 1:/i}).getAttribute('aria-current')).toBe('step');

    // Step forward and back
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByText('Words per flash')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(screen.getByText('Read one word at a time')).toBeTruthy();

    // Skip dismisses and persists welcome seen flag
    fireEvent.click(screen.getByRole('button', {name: 'Skip'}));
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');

    firstMount.unmount();

    // Second launch does not show welcome modal again
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', {name: 'Library'})).toBeTruthy();
    });
    expect(screen.queryByTestId('welcome-modal')).toBeNull();

    // Navigate to Help and trigger "Show the welcome tour again"
    window.location.hash = '#/help';
    fireEvent(window, new HashChangeEvent('hashchange'));
    const reopenBtn = await screen.findByRole('button', {name: 'Show the welcome tour again'});
    fireEvent.click(reopenBtn);

    expect(await screen.findByTestId('welcome-modal')).toBeTruthy();
    expect(screen.getByText('Read one word at a time')).toBeTruthy();

    // Advance to Step 3 and close with Secondary Close button
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByText('Start gently')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');
  });

  it('never shows the welcome tour on top of the reader route', async () => {
    window.location.hash = '#/read/missing-doc';
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Document not found in local library.')).toBeTruthy();
    });
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
  });

  it('"Try the sample" loads the sample at 1 word and 250 WPM, opens the reader, and does not stack the comfort notice on the same visit', async () => {
    const firstMount = render(<App />);

    expect(await screen.findByTestId('welcome-modal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByText('Start gently')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'Try the sample'}));

    await waitFor(() => {
      expect(window.location.hash).toMatch(/^#\/read\//);
      expect(screen.getByTestId('focal-stage')).toBeTruthy();
    });

    // Settings persisted as 1 word and 250 WPM
    expect(screen.getByText('250 WPM')).toBeTruthy();
    expect(
      screen.getByRole('button', {name: '1 word per flash'}).getAttribute('aria-pressed')
    ).toBe('true');

    const persisted = await loadGlobalSettings();
    expect(persisted.wordsPerFlash).toBe(1);
    expect(persisted.wpm).toBe(250);

    // Same-visit comfort notice must NOT stack on top of the reader
    expect(screen.queryByRole('region', {name: 'Comfort notice'})).toBeNull();

    firstMount.unmount();

    // On a subsequent visit after welcome was seen, comfort notice shows once in the reader
    const docs = await db.documents.toArray();
    expect(docs.length).toBeGreaterThan(0);
    window.location.hash = `#/read/${encodeURIComponent(docs[0].id)}`;

    render(<App />);
    expect(await screen.findByRole('region', {name: 'Comfort notice'})).toBeTruthy();
  });

  it('opens every settings sheet info popover via tap, Enter, and Space, closes on Esc returning focus, and renders "How Orpela works"', async () => {
    const onClose = vi.fn();
    const onOpenGuidance = vi.fn();
    const onPauseForInfo = vi.fn();
    const onUpdateSettings = vi.fn(async () => {});

    render(
      <ReaderSettingsSheet
        open={true}
        settings={DEFAULT_READER_SETTINGS}
        onClose={onClose}
        onUpdateSettings={onUpdateSettings}
        onOpenGuidance={onOpenGuidance}
        onPauseForInfo={onPauseForInfo}
      />
    );

    const howLink = screen.getByRole('button', {name: /How Orpela works/i});
    fireEvent.click(howLink);
    expect(onOpenGuidance).toHaveBeenCalledTimes(1);

    const topicIds: ControlInfoTopicId[] = [
      'speed',
      'wordsPerFlash',
      'highlightLetter',
      'punctuationPause',
      'speedRamp',
      'chunkExpansion',
      'contextPane',
    ];

    for (const id of topicIds) {
      const topic = CONTROL_INFO_TOPICS[id];
      const trigger = screen.getByTestId(`info-btn-${id}`);
      trigger.focus();

      // Open via tap/click
      fireEvent.click(trigger);
      const popover = screen.getByTestId(`info-popover-${id}`);
      expect(popover.textContent).toContain(topic.description);

      // Close via Escape -> returns focus to trigger and keeps settings sheet open
      fireEvent.keyDown(window, {key: 'Escape'});
      await waitFor(() => {
        expect(screen.queryByTestId(`info-popover-${id}`)).toBeNull();
        expect(document.activeElement).toBe(trigger);
      });
      expect(onClose).not.toHaveBeenCalled();

      // Open via Enter
      fireEvent.keyDown(trigger, {key: 'Enter'});
      expect(screen.getByTestId(`info-popover-${id}`)).toBeTruthy();
      fireEvent.keyDown(window, {key: 'Escape'});
      await waitFor(() => {
        expect(screen.queryByTestId(`info-popover-${id}`)).toBeNull();
        expect(document.activeElement).toBe(trigger);
      });

      // Open via Space
      fireEvent.keyDown(trigger, {key: ' ', code: 'Space'});
      expect(screen.getByTestId(`info-popover-${id}`)).toBeTruthy();
      fireEvent.keyDown(window, {key: 'Escape'});
      await waitFor(() => {
        expect(screen.queryByTestId(`info-popover-${id}`)).toBeNull();
        expect(document.activeElement).toBe(trigger);
      });
    }
  });

  it('pauses playback when reader control info buttons open and never moves or resizes the focal stage', async () => {
    const {tokens} = tokenize('One steady stage even when info popovers appear over controls.');
    const chunk = getChunkAt(tokens, 0, 1);
    const noop = () => {};

    const TestReaderView: React.FC = () => {
      const [isPlaying, setIsPlaying] = React.useState(true);
      return (
        <div className="relative h-[100dvh] flex flex-col overflow-hidden">
          <div className="relative flex-1 flex flex-col min-h-0">
            <ReaderDisplay
              tokens={tokens}
              chunk={chunk}
              fragmentIndex={0}
              isPlaying={isPlaying}
              isCompleted={false}
              countdownRemaining={0}
              settings={DEFAULT_READER_SETTINGS}
              isPhone={false}
              onTogglePlayPause={() => setIsPlaying((p) => !p)}
              onPrevSentence={noop}
              onNextSentence={noop}
              onAdjustWpm={noop}
              onRevealControls={noop}
            />
          </div>
          <ReaderControls
            visible={true}
            isPlaying={isPlaying}
            isCountingDown={false}
            isPlainView={false}
            wpm={250}
            chunkSize={1}
            progress={{
              wordIndex: 0,
              totalWords: tokens.length,
              wordsRead: 0,
              wordsRemaining: tokens.length,
              percentage: 0,
              estimatedSecondsRemaining: 10,
            }}
            onTogglePlayPause={() => setIsPlaying((p) => !p)}
            onRestart={noop}
            onPrevSentence={noop}
            onNextSentence={noop}
            onPrevParagraph={noop}
            onNextParagraph={noop}
            onSeekPercentage={noop}
            onAdjustWpm={noop}
            onChunkSizeChange={noop}
            onPauseForInfo={() => setIsPlaying(false)}
          />
        </div>
      );
    };

    render(
      <AppProvider>
        <ReaderChromeProvider>
          <TestReaderView />
        </ReaderChromeProvider>
      </AppProvider>
    );

    const stage = screen.getByTestId('focal-stage');
    const styleBefore = stage.getAttribute('style');
    const classBefore = stage.getAttribute('class');
    const rectBefore = stage.getBoundingClientRect();

    // Playback starts active (Pause button visible)
    expect(screen.getByRole('button', {name: 'Pause reading'})).toBeTruthy();

    // Open Speed info button via Space keyboard interaction
    const speedBtn = screen.getByTestId('info-btn-speed');
    speedBtn.focus();
    fireEvent.keyDown(speedBtn, {key: ' ', code: 'Space'});

    // Playback paused immediately and popover visible
    expect(screen.getByRole('button', {name: 'Play reading'})).toBeTruthy();
    expect(screen.getByTestId('info-popover-speed')).toBeTruthy();

    // Focal stage layout/style/size untouched
    expect(stage.getAttribute('style')).toBe(styleBefore);
    expect(stage.getAttribute('class')).toBe(classBefore);
    expect(stage.getBoundingClientRect()).toEqual(rectBefore);

    // Close with Esc and confirm focus returns to speed info button
    fireEvent.keyDown(window, {key: 'Escape'});
    await waitFor(() => {
      expect(screen.queryByTestId('info-popover-speed')).toBeNull();
      expect(document.activeElement).toBe(speedBtn);
    });

    // Now test Words per flash info button via tap
    const wpfBtn = screen.getByTestId('info-btn-wordsPerFlash');
    fireEvent.click(wpfBtn);
    expect(screen.getByTestId('info-popover-wordsPerFlash')).toBeTruthy();
    expect(stage.getAttribute('style')).toBe(styleBefore);
    expect(stage.getAttribute('class')).toBe(classBefore);
    expect(stage.getBoundingClientRect()).toEqual(rectBefore);
  });

  it('renders all new Help guidance sections above keyboard shortcuts alongside install and privacy guidance', () => {
    render(
      <AppProvider>
        <HelpScreen />
      </AppProvider>
    );

    const html = document.body.innerHTML;
    const howToReadIdx = html.indexOf('How to read with Orpela');
    const wpfIdx = html.indexOf('Words per flash, explained');
    const practiceIdx = html.indexOf('How to practice');
    const noteIdx = html.indexOf('A note on speed reading');
    const shortcutsIdx = html.indexOf('Keyboard &amp; Touch Controls');

    expect(howToReadIdx).toBeGreaterThan(-1);
    expect(wpfIdx).toBeGreaterThan(howToReadIdx);
    expect(practiceIdx).toBeGreaterThan(wpfIdx);
    expect(noteIdx).toBeGreaterThan(practiceIdx);
    expect(shortcutsIdx).toBeGreaterThan(noteIdx);

    expect(screen.getByText('Install as an Offline App')).toBeTruthy();
    expect(screen.getByText('Privacy & Data Retention')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Show the welcome tour again'})).toBeTruthy();
  });
});
