import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms — Excel Guru" };

export default function Terms() {
  return (
    <main className="wrap prose">
      <h1>Terms</h1>
      <p>
        Excel Guru is in pre-launch. Joining the waitlist creates no account and no payment obligation.
        Full terms of service will be published before paid plans open.
      </p>
      <p><Link href="/">← Back</Link></p>
    </main>
  );
}
