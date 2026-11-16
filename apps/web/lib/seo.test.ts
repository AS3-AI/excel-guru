import { describe, expect, it } from "vitest";
import {
  STATIC_METADATA,
  buildMetadata,
  buildRobots,
  buildSitemap,
  lessonMetadata,
  moduleMetadata,
  pageTitle,
  siteUrl,
} from "./seo";

describe("siteUrl", () => {
  it("uses provided base URL or defaults to excelguru.in", () => {
    expect(siteUrl("/pricing", "https://excelguru.dev")).toBe("https://excelguru.dev/pricing");
    expect(siteUrl("pricing", "https://excelguru.dev")).toBe("https://excelguru.dev/pricing");
    expect(siteUrl("/", "https://excelguru.dev/")).toBe("https://excelguru.dev/");
  });

  it("handles empty path", () => {
    expect(siteUrl("", "https://excelguru.dev")).toBe("https://excelguru.dev");
  });
});

describe("pageTitle", () => {
  it("formats title with site suffix", () => {
    expect(pageTitle("Pricing & Plans")).toBe("Pricing & Plans — Excel Guru");
    expect(pageTitle("SUM Function")).toBe("SUM Function — Excel Guru");
  });

  it("returns default brand title when empty", () => {
    expect(pageTitle()).toBe("Excel Guru — Learn Excel by typing real formulas");
    expect(pageTitle("")).toBe("Excel Guru — Learn Excel by typing real formulas");
  });
});

describe("buildMetadata", () => {
  it("constructs full metadata object including OpenGraph, Twitter, and canonical", () => {
    const meta = buildMetadata({
      title: "Help & FAQ",
      description: "Get answers to frequently asked questions.",
      path: "/help",
      baseUrl: "https://excelguru.dev",
    });

    expect(meta.title).toBe("Help & FAQ — Excel Guru");
    expect(meta.description).toBe("Get answers to frequently asked questions.");
    expect(meta.openGraph).toEqual({
      title: "Help & FAQ — Excel Guru",
      description: "Get answers to frequently asked questions.",
      url: "https://excelguru.dev/help",
      siteName: "Excel Guru",
      type: "website",
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: "Help & FAQ — Excel Guru",
      description: "Get answers to frequently asked questions.",
    });
    expect(meta.alternates?.canonical).toBe("https://excelguru.dev/help");
    expect(meta.robots).toBeUndefined();
  });

  it("adds robots noindex when specified", () => {
    const meta = buildMetadata({
      title: "Log in",
      description: "Log in to your account.",
      noIndex: true,
    });

    expect(meta.title).toBe("Log in — Excel Guru");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("supports private pages with noIndex and without canonical alternates", () => {
    const meta = buildMetadata({
      title: "Learning Dashboard",
      description: "Track your completed Excel lessons.",
      noIndex: true,
    });

    expect(meta.title).toBe("Learning Dashboard — Excel Guru");
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph?.url).toBeUndefined();
  });
});

describe("lessonMetadata", () => {
  it("creates rich metadata for existing lesson", () => {
    const meta = lessonMetadata(
      { id: "count-1", title: "COUNT Function", module: "COUNT" },
      "https://excelguru.dev",
    );

    expect(meta.title).toBe("COUNT Function — Excel Guru");
    expect(meta.description).toContain("COUNT Function");
    expect(meta.openGraph?.title).toBe("COUNT Function — Excel Guru");
    expect(meta.openGraph?.url).toBe("https://excelguru.dev/lesson/count-1");
  });

  it("returns noindex metadata when lesson is not found", () => {
    const meta = lessonMetadata(null);
    expect(meta.title).toBe("Lesson not found — Excel Guru");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("moduleMetadata", () => {
  it("creates rich metadata for curriculum module", () => {
    const meta = moduleMetadata(
      { slug: "sum", title: "SUM", total: 9 },
      "https://excelguru.dev",
    );

    expect(meta.title).toBe("SUM Excel Lessons — Excel Guru");
    expect(meta.description).toContain("9 interactive hands-on lessons");
    expect(meta.openGraph?.url).toBe("https://excelguru.dev/modules/sum");
  });

  it("returns noindex metadata when module is not found", () => {
    const meta = moduleMetadata(null);
    expect(meta.title).toBe("Module not found — Excel Guru");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildSitemap", () => {
  it("includes only public pages (landing, pricing, learn, learn/<slug>, modules/<slug>, help, privacy, terms)", () => {
    const sitemap = buildSitemap({
      baseUrl: "https://excelguru.dev",
      learnSlugs: ["sum", "count"],
      modules: [{ slug: "sum" }, { slug: "count" }],
      now: new Date("2026-11-16T00:00:00Z"),
    });

    const urls = sitemap.map((item) => item.url);
    expect(urls).toEqual([
      "https://excelguru.dev/",
      "https://excelguru.dev/pricing",
      "https://excelguru.dev/learn",
      "https://excelguru.dev/learn/sum",
      "https://excelguru.dev/learn/count",
      "https://excelguru.dev/modules/sum",
      "https://excelguru.dev/modules/count",
      "https://excelguru.dev/help",
      "https://excelguru.dev/privacy",
      "https://excelguru.dev/terms",
    ]);

    // Lessons are behind sign-in and should NOT be in the sitemap
    expect(urls).not.toContain("https://excelguru.dev/lesson/intro");
    expect(urls).not.toContain("https://excelguru.dev/lesson/sum-1");

    // Private and unindexed routes should NOT be in sitemap
    expect(urls).not.toContain("https://excelguru.dev/dashboard");
    expect(urls).not.toContain("https://excelguru.dev/profile");
    expect(urls).not.toContain("https://excelguru.dev/admin");
    expect(urls).not.toContain("https://excelguru.dev/onboarding");
    expect(urls).not.toContain("https://excelguru.dev/sandbox");
    expect(urls).not.toContain("https://excelguru.dev/review");
    expect(urls).not.toContain("https://excelguru.dev/login");
    expect(urls).not.toContain("https://excelguru.dev/signup");
    expect(urls).not.toContain("https://excelguru.dev/api/progress");

    // Homepage has priority 1.0
    const home = sitemap.find((entry) => entry.url === "https://excelguru.dev/");
    expect(home?.priority).toBe(1.0);
    expect(home?.changeFrequency).toBe("weekly");
  });
});

describe("buildRobots", () => {
  it("returns rules that allow public crawling and disallow private routes", () => {
    const robots = buildRobots({ baseUrl: "https://excelguru.dev" });
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/onboarding",
        "/sandbox",
      ],
    });
    expect(robots.sitemap).toBe("https://excelguru.dev/sitemap.xml");
  });
});

describe("STATIC_METADATA", () => {
  it("has titles and descriptions for key static pages", () => {
    expect(STATIC_METADATA.landing.title).toBeTruthy();
    expect(STATIC_METADATA.landing.description).toBeTruthy();
    expect(STATIC_METADATA.pricing.title).toBeTruthy();
    expect(STATIC_METADATA.pricing.description).toBeTruthy();
    expect(STATIC_METADATA.help.title).toBeTruthy();
    expect(STATIC_METADATA.help.description).toBeTruthy();
    expect(STATIC_METADATA.privacy.title).toBeTruthy();
    expect(STATIC_METADATA.privacy.description).toBeTruthy();
    expect(STATIC_METADATA.terms.title).toBeTruthy();
    expect(STATIC_METADATA.terms.description).toBeTruthy();
    expect(STATIC_METADATA.dashboard.title).toBeTruthy();
    expect(STATIC_METADATA.dashboard.description).toBeTruthy();
  });

  it("describes realistic content with 80+ lessons and no unbuilt features", () => {
    expect(STATIC_METADATA.landing.description).toContain("80+");
    expect(STATIC_METADATA.landing.description).not.toContain("86");
    expect(STATIC_METADATA.pricing.description).toContain("80+");
    expect(STATIC_METADATA.pricing.description).not.toContain("86");
    expect(STATIC_METADATA.pricing.description).not.toContain("real-data projects");
    expect(STATIC_METADATA.pricing.description).not.toContain("daily challenges");
    expect(STATIC_METADATA.pricing.description).not.toContain("verifiable certificate");
  });

  it("does not claim Stripe in privacy description", () => {
    expect(STATIC_METADATA.privacy.description.toLowerCase()).not.toContain("stripe");
  });
});
