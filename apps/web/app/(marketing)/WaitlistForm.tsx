"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

type State = { kind: "idle" | "sending" | "done" | "error"; message: string };

export function WaitlistForm({ source }: { source: string }) {
  const [state, setState] = useState<State>({ kind: "idle", message: "" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setState({ kind: "sending", message: "" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Something went wrong. Try again." });
        return;
      }
      track("waitlist_submit", { source });
      setState({ kind: "done", message: data.message ?? "You're on the list!" });
    } catch {
      setState({ kind: "error", message: "Network error. Try again." });
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      <label htmlFor={`email-${source}`} className="sr-only" style={{ position: "absolute", left: -9999 }}>
        Email address
      </label>
      <input
        id={`email-${source}`}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        disabled={state.kind === "done"}
      />
      <button className="btn" type="submit" disabled={state.kind === "sending" || state.kind === "done"}>
        {state.kind === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      <p className={`msg${state.kind === "error" ? " err" : ""}`} role="status" aria-live="polite" style={{ flexBasis: "100%" }}>
        {state.message}
      </p>
    </form>
  );
}
