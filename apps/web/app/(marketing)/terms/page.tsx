import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_SECTIONS } from "@/lib/legal";
import { STATIC_METADATA, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: STATIC_METADATA.terms.title,
  description: STATIC_METADATA.terms.description,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="wrap prose">
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <Link href="/">← Back to Excel Guru</Link>
      </nav>

      <h1>Terms of Service</h1>
      <p className="lead">
        Last updated: November 2026. Please read these Terms of Service carefully before using Excel Guru.
        These terms govern your access to our interactive spreadsheet lessons, paid subscriptions, and platform services.
      </p>

      {TERMS_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} style={{ padding: "24px 0", borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>{section.title}</h2>
          <p style={{ lineHeight: 1.7 }}>{section.body}</p>
        </section>
      ))}

      <footer style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 24, fontSize: "0.95rem" }}>
        <nav aria-label="Footer navigation" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <p style={{ color: "var(--muted)", margin: 0 }}>© {new Date().getFullYear()} Excel Guru</p>
      </footer>
    </main>
  );
}
