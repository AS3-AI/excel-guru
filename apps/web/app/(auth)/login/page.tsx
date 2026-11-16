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
    <div className="auth-card">
      <h1>Welcome back</h1>
      <p className="lead">Log in to pick up where you left off.</p>
      {error && <p className="auth-alert err" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
      <GoogleButton next={next} />
      <div className="auth-or">or</div>
      <LoginForm next={next} />
      <p className="auth-switch">
        New here? <Link href={signupHref}>Create a free account</Link>
      </p>
    </div>
  );
}
