import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrder } from "@/lib/lessons";
import { escapeIlikePrefix } from "@/lib/verify";

export const metadata: Metadata = {
  title: "Verify Certificate — Excel Guru",
  description:
    "Verify an authentic Excel Guru Formula Mastery certificate by credential ID or recipient name.",
};

type CertRow = {
  credential_id: string;
  name: string;
  issued_at: string;
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string }>;
}) {
  const { id, q } = await searchParams;
  const queryId = typeof id === "string" ? id.trim() : "";
  const queryName = typeof q === "string" ? q.trim() : "";

  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };

  let matches: CertRow[] = [];
  let searched = false;

  if (queryId || queryName) {
    searched = true;
    const admin = createAdminClient();
    if (admin) {
      if (queryId) {
        const { data } = await admin
          .from("certificates")
          .select("credential_id,name,issued_at")
          .eq("credential_id", queryId.toUpperCase())
          .limit(5);
        matches = data ?? [];
      } else if (queryName) {
        const safeName = escapeIlikePrefix(queryName);
        if (safeName) {
          const { data } = await admin
            .from("certificates")
            .select("credential_id,name,issued_at")
            .ilike("name_lower", `${safeName}%`)
            .limit(10);
          matches = data ?? [];
        }
      }
    }
  }

  const totalLessons = getOrder().length;

  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main className="doc" id="main">
        <p className="eyebrow">
          <span className="ref">V1</span>Credential Verification
        </p>
        <h1 style={{ marginBottom: "var(--s3)" }}>Verify a Certificate</h1>
        <p style={{ color: "var(--muted)", marginBottom: "var(--s5)" }}>
          Confirm an Excel Guru graduate&apos;s credential ID or search by name. Every verified
          learner has completed all {totalLessons} interactive spreadsheet lessons.
        </p>

        <form
          method="get"
          action="/verify"
          style={{
            display: "grid",
            gap: "var(--s3)",
            padding: "var(--s5)",
            background: "var(--surface)",
            border: "var(--line)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-1)",
            marginBottom: "var(--s6)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--s3)",
            }}
          >
            <label style={{ display: "grid", gap: 6, fontSize: "var(--fs-sm)", fontWeight: 700 }}>
              Credential ID
              <input
                type="text"
                name="id"
                defaultValue={queryId}
                placeholder="e.g. EG-2026-ABCD1234"
                style={{
                  padding: "10px 12px",
                  border: "var(--line)",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--mono)",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: "var(--fs-sm)", fontWeight: 700 }}>
              Or Recipient Name
              <input
                type="text"
                name="q"
                defaultValue={queryName}
                placeholder="e.g. Ashish"
                style={{
                  padding: "10px 12px",
                  border: "var(--line)",
                  borderRadius: "var(--r)",
                }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "var(--s3)", alignItems: "center" }}>
            <button type="submit" className="btn">
              Verify Credential
            </button>
            {searched && (
              <Link href="/verify" className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>
        </form>

        {searched && matches.length === 0 && (
          <section
            style={{
              padding: "var(--s5)",
              background: "var(--rose)",
              border: "var(--line)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-1)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "var(--fs-md)" }}>
              No matching certificate found
            </h2>
            <p style={{ margin: 0, color: "var(--ink)", fontSize: "var(--fs-sm)" }}>
              Double-check the credential ID (for example, <code>EG-2026-...</code>) or recipient
              name spelling.
            </p>
          </section>
        )}

        {matches.length > 0 && (
          <div style={{ display: "grid", gap: "var(--s4)" }}>
            {matches.map((cert) => (
              <section
                key={cert.credential_id}
                style={{
                  padding: "var(--s5)",
                  background: "var(--mint)",
                  border: "var(--line)",
                  borderRadius: "var(--r-lg)",
                  boxShadow: "var(--shadow-2)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--s4)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      background: "var(--primary)",
                      color: "var(--primary-ink)",
                      border: "1.5px solid var(--ink)",
                      borderRadius: "9999px",
                      fontFamily: "var(--mono)",
                      fontSize: "var(--fs-xs)",
                      fontWeight: 700,
                      marginBottom: "var(--s2)",
                    }}
                  >
                    <Icon name="check" size={13} /> VERIFIED CREDENTIAL
                  </div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-lg)" }}>{cert.name}</h2>
                  <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text)" }}>
                    Completed all {totalLessons} interactive Excel Guru lessons · Issued{" "}
                    {new Date(cert.issued_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div
                  style={{
                    padding: "8px 14px",
                    background: "var(--surface)",
                    border: "var(--line)",
                    borderRadius: "var(--r)",
                    fontFamily: "var(--mono)",
                    fontWeight: 700,
                    fontSize: "var(--fs-sm)",
                  }}
                >
                  {cert.credential_id}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
