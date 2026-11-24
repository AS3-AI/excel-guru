import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/RichText";
import { getArticle, getArticles } from "@/lib/learn";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import "../learn.css";

export function generateStaticParams() { return getArticles().map(({ slug }) => ({ fn: slug })); }

export async function generateMetadata({ params }: { params: Promise<{ fn: string }> }): Promise<Metadata> {
  const { fn } = await params;
  const article = getArticle(fn);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    openGraph: { title: article.title, description: article.description, type: "article" },
  };
}

function Grid({ grid }: { grid: NonNullable<ReturnType<typeof getArticle>>["sections"][number]["grid"] }) {
  if (!grid) return null;
  return <div className="learn-grid-wrap"><table className="learn-grid"><tbody>{grid.map((row, r) => <tr key={r}>
    {row.map((cell, c) => <td key={c}>{cell === null ? "" : String(cell)}</td>)}
  </tr>)}</tbody></table></div>;
}

export default async function LearnArticlePage({ params }: { params: Promise<{ fn: string }> }) {
  const { fn } = await params;
  const article = getArticle(fn);
  if (!article) notFound();
  const related = article.related.map((slug) => getArticle(slug)).filter((item) => item !== null);
  return <><SiteHeader current="learn" /><main className="learn-page" id="main"><article className="doc learn-article">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/learn">Guides</Link><Icon name="chevronRight" size={14} /><span aria-current="page">{article.fn}</span></nav>
    <h1>{article.title}</h1><p className="learn-description">{article.description}</p>
    <h2>Syntax</h2><p className="learn-syntax"><b aria-hidden="true">fx</b><code>{article.syntax}</code></p>
    <h2>Arguments</h2><ul className="learn-args">{article.args.map((arg) => <li key={arg.name}>
      <strong><code>{arg.name}</code> {arg.required ? "(required)" : "(optional)"}</strong><p><RichText text={arg.text} /></p>
    </li>)}</ul>
    {article.sections.map((section) => <section className="learn-section" key={section.heading}>
      <h2>{section.heading}</h2><p><RichText text={section.text} /></p><Grid grid={section.grid} />
      {section.formula && <p className="learn-example">Formula: <code>{section.formula}</code> → {String(section.result)}</p>}
    </section>)}
    {related.length > 0 && <section><h2>Related guides</h2><p className="learn-related">{related.map((item) => <Link key={item.slug} href={`/learn/${item.slug}`}>{item.fn}</Link>)}</p></section>}
  </article><aside className="learn-cta"><span>Ready to try <b>{article.fn}</b> yourself?</span><Link className="btn" href={`/lesson/${article.lessonId}`}>Continue to {article.fn} practice <Icon name="arrowRight" size={16} /></Link></aside></main><SiteFooter /></>;
}
