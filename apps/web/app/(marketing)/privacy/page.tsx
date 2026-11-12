import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — Excel Guru" };

export default function Privacy() {
  return (
    <main className="wrap prose">
      <h1>Privacy</h1>
      <p>
        When you join the waitlist we store your email address, the page section you signed up from,
        your approximate country and the time you signed up. We use it only to tell you when Excel Guru
        launches. We don&apos;t sell or share it. To be removed, reply to any email we send.
      </p>
      <p>We use privacy-friendly page-view analytics with no cookies.</p>
      <p><Link href="/">← Back</Link></p>
    </main>
  );
}
