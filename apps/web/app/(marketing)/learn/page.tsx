import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/learn";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import "./learn.css";

export const metadata: Metadata = {
  title: "Excel Function Guides",
  description: "Clear guides to Excel functions, with examples and hands-on practice.",
  openGraph: {
    title: "Excel Function Guides",
    description: "Clear guides to Excel functions, with examples and hands-on practice.",
  },
};

export default function LearnIndex() {
  const articles = getArticles();
  return <><SiteHeader current="learn" /><main className="doc learn-page" id="main">
    <p className="eyebrow"><span className="ref">fx</span>Function guides</p>
    <h1>Excel function guides</h1>
    <p className="lead">Understand useful Excel functions with worked examples, then practise them in an interactive lesson.</p>
    <ul className="learn-index">{articles.map((article) => <li key={article.slug}>
      <Link href={`/learn/${article.slug}`}><span className="learn-fn">{article.fn}</span><span className="learn-desc">{article.description}</span><Icon name="arrowRight" size={16} /></Link>
    </li>)}</ul>
  </main><SiteFooter /></>;
}
