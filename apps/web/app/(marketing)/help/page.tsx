import type { Metadata } from "next";
import Link from "next/link";
import { HELP_SECTIONS } from "@/lib/help";
import { STATIC_METADATA } from "@/lib/seo";
import "./help.css";

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
    <main className="wrap prose help-page">
      <nav className="help-nav" aria-label="Breadcrumb">
        <Link href="/">← Back to Excel Guru</Link>
      </nav>

      <h1>Help &amp; FAQ</h1>
      <p className="lead">
        Find answers to frequently asked questions about interactive lessons, spreadsheet mechanics,
        keyboard shortcuts, subscriptions, and accounts.
      </p>

      {HELP_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="help-section">
          <h2>{section.category}</h2>
          {section.items.map((item) => (
            <details key={item.q} className="help-item">
              <summary className="help-summary">{item.q}</summary>
              <p className="help-answer">{item.a}</p>
            </details>
          ))}
        </section>
      ))}

      <section id="contact-support" className="help-section">
        <h2>Still need help?</h2>
        <div className="help-contact-card">
          <h3>Contact our team</h3>
          <p>
            Have a question, feedback, or need help with your account or billing? Email us at:
          </p>
          <span className="help-contact-email">[CONTACT EMAIL]</span>
        </div>
      </section>

      <footer className="help-footer">
        <nav className="help-footer-nav" aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p className="help-copyright">© {new Date().getFullYear()} Excel Guru</p>
      </footer>
    </main>
  );
}
