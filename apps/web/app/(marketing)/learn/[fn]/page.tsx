import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/RichText";
import { getArticle, getArticles } from "@/lib/learn";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";

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
  return <div className="my-s4 w-fit max-w-full overflow-x-auto rounded-ledger border-2 border-solid border-ink bg-surface"><table className="border-collapse font-ledger-code text-[0.88rem] font-medium tabular-nums [&_td]:min-w-[88px] [&_td]:border-r [&_td]:border-b [&_td]:border-solid [&_td]:border-border [&_td]:px-[12px] [&_td]:py-[8px] [&_tr:first-child_td]:bg-surface-sunk [&_tr:first-child_td]:font-semibold [&_tr:first-child_td]:text-ink"><tbody>{grid.map((row, r) => <tr key={r}>
    {row.map((cell, c) => <td key={c}>{cell === null ? "" : String(cell)}</td>)}
  </tr>)}</tbody></table></div>;
}

export default async function LearnArticlePage({ params }: { params: Promise<{ fn: string }> }) {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const { fn } = await params;
  const article = getArticle(fn);
  if (!article) notFound();
  const related = article.related.map((slug) => getArticle(slug)).filter((item) => item !== null);
  return <><SiteHeader signedIn={!!user} current="learn" /><main className="pb-[96px]" id="main"><article className="doc [&_h1]:mb-s3 [&_li]:leading-[1.75] [&_p]:leading-[1.75] [&>h2]:mt-s7 [&>h2]:mb-s3 [&>h2]:text-ledger-lg">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/learn">Guides</Link><Icon name="chevronRight" size={14} /><span aria-current="page">{article.fn}</span></nav>
    <h1>{article.title}</h1><p className="m-0 mb-s6 max-w-[40rem] text-ledger-md text-muted">{article.description}</p>
    <h2>Syntax</h2><p className="flex items-stretch overflow-hidden rounded-ledger border-2 border-solid border-ink bg-surface [&_b]:grid [&_b]:place-items-center [&_b]:border-r [&_b]:border-solid [&_b]:border-border [&_b]:bg-surface-sunk [&_b]:px-s3 [&_b]:font-ledger-code [&_b]:text-ledger-sm [&_b]:font-semibold [&_b]:italic [&_b]:text-primary-strong [&_code]:px-s4 [&_code]:py-s3 [&_code]:text-[0.95rem] [&_code]:text-ink [&_code]:[overflow-wrap:anywhere]"><b aria-hidden="true">fx</b><code>{article.syntax}</code></p>
    <h2>Arguments</h2><ul className="m-0 list-none border-t border-solid border-ink p-0 [&_li]:border-b [&_li]:border-solid [&_li]:border-border [&_li]:py-s4 [&_strong]:font-semibold [&_strong]:text-ink [&_code]:text-primary-strong [&_p]:mt-[4px] [&_p]:mb-0 [&_p]:text-muted">{article.args.map((arg) => <li key={arg.name}>
      <strong><code>{arg.name}</code> {arg.required ? "(required)" : "(optional)"}</strong><p><RichText text={arg.text} /></p>
    </li>)}</ul>
    {article.sections.map((section) => <section className="pt-s2 [&_h2]:mt-s7 [&_h2]:mb-s3 [&_h2]:text-ledger-lg" key={section.heading}>
      <h2>{section.heading}</h2><p><RichText text={section.text} /></p><Grid grid={section.grid} />
      {section.formula && <p className="text-muted [&_code]:rounded-[4px] [&_code]:bg-surface-sunk [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:text-ink">Formula: <code>{section.formula}</code> → {String(section.result)}</p>}
    </section>)}
    {related.length > 0 && <section><h2>Related guides</h2><p className="flex flex-wrap gap-s2 [&_a]:rounded-ledger-sm [&_a]:border-2 [&_a]:border-solid [&_a]:border-ink [&_a]:bg-surface [&_a]:px-[12px] [&_a]:py-[6px] [&_a]:font-ledger-code [&_a]:text-ledger-sm [&_a]:font-medium [&_a]:no-underline [&_a:hover]:border-primary">{related.map((item) => <Link key={item.slug} href={`/learn/${item.slug}`}>{item.fn}</Link>)}</p></section>}
  </article><aside className="fixed inset-x-0 bottom-0 z-[var(--z-header)] flex items-center justify-center gap-s4 border-t border-solid border-border bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-s4 pt-s3 pb-[max(var(--s3),env(safe-area-inset-bottom))] backdrop-blur-[10px] [animation:learn-cta-in_var(--d3)_var(--ease)_0.3s_backwards] [&_span]:text-muted [&_b]:font-ledger-code [&_b]:text-ink [@media(max-width:560px)]:[&_span]:hidden [@media(max-width:560px)]:[&_.btn]:w-full"><span>Ready to try <b>{article.fn}</b> yourself?</span><Link className="btn" href={`/lesson/${article.lessonId}`}>Continue to {article.fn} practice <Icon name="arrowRight" size={16} /></Link></aside></main><SiteFooter /></>;
}
