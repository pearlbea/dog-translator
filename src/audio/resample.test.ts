import { describe, expect, it } from "vitest";
import { Resampler } from "./resample";

const sine = (n: number, rate: number) =>
  Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / rate));

function run(input: Float32Array, ratio: number, chunkSize: number): number[] {
  const r = new Resampler(ratio);
  const out: number[] = [];
  for (let i = 0; i < input.length; i += chunkSize) out.push(...r.process(input.slice(i, i + chunkSize)));
  return out;
}

describe("Resampler", () => {
  it("never produces NaN, including with ratios that straddle chunk edges", () => {
    for (const [rate, chunk] of [[48000, 128], [44100, 128], [44100, 100], [32000, 7]] as const) {
      const out = run(sine(rate, rate), rate / 16000, chunk);
      expect(out.every(Number.isFinite)).toBe(true);
    }
  });

  it("yields ~16000 samples per second of 44.1 kHz input", () => {
    const out = run(sine(44100, 44100), 44100 / 16000, 128);
    expect(Math.abs(out.length - 16000)).toBeLessThan(5);
  });

  it("is independent of chunking", () => {
    const input = sine(44100, 44100);
    const a = run(input, 44100 / 16000, 128);
    const b = run(input, 44100 / 16000, 1000);
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) expect(a[i]).toBeCloseTo(b[i]!, 5);
  });
});
