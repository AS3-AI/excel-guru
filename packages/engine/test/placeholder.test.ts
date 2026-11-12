import { describe, expect, it } from "vitest";
import * as mod from "../src/index";

describe("@excel-guru/engine", () => {
  it("loads", () => {
    expect(mod).toBeDefined();
  });
});
