import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/learn";
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
  return <main className="learn-page"><div className="learn-wrap">
    <Link className="learn-brand" href="/">Excel Guru</Link>
    <h1>Excel function guides</h1>
    <p className="learn-description">Understand useful Excel functions with worked examples, then practice them in an interactive lesson.</p>
    <ul className="learn-args">{articles.map((article) => <li key={article.slug}>
      <h2><Link href={`/learn/${article.slug}`}>{article.fn}</Link></h2><p>{article.description}</p>
    </li>)}</ul>
  </div></main>;
}
