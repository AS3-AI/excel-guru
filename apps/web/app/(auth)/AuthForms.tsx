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
    <div className="auth-field">
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
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {error && <p id={`${id}-err`} className="err">{error}</p>}
    </div>
  );
}

function FormAlert({ state }: { state: FormState }) {
  return (
    <div role="status" aria-live="polite">
      {state.message && <p className="auth-alert err">{state.message}</p>}
      {state.notice && <p className="auth-alert ok">{state.notice}</p>}
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
    <button className="btn-google" type="submit" disabled={pending}>
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
    <form className="auth-form" action={action} noValidate>
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
    <form className="auth-form" action={action} noValidate>
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
    <form className="auth-form" action={action} noValidate>
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
