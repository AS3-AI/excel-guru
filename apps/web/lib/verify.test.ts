import { describe, expect, it } from "vitest";
import { escapeIlikePrefix } from "./verify";

describe("escapeIlikePrefix", () => {
  it("lowercases and trims normal names", () => {
    expect(escapeIlikePrefix("  Ashish  ")).toBe("ashish");
  });

  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeIlikePrefix("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });

  it("returns empty string for wildcard-only or blank queries", () => {
    expect(escapeIlikePrefix("")).toBe("");
    expect(escapeIlikePrefix("   ")).toBe("");
    expect(escapeIlikePrefix("%")).toBe("");
    expect(escapeIlikePrefix("___")).toBe("");
    expect(escapeIlikePrefix("%_\\")).toBe("");
  });
});
