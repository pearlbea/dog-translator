export interface WindowResult {
  /** Combined dog score for this window, 0..1 */
  score: number;
  /** Highest-scoring dog class in this window */
  topClass: string;
  /** RMS loudness of the window, 0..1 */
  rms: number;
  /** Window start time in ms */
  t: number;
}

export interface VocalizationEvent {
  peakScore: number;
  dominantClass: string;
  durationMs: number;
  rms: number;
}

export interface MergerOptions {
  threshold: number;
  /** Consecutive below-threshold windows before an event is closed */
  gapWindows: number;
  hopMs: number;
  windowMs: number;
}

/** Merges consecutive above-threshold windows into single vocalization events. */
export class EventMerger {
  private active: {
    startT: number;
    lastHitT: number;
    peak: number;
    rmsPeak: number;
    classVotes: Map<string, number>;
    misses: number;
  } | null = null;

  constructor(public opts: MergerOptions) {}

  /** Feed one window; returns a finished event when one closes. */
  push(w: WindowResult): VocalizationEvent | null {
    const hit = w.score >= this.opts.threshold;
    if (hit) {
      const a = (this.active ??= {
        startT: w.t,
        lastHitT: w.t,
        peak: 0,
        rmsPeak: 0,
        classVotes: new Map(),
        misses: 0,
      });
      a.lastHitT = w.t;
      a.misses = 0;
      a.peak = Math.max(a.peak, w.score);
      a.rmsPeak = Math.max(a.rmsPeak, w.rms);
      a.classVotes.set(w.topClass, (a.classVotes.get(w.topClass) ?? 0) + w.score);
      return null;
    }
    if (!this.active) return null;
    this.active.misses++;
    if (this.active.misses < this.opts.gapWindows) return null;
    return this.close();
  }

  private close(): VocalizationEvent {
    const a = this.active!;
    this.active = null;
    let dominantClass = "";
    let best = -1;
    for (const [cls, v] of a.classVotes) {
      if (v > best) {
        best = v;
        dominantClass = cls;
      }
    }
    return {
      peakScore: a.peak,
      dominantClass,
      durationMs: a.lastHitT - a.startT + this.opts.windowMs,
      rms: a.rmsPeak,
    };
  }

  /** Drops any open event, e.g. when listening stops. */
  reset(): void {
    this.active = null;
  }

  get isActive(): boolean {
    return this.active !== null;
  }
}
