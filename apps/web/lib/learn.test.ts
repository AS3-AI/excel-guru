import { describe, expect, it } from "vitest";
import { getArticle, getArticles } from "./learn";

describe("learn articles", () => {
  it("loads articles in slug order and finds SUM", () => {
    expect(getArticles().map((article) => article.slug)).toContain("sum");
    expect(getArticle("sum")?.fn).toBe("SUM");
  });

  it("rejects unsafe and unknown slugs", () => {
    expect(getArticle("../order")).toBeNull();
    expect(getArticle("unknown-article")).toBeNull();
  });
});
