import {describe, expect, it} from 'vitest';
import {SwdScheduler, type SchedulerClock} from '../scheduler';
import {tokenize} from '../tokenizer';

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

describe('scheduler', () => {
  it('maintains zero drift over 2 minutes of simulated playback at 300 WPM', () => {
    // 800 plain short words without punctuation pauses -> 200ms per word -> 600 words in 120s
    const words = Array.from({length: 800}, (_, i) => `w${i}`).join(' ');
    const doc = tokenize(words);
    const clock = new FakeClock();
    const scheduler = new SwdScheduler({
      tokens: doc.tokens,
      wpm: 300,
      chunkSize: 1,
      punctuationPauseStrength: 0,
      clock,
    });

    scheduler.play();
    // Simulate 120 seconds with realistic irregular frame intervals (16.7ms)
    clock.advanceBy(120_000, 16.7);

    const state = scheduler.getState();
    // At 300 WPM, 120 seconds = 600 words (+/- 1 word for boundary tick)
    expect(state.wordIndex).toBeGreaterThanOrEqual(599);
    expect(state.wordIndex).toBeLessThanOrEqual(601);
    scheduler.destroy();
  });

  it('never skips words when a frame arrives late', () => {
    const doc = tokenize('one two three four five');
    const clock = new FakeClock();
    const seen: number[] = [];
    const scheduler = new SwdScheduler({
      tokens: doc.tokens,
      wpm: 300,
      punctuationPauseStrength: 0,
      clock,
    });
    scheduler.subscribe((s) => seen.push(s.wordIndex));

    scheduler.play();
    // Single huge 600ms frame stall (3x word duration) should advance only 1 word, never skip
    clock.advanceBy(600, 600);
    expect(scheduler.getState().wordIndex).toBe(1);
    scheduler.destroy();
  });

  it('supports pause, resume, seek, WPM change mid-play, and visibility auto-pause', () => {
    const doc = tokenize('one two three four five six seven eight.');
    const clock = new FakeClock();
    const scheduler = new SwdScheduler({
      tokens: doc.tokens,
      wpm: 300,
      punctuationPauseStrength: 0,
      clock,
    });

    scheduler.play();
    clock.advanceBy(210, 10);
    expect(scheduler.getState().wordIndex).toBe(1);

    scheduler.pause();
    clock.advanceBy(1000, 50);
    expect(scheduler.getState().wordIndex).toBe(1);
    expect(scheduler.getState().isPlaying).toBe(false);

    scheduler.seek(4);
    expect(scheduler.getState().wordIndex).toBe(4);

    scheduler.play();
    scheduler.setWpm(600);
    expect(scheduler.getState().wpm).toBe(600);

    scheduler.handleVisibilityChange(true);
    expect(scheduler.getState().isPlaying).toBe(false);

    // Becoming visible again must never auto-resume
    scheduler.handleVisibilityChange(false);
    expect(scheduler.getState().isPlaying).toBe(false);
    scheduler.destroy();
  });

  it('counts down 2 seconds via clock.now() and advances wordIndex afterward', () => {
    const doc = tokenize('one two three four five six');
    const clock = new FakeClock();
    const scheduler = new SwdScheduler({
      tokens: doc.tokens,
      wpm: 300, // 200ms per word
      chunkSize: 1,
      punctuationPauseStrength: 0,
      countdownSeconds: 2,
      clock,
    });

    scheduler.play();
    expect(scheduler.getState().phase).toBe('countdown');
    expect(scheduler.getState().countdownSecondsRemaining).toBe(2);
    expect(scheduler.getState().wordIndex).toBe(0);

    // Mid-countdown at 1.05s: countdown drops to 1, wordIndex stays at 0
    clock.advanceBy(1050, 50);
    expect(scheduler.getState().phase).toBe('countdown');
    expect(scheduler.getState().countdownSecondsRemaining).toBe(1);
    expect(scheduler.getState().wordIndex).toBe(0);

    // Finish remaining 950ms of countdown (total 2000ms): enters playing at wordIndex 0
    clock.advanceBy(950, 50);
    expect(scheduler.getState().phase).toBe('playing');
    expect(scheduler.getState().isPlaying).toBe(true);
    expect(scheduler.getState().countdownSecondsRemaining).toBe(0);
    expect(scheduler.getState().wordIndex).toBe(0);

    // Advance 450ms (~2.25 words at 200ms/word): wordIndex advances beyond 0
    clock.advanceBy(450, 50);
    expect(scheduler.getState().wordIndex).toBeGreaterThanOrEqual(2);
    scheduler.destroy();
  });
});
