"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding, login, signInWithGoogle, signup, type FormState } from "./actions";

const initial: FormState = {};

function Field({
  name, label, state, type = "text", autoComplete, hint, defaultValue,
}: {
  name: string; label: string; state: FormState; type?: string;
  autoComplete?: string; hint?: string; defaultValue?: string;
}) {
  const error = state.errors?.[name];
  const id = `f-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-[6px] [&_label]:text-ledger-sm [&_label]:font-semibold [&_label]:text-ink [&_input]:min-h-[46px] [&_input]:min-w-0 [&_input]:rounded-ledger [&_input]:border-2 [&_input]:border-solid [&_input]:border-ink [&_input]:bg-surface [&_input]:px-[14px] [&_input]:py-[10px] [&_input]:[font:inherit] [&_input]:[font-size:1rem] [&_input]:text-text [&_input]:transition-[border-color,box-shadow] [&_input]:duration-[200ms] [&_input]:ease-ledger [&_input:hover]:bg-surface-warm [&_input:focus]:outline-none [&_input:focus]:shadow-[3px_3px_0_var(--primary)] [&_input[aria-invalid=true]]:border-danger [&_input[aria-invalid=true]]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_12%,transparent)]">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={state.values?.[name] ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required
      />
      {hint && <span id={`${id}-hint`} className="text-[0.82rem] text-muted">{hint}</span>}
      {error && <p id={`${id}-err`} className="m-0 text-[0.875rem] text-danger">{error}</p>}
    </div>
  );
}

function FormAlert({ state }: { state: FormState }) {
  return (
    <div role="status" aria-live="polite">
      {state.message && <p className="m-0 rounded-ledger border-2 border-solid border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface))] px-[12px] py-[10px] text-[0.875rem] text-danger">{state.message}</p>}
      {state.notice && <p className="m-0 rounded-ledger border-2 border-solid border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-primary-tint px-[12px] py-[10px] text-[0.93rem] text-ink">{state.notice}</p>}
    </div>
  );
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-ledger border-2 border-solid border-ink bg-surface px-[18px] py-[11px] [font:inherit] [font-weight:600] text-ink shadow-ledger transition-[background-color,transform,box-shadow] duration-[200ms] ease-ledger hover:bg-butter active:enabled:translate-x-[3px] active:enabled:translate-y-[3px] active:enabled:shadow-none disabled:cursor-default disabled:opacity-60" type="submit" disabled={pending}>
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

export function GoogleButton({ next, invite = "" }: { next: string; invite?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="invite" value={invite} />
      <GoogleSubmit />
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, initial);
  return (
    <form className="grid gap-s4" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" state={state} />
      <FormAlert state={state} />
      <Submit label="Log in" pendingLabel="Logging in…" />
    </form>
  );
}

export function SignupForm({ next, invite }: { next: string; invite: string }) {
  const [state, action] = useActionState(signup, initial);
  if (state.notice) return <FormAlert state={state} />;
  return (
    <form className="grid gap-s4" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <Field name="invite" label="Invite code" autoComplete="off" defaultValue={invite} state={state} />
      <Field name="firstName" label="First name" autoComplete="given-name" state={state} />
      <Field
        name="username"
        label="Username"
        autoComplete="username"
        hint="3–20 characters: lowercase letters, numbers and _"
        state={state}
      />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Field name="confirmEmail" label="Confirm email" type="email" autoComplete="email" state={state} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        state={state}
      />
      <FormAlert state={state} />
      <Submit label="Create free account" pendingLabel="Creating account…" />
    </form>
  );
}

export function OnboardingForm({
  next, firstName, username, invite,
}: { next: string; firstName: string; username: string; invite: string }) {
  const [state, action] = useActionState(completeOnboarding, initial);
  return (
    <form className="grid gap-s4" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <Field name="invite" label="Invite code" autoComplete="off" defaultValue={invite} state={state} />
      <Field name="firstName" label="First name" autoComplete="given-name" defaultValue={firstName} state={state} />
      <Field
        name="username"
        label="Username"
        autoComplete="username"
        hint="Shown on leaderboards. 3–20 characters: lowercase letters, numbers and _"
        defaultValue={username}
        state={state}
      />
      <FormAlert state={state} />
      <Submit label="Continue" pendingLabel="Saving…" />
    </form>
  );
}
