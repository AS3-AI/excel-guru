import type { Metadata } from "next";
import { HELP_SECTIONS } from "@/lib/help";
import { STATIC_METADATA } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "./help.css";

export const metadata: Metadata = {
  title: STATIC_METADATA.help.title,
  description: STATIC_METADATA.help.description,
  openGraph: {
    title: STATIC_METADATA.help.title,
    description: STATIC_METADATA.help.description,
  },
};

export default async function HelpPage() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };

  return (
    <>
      <SiteHeader signedIn={!!user} current="help" />
      <main className="doc help-page" id="main">
        <p className="eyebrow"><span className="ref">?</span>Help</p>
        <h1>Help &amp; FAQ</h1>
        <p className="lead">
          Answers about lessons, the spreadsheet, keyboard shortcuts, subscriptions and your account.
        </p>
        <nav className="help-toc" aria-label="Help topics">
          {HELP_SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`}>{section.category}</a>)}
          <a href="#contact-support">Contact</a>
        </nav>

        {HELP_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="doc-section">
            <h2>{section.category}</h2>
            {section.items.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </section>
        ))}

        <section id="contact-support" className="doc-section">
          <h2>Still need help?</h2>
          <div className="help-contact-card">
            <p>Questions, feedback, or something wrong with your account or billing? Email us at</p>
            <span className="help-contact-email">[CONTACT EMAIL]</span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
