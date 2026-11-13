import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { GoogleButton, SignupForm } from "../AuthForms";

export const metadata: Metadata = { title: "Sign up — Excel Guru", robots: { index: false } };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  // ?completed=<lessonId> only changes the copy (Product spec §2.2).
  const completed = typeof sp.completed === "string" && sp.completed.length > 0;
  const loginHref = next === safeNext(undefined) ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="auth-card">
      {completed ? (
        <>
          <h1>Nice work — lesson complete!</h1>
          <p className="lead">Create a free profile to save your progress and unlock more lessons.</p>
        </>
      ) : (
        <>
          <h1>Create your free account</h1>
          <p className="lead">Save your progress, keep your streak and appear on the leaderboard.</p>
        </>
      )}
      <GoogleButton next={next} />
      <div className="auth-or">or</div>
      <SignupForm next={next} />
      <p className="auth-switch">
        Already have an account? <Link href={loginHref}>Log in</Link>
      </p>
    </div>
  );
}
