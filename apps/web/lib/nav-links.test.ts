import { describe, expect, it } from "vitest";
import { PROFILE_HREF, moduleHref } from "./nav-links";
import { MODULES } from "./modules";

describe("nav-links", () => {
  describe("PROFILE_HREF", () => {
    it("points to /profile", () => {
      expect(PROFILE_HREF).toBe("/profile");
    });
  });

  describe("moduleHref", () => {
    it("returns /modules/<slug> for a given slug", () => {
      expect(moduleHref("sum")).toBe("/modules/sum");
      expect(moduleHref("count")).toBe("/modules/count");
      expect(moduleHref("intro-to-shortcuts")).toBe("/modules/intro-to-shortcuts");
    });

    it("formats href correctly for every curriculum module slug", () => {
      for (const { slug } of MODULES) {
        expect(moduleHref(slug)).toBe(`/modules/${slug}`);
      }
    });
  });
});
