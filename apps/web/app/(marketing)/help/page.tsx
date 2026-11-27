import type { Metadata } from "next";
import { HELP_SECTIONS } from "@/lib/help";
import { STATIC_METADATA } from "@/lib/seo";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: STATIC_METADATA.help.title,
  description: STATIC_METADATA.help.description,
  openGraph: {
    title: STATIC_METADATA.help.title,
    description: STATIC_METADATA.help.description,
  },
};

export default function HelpPage() {
  return (
    <>
      <SiteHeader current="help" />
      <main className="doc help-page" id="main">
        <p className="eyebrow">
          <span className="ref">?</span>Help
        </p>
        <h1>Help &amp; FAQ</h1>
        <p className="lead">
          Answers about lessons, the spreadsheet, keyboard shortcuts, subscriptions and your
          account.
        </p>
        <nav className="mb-s6 flex flex-wrap gap-s2" aria-label="Help topics">
          {HELP_SECTIONS.map((section) => (
            <a
              className="rounded-ledger-sm border-2 border-solid border-ink bg-surface px-[12px] py-[6px] text-ledger-sm text-text no-underline transition-[border-color,color] duration-200 hover:border-primary hover:text-primary-strong"
              key={section.id}
              href={`#${section.id}`}
            >
              {section.category}
            </a>
          ))}
          <a
            className="rounded-ledger-sm border-2 border-solid border-ink bg-surface px-[12px] py-[6px] text-ledger-sm text-text no-underline transition-[border-color,color] duration-200 hover:border-primary hover:text-primary-strong"
            href="#contact-support"
          >
            Contact
          </a>
        </nav>

        {HELP_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="doc-section">
            <h2 className="!mb-s2">{section.category}</h2>
            {section.items.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </section>
        ))}

        <section id="contact-support" className="doc-section">
          <h2 className="!mb-s2">Still need help?</h2>
          <div className="mt-s3 rounded-ledger-lg border-2 border-solid border-ink bg-surface p-s5">
            <p className="!m-0 !text-muted">
              Questions, feedback, or something wrong with your account or billing? Email us at
            </p>
            <span className="mt-s2 inline-block font-ledger-code text-[1rem] font-semibold text-primary-strong">
              [CONTACT EMAIL]
            </span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
