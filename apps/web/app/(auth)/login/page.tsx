import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { GoogleButton, LoginForm } from "../AuthForms";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Excel Guru account to continue your interactive spreadsheet lessons.",
  openGraph: {
    title: "Log in",
    description: "Log in to your Excel Guru account to continue your interactive spreadsheet lessons.",
  },
};

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Log in or request a new link.",
  oauth: "Google sign-in didn't complete. Please try again.",
  unavailable: "Sign-in is temporarily unavailable. Please try again later.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const signupHref = next === safeNext(undefined) ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <div className="w-full max-w-[25rem] [animation:auth-in_var(--d3)_var(--ease)] [&_h1]:mb-s2 [&_h1]:text-[clamp(1.8rem,4vw,2.25rem)] [&_h1]:tracking-[-0.03em] [&_.lead]:mb-s6 [&_.lead]:text-[1rem]">
      <h1>Welcome back</h1>
      <p className="lead">Log in to pick up where you left off.</p>
      {error && <p className="m-0 rounded-ledger border-2 border-solid border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface))] px-[12px] py-[10px] text-[0.875rem] text-danger mb-s4" role="alert">{error}</p>}
      <GoogleButton next={next} />
      <div className="my-s5 flex items-center gap-[12px] font-ledger-code text-ledger-xs font-medium tracking-[0.06em] text-muted uppercase before:flex-1 before:border-t before:border-solid before:border-border before:content-[''] after:flex-1 after:border-t after:border-solid after:border-border after:content-['']">or</div>
      <LoginForm next={next} />
      <p className="mt-s5 mb-0 text-center text-[0.93rem] text-muted">
        New here? <Link href={signupHref}>Create a free account</Link>
      </p>
    </div>
  );
}
