/** Streaming linear-interpolation resampler; safe across arbitrary chunk boundaries. */
export class Resampler {
  private prev = 0; // last input sample of the previous chunk
  private pos = 0; // read position, relative to [prev, ...chunk]

  constructor(private ratio: number) {}

  process(chunk: Float32Array): number[] {
    const out: number[] = [];
    const n = chunk.length;
    const at = (i: number) => (i === 0 ? this.prev : chunk[i - 1]!);
    let pos = this.pos;
    while (pos < n) {
      const i = Math.floor(pos);
      const f = pos - i;
      out.push(at(i) * (1 - f) + at(i + 1) * f);
      pos += this.ratio;
    }
    // Next chunk's index 0 is this chunk's last sample, so shift by n.
    this.pos = pos - n;
    if (n > 0) this.prev = chunk[n - 1]!;
    return out;
  }
}
