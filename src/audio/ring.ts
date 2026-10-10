/** Fixed-size ring buffer that hands back its contents oldest-first without per-sample allocation. */
export class Ring {
  private buf: Float32Array;
  private writePos = 0;
  private count = 0;

  constructor(readonly size: number) {
    this.buf = new Float32Array(size);
  }

  push(v: number): void {
    this.buf[this.writePos] = v;
    this.writePos = (this.writePos + 1) % this.size;
    if (this.count < this.size) this.count++;
  }

  get full(): boolean {
    return this.count === this.size;
  }

  /** Copy of the contents in chronological order (only meaningful when full). */
  snapshot(): Float32Array {
    const out = new Float32Array(this.size);
    out.set(this.buf.subarray(this.writePos), 0);
    out.set(this.buf.subarray(0, this.writePos), this.size - this.writePos);
    return out;
  }
}
