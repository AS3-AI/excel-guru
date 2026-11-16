import { describe, expect, it } from "vitest";
import { DASHBOARD_HREF, moduleHref } from "./nav-links";
import { MODULES } from "./modules";

describe("nav-links", () => {
  describe("DASHBOARD_HREF", () => {
    it("points to /dashboard", () => {
      expect(DASHBOARD_HREF).toBe("/dashboard");
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
