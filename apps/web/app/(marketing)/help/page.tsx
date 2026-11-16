import type { Metadata } from "next";
import Link from "next/link";
import { HELP_SECTIONS } from "@/lib/help";
import { STATIC_METADATA, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: STATIC_METADATA.help.title,
  description: STATIC_METADATA.help.description,
  path: "/help",
});

export default function HelpPage() {
  return (
    <main className="wrap prose">
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <Link href="/">← Back to Excel Guru</Link>
      </nav>

      <h1>Help &amp; FAQ</h1>
      <p className="lead">
        Find answers to frequently asked questions about interactive lessons, spreadsheet mechanics,
        keyboard shortcuts, subscriptions, and accounts.
      </p>

      {HELP_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} style={{ padding: "32px 0", borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: 16 }}>{section.category}</h2>
          {section.items.map((item) => (
            <details key={item.q} style={{ marginBottom: 12 }}>
              <summary style={{ padding: "8px 0" }}>{item.q}</summary>
              <p style={{ marginTop: 8 }}>{item.a}</p>
            </details>
          ))}
        </section>
      ))}

      <section id="contact-support" style={{ padding: "32px 0", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: 16 }}>Still need help?</h2>
        <p>
          Can&apos;t find what you&apos;re looking for? Use the Help page to contact us. We&apos;re happy to assist you with
          any questions or technical feedback.
        </p>
      </section>

      <footer style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 24, fontSize: "0.95rem" }}>
        <nav aria-label="Footer navigation" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p style={{ color: "var(--muted)", margin: 0 }}>© {new Date().getFullYear()} Excel Guru</p>
      </footer>
    </main>
  );
}
