import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { firstNameFromMetadata, normalizeUsername, safeNext, usernameError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "../AuthForms";

export const metadata: Metadata = {
  title: "Finish your profile",
  description: "Complete your Excel Guru learner profile.",
  robots: { index: false },
};

// Fills the profiles row for an auth user who has none (e.g. first Google sign-in).
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const invite = typeof sp.invite === "string" ? sp.invite : "";

  const supabase = await createClient();
  if (!supabase) redirect("/login?error=unavailable");
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  // RLS lets a learner read their own profile row.
  const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (profile) redirect(next);

  const meta = user.user_metadata ?? {};
  const suggested = typeof meta.username === "string" ? normalizeUsername(meta.username) : "";

  return (
    <div className="w-full max-w-[25rem] [animation:auth-in_var(--d3)_var(--ease)] [&_h1]:mb-s2 [&_h1]:text-[clamp(1.8rem,4vw,2.25rem)] [&_h1]:tracking-[-0.03em] [&_.lead]:mb-s6 [&_.lead]:text-[1rem]">
      <h1>One last step</h1>
      <p className="lead">Pick the name and username other learners will see.</p>
      <OnboardingForm
        next={next}
        firstName={firstNameFromMetadata(meta)}
        username={usernameError(suggested) ? "" : suggested}
        invite={invite}
      />
      <form className="mt-s5 text-center text-ledger-sm text-muted" action="/auth/signout" method="post">
        <span className="hint">Signed in as {user.email}. </span>
        <button className="cursor-pointer border-0 bg-transparent p-0 [font:inherit] text-primary-strong underline underline-offset-[3px]" type="submit">Log out</button>
      </form>
    </div>
  );
}
