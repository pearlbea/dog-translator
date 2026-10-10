import { describe, expect, it } from "vitest";
import { isCleanLine } from "./translate";

describe("isCleanLine", () => {
  it("accepts short lines", () => {
    expect(isCleanLine("Dinner is late. Hope fades.")).toBe(true);
    expect(isCleanLine("Breaking news: mailman violated my lawn again.")).toBe(true);
  });

  it("accepts jokes that happen to use 'count' or 'word'", () => {
    expect(isCleanLine("Count the treats, human.")).toBe(true);
    expect(isCleanLine("Not a word. Betrayal.")).toBe(true);
  });

  it("rejects leaked word-counting", () => {
    const leaked =
      "Twelve minutes past dinner. The bowl remains empty. Count: Twelve(1) minutes(2) past(3) dinner(4). Too many. Need 6 or fewer. Dinner is late. Hope fades. Five words, fine.";
    expect(isCleanLine(leaked)).toBe(false);
    expect(isCleanLine("Dinner(1) is(2) late(3)")).toBe(false);
  });

  it("rejects rambling and multi-line replies", () => {
    expect(isCleanLine("one two three four five six seven eight nine ten eleven twelve thirteen")).toBe(false);
    expect(isCleanLine("Dinner is late.\nHope fades.")).toBe(false);
    expect(isCleanLine("")).toBe(false);
  });
});
