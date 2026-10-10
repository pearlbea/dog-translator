import { describe, expect, it } from "vitest";
import { EventMerger, type VocalizationEvent, type WindowResult } from "./events";

const opts = { threshold: 0.4, gapWindows: 2, hopMs: 500, windowMs: 975 };
const win = (i: number, score: number, topClass = "Bark"): WindowResult => ({
  score,
  topClass,
  rms: 0.1 + score / 10,
  t: i * opts.hopMs,
});

function run(scores: number[], classes: string[] = []) {
  const m = new EventMerger({ ...opts });
  const out: VocalizationEvent[] = [];
  scores.forEach((s, i) => {
    const e = m.push(win(i, s, classes[i] ?? "Bark"));
    if (e) out.push(e);
  });
  return out;
}

describe("EventMerger", () => {
  it("ignores sub-threshold audio", () => {
    expect(run([0.1, 0.2, 0.39, 0.1, 0.1])).toEqual([]);
  });

  it("merges consecutive hits into one event", () => {
    const events = run([0, 0.5, 0.8, 0.6, 0, 0]);
    expect(events).toHaveLength(1);
    expect(events[0]!.peakScore).toBe(0.8);
    expect(events[0]!.durationMs).toBe(1000 + 975);
  });

  it("bridges a single-window gap", () => {
    expect(run([0.5, 0, 0.6, 0, 0])).toHaveLength(1);
  });

  it("splits events separated by a long gap", () => {
    expect(run([0.5, 0, 0, 0.7, 0, 0])).toHaveLength(2);
  });

  it("picks the dominant class by weighted votes", () => {
    const [e] = run([0.5, 0.9, 0.5, 0, 0], ["Bark", "Howl", "Bark"]);
    expect(e!.dominantClass).toBe("Bark");
    const [h] = run([0.5, 0.9, 0.9, 0, 0], ["Bark", "Howl", "Howl"]);
    expect(h!.dominantClass).toBe("Howl");
  });

  it("does not emit an event while still active", () => {
    const m = new EventMerger({ ...opts });
    expect(m.push(win(0, 0.9))).toBeNull();
    expect(m.isActive).toBe(true);
  });
});

describe("EventMerger.reset", () => {
  it("discards an open event", () => {
    const m = new EventMerger({ ...opts });
    m.push(win(0, 0.9));
    m.reset();
    expect(m.isActive).toBe(false);
    expect(m.push(win(1, 0))).toBeNull();
  });
});
