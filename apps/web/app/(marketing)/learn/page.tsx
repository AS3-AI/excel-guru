import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/learn";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Excel Function Guides",
  description: "Clear guides to Excel functions, with examples and hands-on practice.",
  openGraph: {
    title: "Excel Function Guides",
    description: "Clear guides to Excel functions, with examples and hands-on practice.",
  },
};

export default async function LearnIndex() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const articles = getArticles();
  return <><SiteHeader signedIn={!!user} current="learn" /><main className="doc !pb-[96px]" id="main">
    <p className="eyebrow"><span className="ref">fx</span>Function guides</p>
    <h1>Excel function guides</h1>
    <p className="lead">Understand useful Excel functions with worked examples, then practise them in an interactive lesson.</p>
    <ul className="m-0 list-none border-t border-solid border-ink p-0">{articles.map((article) => <li className="border-b border-solid border-border" key={article.slug}>
      <Link className="group grid grid-cols-[140px_minmax(0,1fr)_18px] items-center gap-s4 px-s2 py-s4 text-text no-underline transition-colors duration-[120ms] ease-ledger hover:bg-surface [@media(max-width:560px)]:grid-cols-[minmax(0,1fr)_18px] [&_svg]:text-faint [&_svg]:transition-[transform,color] [&_svg]:duration-[200ms] [&_svg]:ease-ledger [&:hover_svg]:translate-x-[3px] [&:hover_svg]:text-primary" href={`/learn/${article.slug}`}><span className="font-ledger-code text-[1rem] font-semibold text-primary-strong">{article.fn}</span><span className="text-[0.95rem] text-muted [@media(max-width:560px)]:col-start-1">{article.description}</span><Icon name="arrowRight" size={16} /></Link>
    </li>)}</ul>
  </main><SiteFooter /></>;
}
