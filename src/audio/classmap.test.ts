import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseClassNames } from "./classmap";

describe("parseClassNames", () => {
  it("handles CRLF and quoted names", () => {
    const csv = 'index,mid,display_name\r\n0,/m/a,Speech\r\n1,/m/b,"Child speech, kid speaking"\r\n';
    expect(parseClassNames(csv)).toEqual(["Speech", "Child speech, kid speaking"]);
  });

  it("finds the dog classes at their YAMNet indices in the bundled map", () => {
    const names = parseClassNames(readFileSync("public/yamnet_class_map.csv", "utf8"));
    expect(names).toHaveLength(521);
    expect(names.indexOf("Dog")).toBe(69);
    expect(names.indexOf("Whimper (dog)")).toBe(75);
  });
});
