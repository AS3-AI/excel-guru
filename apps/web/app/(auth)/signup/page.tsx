import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { GoogleButton, SignupForm } from "../AuthForms";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Excel Guru account to track your progress and learn Excel with real formulas.",
  openGraph: {
    title: "Sign up",
    description: "Create your free Excel Guru account to track your progress and learn Excel with real formulas.",
  },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const invite = typeof sp.invite === "string" ? sp.invite : "";
  // ?completed=<lessonId> only changes the copy (Product spec §2.2).
  const completed = typeof sp.completed === "string" && sp.completed.length > 0;
  const loginHref = next === safeNext(undefined) ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="w-full max-w-[25rem] [animation:auth-in_var(--d3)_var(--ease)] [&_h1]:mb-s2 [&_h1]:text-[clamp(1.8rem,4vw,2.25rem)] [&_h1]:tracking-[-0.03em] [&_.lead]:mb-s6 [&_.lead]:text-[1rem]">
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
      <p className="hint">
        Excel Guru is invite-only for now. No code? <Link href="/">Join the waitlist</Link>.
      </p>
      <GoogleButton next={next} invite={invite} />
      <div className="my-s5 flex items-center gap-[12px] font-ledger-code text-ledger-xs font-medium tracking-[0.06em] text-muted uppercase before:flex-1 before:border-t before:border-solid before:border-border before:content-[''] after:flex-1 after:border-t after:border-solid after:border-border after:content-['']">or</div>
      <SignupForm next={next} invite={invite} />
      <p className="mt-s5 mb-0 text-center text-[0.93rem] text-muted">
        Already have an account? <Link href={loginHref}>Log in</Link>
      </p>
    </div>
  );
}
