import {clampChunkSize, getChunkAt, type ChunkSize, type WordChunk} from './chunker';
import {clampPauseStrength, clampWpm, computeChunkDurationMs} from './timing';
import type {WordToken} from './tokenizer';

export interface SchedulerClock {
  now: () => number;
  requestFrame: (callback: (timestamp: number) => void) => number;
  cancelFrame: (id: number) => void;
}

export interface SpeedRampOptions {
  enabled: boolean;
  stepWpm: number;
  everySeconds: number;
  maxWpm: number;
}

export interface ChunkExpansionOptions {
  enabled: boolean;
}

export type SchedulerPhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'completed';

export interface SchedulerState {
  phase: SchedulerPhase;
  isPlaying: boolean;
  isCompleted: boolean;
  countdownSecondsRemaining: number;
  wordIndex: number;
  fragmentIndex: 0 | 1;
  wpm: number;
  chunkSize: ChunkSize;
  currentChunk: WordChunk | null;
  activeSeconds: number;
}

export type SchedulerListener = (state: SchedulerState) => void;

export interface SchedulerOptions {
  tokens: readonly WordToken[];
  initialIndex?: number;
  wpm?: number;
  chunkSize?: ChunkSize;
  punctuationPauseStrength?: number;
  paragraphAutoPause?: boolean;
  countdownSeconds?: number;
  maxWpmCap?: number;
  speedRamp?: SpeedRampOptions;
  chunkExpansion?: ChunkExpansionOptions;
  clock?: SchedulerClock;
}

function createDefaultClock(): SchedulerClock {
  return {
    now: () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now(),
    requestFrame: (cb) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        return requestAnimationFrame(cb);
      }
      return setTimeout(() => cb(Date.now()), 16) as unknown as number;
    },
    cancelFrame: (id) => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(id);
      } else {
        clearTimeout(id);
      }
    },
  };
}

function clampCountdownSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(5, Math.round(seconds)));
}

export class SwdScheduler {
  private tokens: readonly WordToken[];
  private clock: SchedulerClock;
  private listeners = new Set<SchedulerListener>();

  private phase: SchedulerPhase = 'idle';
  private isPlaying = false;
  private isCompleted = false;
  private countdownSeconds = 0;
  private countdownSecondsRemaining = 0;
  private countdownEndAt = 0;

  private wordIndex = 0;
  private fragmentIndex: 0 | 1 = 0;
  private wpm: number;
  private chunkSize: ChunkSize;
  private punctuationPauseStrength: number;
  private paragraphAutoPause: boolean;
  private maxWpmCap?: number;
  private speedRamp: SpeedRampOptions;
  private chunkExpansion: ChunkExpansionOptions;

  private frameId: number | null = null;
  private nextAt = 0;
  private lastTickAt = 0;
  private activeSeconds = 0;
  private rampElapsedSeconds = 0;
  private expansionElapsedSeconds = 0;

  private cachedState: SchedulerState;

  constructor(options: SchedulerOptions) {
    this.tokens = options.tokens;
    this.clock = options.clock ?? createDefaultClock();
    this.maxWpmCap = options.maxWpmCap;
    this.wpm = this.applyWpmCap(clampWpm(options.wpm ?? 300));
    this.chunkSize = clampChunkSize(options.chunkSize ?? 1);
    this.punctuationPauseStrength = clampPauseStrength(
      options.punctuationPauseStrength ?? 1
    );
    this.paragraphAutoPause = options.paragraphAutoPause ?? false;
    this.countdownSeconds = clampCountdownSeconds(options.countdownSeconds ?? 0);
    this.speedRamp = options.speedRamp ?? {
      enabled: false,
      stepWpm: 25,
      everySeconds: 30,
      maxWpm: 600,
    };
    this.chunkExpansion = options.chunkExpansion ?? {enabled: false};
    this.wordIndex = this.clampWordIndex(options.initialIndex ?? 0);
    this.cachedState = this.buildState();
  }

  private clampWordIndex(idx: number): number {
    if (this.tokens.length === 0) return 0;
    return Math.max(0, Math.min(this.tokens.length - 1, Math.floor(idx)));
  }

  private applyWpmCap(wpm: number): number {
    if (this.maxWpmCap !== undefined) {
      return Math.min(wpm, clampWpm(this.maxWpmCap));
    }
    return wpm;
  }

  private buildState(): SchedulerState {
    const currentChunk = getChunkAt(this.tokens, this.wordIndex, this.chunkSize);
    return {
      phase: this.phase,
      isPlaying: this.isPlaying,
      isCompleted: this.isCompleted,
      countdownSecondsRemaining: this.countdownSecondsRemaining,
      wordIndex: this.wordIndex,
      fragmentIndex: this.fragmentIndex,
      wpm: this.wpm,
      chunkSize: this.chunkSize,
      currentChunk,
      activeSeconds: this.activeSeconds,
    };
  }

  // Referentially stable snapshot for React's useSyncExternalStore
  public getState(): SchedulerState {
    return this.cachedState;
  }

  public subscribe(listener: SchedulerListener, emitInitial = true): () => void {
    this.listeners.add(listener);
    if (emitInitial) {
      listener(this.cachedState);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.cachedState = this.buildState();
    for (const listener of this.listeners) {
      listener(this.cachedState);
    }
  }

  private getCurrentDisplayDurationMs(): number {
    const chunk = getChunkAt(this.tokens, this.wordIndex, this.chunkSize);
    if (!chunk) return 200;
    const totalChunkMs = computeChunkDurationMs(
      chunk,
      this.wpm,
      this.punctuationPauseStrength
    );
    // Split long-word display duration across 2 fragments when showing 1 word
    if (
      this.chunkSize === 1 &&
      chunk.tokens.length === 1 &&
      chunk.tokens[0].fragments.length === 2
    ) {
      return totalChunkMs / 2;
    }
    return totalChunkMs;
  }

  private startPlayingAt(now: number): void {
    this.phase = 'playing';
    this.isPlaying = true;
    this.isCompleted = false;
    this.countdownSecondsRemaining = 0;
    this.lastTickAt = now;
    this.nextAt = now + this.getCurrentDisplayDurationMs();
    this.emit();
    this.scheduleNextFrame();
  }

  public play(): void {
    if (
      this.tokens.length === 0 ||
      this.phase === 'playing' ||
      this.phase === 'countdown'
    ) {
      return;
    }

    if (this.isCompleted) {
      this.wordIndex = 0;
      this.fragmentIndex = 0;
      this.isCompleted = false;
    }

    const now = this.clock.now();

    if (this.countdownSeconds > 0) {
      this.phase = 'countdown';
      this.isPlaying = false;
      this.countdownSecondsRemaining = this.countdownSeconds;
      this.countdownEndAt = now + this.countdownSeconds * 1000;
      this.emit();
      this.scheduleNextFrame();
      return;
    }

    this.startPlayingAt(now);
  }

  public pause(): void {
    if (this.phase === 'countdown') {
      this.phase = 'paused';
      this.isPlaying = false;
      this.countdownSecondsRemaining = 0;
      if (this.frameId !== null) {
        this.clock.cancelFrame(this.frameId);
        this.frameId = null;
      }
      this.emit();
      return;
    }

    if (!this.isPlaying) return;
    const now = this.clock.now();
    if (this.lastTickAt > 0 && now > this.lastTickAt) {
      this.activeSeconds += (now - this.lastTickAt) / 1000;
    }
    this.phase = 'paused';
    this.isPlaying = false;
    if (this.frameId !== null) {
      this.clock.cancelFrame(this.frameId);
      this.frameId = null;
    }
    this.emit();
  }

  public seek(wordIndex: number): void {
    this.wordIndex = this.clampWordIndex(wordIndex);
    this.fragmentIndex = 0;
    this.isCompleted = false;

    if (this.phase === 'countdown') {
      this.phase = 'paused';
      this.countdownSecondsRemaining = 0;
      if (this.frameId !== null) {
        this.clock.cancelFrame(this.frameId);
        this.frameId = null;
      }
    } else if (this.phase === 'completed') {
      this.phase = 'paused';
    } else if (this.isPlaying) {
      const now = this.clock.now();
      this.lastTickAt = now;
      this.nextAt = now + this.getCurrentDisplayDurationMs();
    }
    this.emit();
  }

  public restart(): void {
    this.seek(0);
  }

  public setTokens(tokens: readonly WordToken[], startIndex = 0): void {
    this.pause();
    this.tokens = tokens;
    this.wordIndex = this.clampWordIndex(startIndex);
    this.fragmentIndex = 0;
    this.isCompleted = false;
    this.phase = 'idle';
    this.countdownSecondsRemaining = 0;
    this.emit();
  }

  public setWpm(wpm: number): void {
    const nextWpm = this.applyWpmCap(clampWpm(wpm));
    if (nextWpm === this.wpm) return;
    this.wpm = nextWpm;
    this.emit();
  }

  public setChunkSize(size: ChunkSize): void {
    const nextSize = clampChunkSize(size);
    if (nextSize === this.chunkSize) return;
    this.chunkSize = nextSize;
    this.fragmentIndex = 0;
    this.emit();
  }

  public setPunctuationPauseStrength(strength: number): void {
    this.punctuationPauseStrength = clampPauseStrength(strength);
  }

  public setParagraphAutoPause(enabled: boolean): void {
    this.paragraphAutoPause = enabled;
  }

  public setCountdownSeconds(seconds: number): void {
    this.countdownSeconds = clampCountdownSeconds(seconds);
  }

  public setMaxWpmCap(cap?: number): void {
    this.maxWpmCap = cap;
    const capped = this.applyWpmCap(this.wpm);
    if (capped !== this.wpm) {
      this.wpm = capped;
      this.emit();
    }
  }

  public setSpeedRamp(options: SpeedRampOptions): void {
    this.speedRamp = options;
  }

  public setChunkExpansion(options: ChunkExpansionOptions): void {
    this.chunkExpansion = options;
  }

  public handleVisibilityChange(hidden: boolean): void {
    if (hidden && (this.isPlaying || this.phase === 'countdown')) {
      this.pause();
    }
  }

  public destroy(): void {
    this.pause();
    this.listeners.clear();
  }

  private scheduleNextFrame(): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    this.frameId = this.clock.requestFrame((ts) => this.tick(ts));
  }

  private tick(frameTimestamp?: number): void {
    const now = frameTimestamp !== undefined ? frameTimestamp : this.clock.now();

    if (this.phase === 'countdown') {
      const remainingMs = this.countdownEndAt - now;
      if (remainingMs <= 0) {
        this.startPlayingAt(now);
        return;
      }
      const nextRemaining = Math.ceil(remainingMs / 1000);
      if (nextRemaining !== this.countdownSecondsRemaining) {
        this.countdownSecondsRemaining = nextRemaining;
        this.emit();
      }
      this.scheduleNextFrame();
      return;
    }

    if (this.phase !== 'playing' || !this.isPlaying) return;

    if (now > this.lastTickAt) {
      const dtSeconds = (now - this.lastTickAt) / 1000;
      this.activeSeconds += dtSeconds;
      this.updateExperiments(dtSeconds);
      this.lastTickAt = now;
    }

    if (now >= this.nextAt) {
      const chunk = getChunkAt(this.tokens, this.wordIndex, this.chunkSize);
      if (!chunk) {
        this.completePlayback();
        return;
      }

      // If single-word chunk has 2 display fragments and we are on fragment 0, show fragment 1 first
      if (
        this.chunkSize === 1 &&
        chunk.tokens.length === 1 &&
        chunk.tokens[0].fragments.length === 2 &&
        this.fragmentIndex === 0
      ) {
        this.fragmentIndex = 1;
        this.nextAt += this.getCurrentDisplayDurationMs();
        this.emit();
        this.scheduleNextFrame();
        return;
      }

      const nextWordIndex = chunk.endIndex + 1;
      if (nextWordIndex >= this.tokens.length) {
        this.completePlayback();
        return;
      }

      if (this.paragraphAutoPause && chunk.endsParagraph) {
        this.wordIndex = nextWordIndex;
        this.fragmentIndex = 0;
        this.phase = 'paused';
        this.isPlaying = false;
        this.frameId = null;
        this.emit();
        return;
      }

      // Advance exactly one chunk (never skip words even if frame is late)
      this.wordIndex = nextWordIndex;
      this.fragmentIndex = 0;
      // Preserve absolute schedule target without drift
      this.nextAt += this.getCurrentDisplayDurationMs();
      this.emit();
    }

    if (this.isPlaying) {
      this.scheduleNextFrame();
    }
  }

  private updateExperiments(dtSeconds: number): void {
    if (this.speedRamp.enabled && this.speedRamp.everySeconds > 0 && this.speedRamp.stepWpm > 0) {
      this.rampElapsedSeconds += dtSeconds;
      if (this.rampElapsedSeconds >= this.speedRamp.everySeconds) {
        const steps = Math.floor(this.rampElapsedSeconds / this.speedRamp.everySeconds);
        this.rampElapsedSeconds -= steps * this.speedRamp.everySeconds;
        const target = Math.min(
          this.speedRamp.maxWpm,
          this.wpm + steps * this.speedRamp.stepWpm
        );
        const capped = this.applyWpmCap(clampWpm(target));
        if (capped > this.wpm) {
          this.wpm = capped;
        }
      }
    }

    if (this.chunkExpansion.enabled) {
      this.expansionElapsedSeconds += dtSeconds;
      if (this.expansionElapsedSeconds >= 30 && this.chunkSize < 4) {
        this.expansionElapsedSeconds -= 30;
        this.chunkSize = clampChunkSize(this.chunkSize + 1);
      }
    }
  }

  private completePlayback(): void {
    this.phase = 'completed';
    this.isPlaying = false;
    this.isCompleted = true;
    this.countdownSecondsRemaining = 0;
    this.fragmentIndex = 0;
    if (this.tokens.length > 0) {
      this.wordIndex = this.tokens.length - 1;
    }
    this.frameId = null;
    this.emit();
  }
}
