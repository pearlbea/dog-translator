import { describe, expect, it } from "vitest";
import { Ring } from "./ring";

describe("Ring", () => {
  it("is not full until size samples have been pushed", () => {
    const r = new Ring(4);
    [1, 2, 3].forEach((v) => r.push(v));
    expect(r.full).toBe(false);
    r.push(4);
    expect(r.full).toBe(true);
  });

  it("returns the newest `size` samples oldest-first after wrapping", () => {
    const r = new Ring(4);
    for (let v = 1; v <= 10; v++) r.push(v);
    expect(Array.from(r.snapshot())).toEqual([7, 8, 9, 10]);
  });

  it("is chronological when exactly full", () => {
    const r = new Ring(3);
    [1, 2, 3].forEach((v) => r.push(v));
    expect(Array.from(r.snapshot())).toEqual([1, 2, 3]);
  });
});
