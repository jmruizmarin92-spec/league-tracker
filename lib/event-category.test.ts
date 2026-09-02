import { describe, expect, it } from "vitest";
import { CATEGORIES, requiresListByDefault } from "./event-category";

describe("requiresListByDefault", () => {
  it("is on for cups and challenges only", () => {
    expect(requiresListByDefault("cup")).toBe(true);
    expect(requiresListByDefault("challenge")).toBe(true);
    for (const c of CATEGORIES.map((c) => c.value)) {
      if (c !== "cup" && c !== "challenge") expect(requiresListByDefault(c)).toBe(false);
    }
  });

  it("is off with no category", () => {
    expect(requiresListByDefault("")).toBe(false);
    expect(requiresListByDefault(null)).toBe(false);
    expect(requiresListByDefault(undefined)).toBe(false);
  });
});
