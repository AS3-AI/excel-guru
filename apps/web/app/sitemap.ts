import type { MetadataRoute } from "next";
import { getArticles } from "@/lib/learn";
import { MODULES } from "@/lib/modules";
import { buildSitemap, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteUrl();
  const articles = getArticles();
  return buildSitemap({
    baseUrl,
    learnSlugs: articles.map((article) => article.slug),
    modules: MODULES,
  });
}
