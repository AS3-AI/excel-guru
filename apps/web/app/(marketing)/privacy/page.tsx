import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_SECTIONS } from "@/lib/legal";
import { STATIC_METADATA, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: STATIC_METADATA.privacy.title,
  description: STATIC_METADATA.privacy.description,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="wrap prose">
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
        <Link href="/">← Back to Excel Guru</Link>
      </nav>

      <h1>Privacy Policy</h1>
      <p className="lead">
        Last updated: November 2026. This policy describes how Excel Guru handles your personal data,
        including user authentication and database management (Supabase), payment processing (Razorpay and Stripe),
        AI-generated feedback (Google Gemini), and analytics.
      </p>

      {PRIVACY_SECTIONS.map((section) => (
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
          <Link href="/terms">Terms</Link>
        </nav>
        <p style={{ color: "var(--muted)", margin: 0 }}>© {new Date().getFullYear()} Excel Guru</p>
      </footer>
    </main>
  );
}
