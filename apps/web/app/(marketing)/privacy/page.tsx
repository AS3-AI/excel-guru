import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PRIVACY_SECTIONS } from "@/lib/legal";
import { STATIC_METADATA } from "@/lib/seo";

export const metadata: Metadata = {
  title: STATIC_METADATA.privacy.title,
  description: STATIC_METADATA.privacy.description,
  openGraph: {
    title: STATIC_METADATA.privacy.title,
    description: STATIC_METADATA.privacy.description,
  },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc" id="main">
        <p className="eyebrow">
          <span className="ref">§</span>Legal
        </p>
        <h1>Privacy Policy</h1>
        <p className="lead">
          Last updated: November 2026. This policy describes how Excel Guru handles your personal
          data, including user authentication and learning progress (Supabase), Google sign-in,
          payment processing (Razorpay), AI explanations (Google Gemini), Vercel hosting logs, and
          session cookies.
        </p>
        {PRIVACY_SECTIONS.map((section) => (
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
