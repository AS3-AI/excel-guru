import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { createClient } from "@/lib/supabase/server";
import { TERMS_SECTIONS } from "@/lib/legal";
import { STATIC_METADATA } from "@/lib/seo";

export const metadata: Metadata = {
  title: STATIC_METADATA.terms.title,
  description: STATIC_METADATA.terms.description,
  openGraph: {
    title: STATIC_METADATA.terms.title,
    description: STATIC_METADATA.terms.description,
  },
};

export default async function TermsPage() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };

  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main className="doc" id="main">
        <p className="eyebrow"><span className="ref">§</span>Legal</p>
        <h1>Terms of Service</h1>
        <p className="lead">
        Last updated: November 2026. Please read these Terms of Service carefully before using Excel Guru.
        These terms govern your access to our interactive spreadsheet lessons, paid subscriptions, and platform services.
      </p>
        {TERMS_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="doc-section">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
