"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLANS, formatPrice, type Currency } from "@/lib/plans";

const planOptionClasses = [
  "flex items-center gap-s3 p-s4 [border:var(--line)] rounded-ledger mt-s3 cursor-pointer",
  "[transition:border-color_var(--d2)_var(--ease),_background-color_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]",
  "[&:hover]:border-border-strong",
  "[&.selected]:bg-mint [&.selected]:[box-shadow:3px_3px_0_var(--ink)] [&.selected]:[transform:translate(-2px,_-2px)]",
  "[&:has(input:focus-visible)]:[outline:2px_solid_var(--primary)] [&:has(input:focus-visible)]:[outline-offset:2px]",
  "[&_input]:[accent-color:var(--primary)] [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:[flex:none] [&_input]:m-0",
].join(" ");

const pricingButtonClasses = [
  "[--btn-bg:var(--primary)] flex items-center justify-center w-full min-h-[52px] mt-s5 [border:var(--line)]",
  "rounded-ledger [box-shadow:3px_3px_0_var(--ink)] [background:var(--btn-bg)] text-primary-ink",
  "[font:650_1rem_var(--font)] p-[12px_18px] cursor-pointer",
  "[transition:transform_var(--d1)_var(--ease),_box-shadow_var(--d1)_var(--ease),_background-color_var(--d2)]",
  "[&:hover:not(:disabled)]:[--btn-bg:var(--primary-strong)]",
  "[&:active:not(:disabled)]:[transform:translate(3px,_3px)] [&:active:not(:disabled)]:[box-shadow:none]",
  "[&:disabled]:opacity-[0.6] [&:disabled]:cursor-wait",
  "[&.secondary]:[--btn-bg:var(--surface)] [&.secondary]:text-ink",
  "[&.secondary:hover:not(:disabled)]:[--btn-bg:var(--surface-sunk)]",
].join(" ");

type Plan = "monthly" | "annual";
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

export function PricingClient({
  currency: initialCurrency,
  paymentsEnabled,
  signedIn,
  premium: initiallyPremium,
  canCancel: initiallyCanCancel,
  endsAt: initialEndsAt,
  invited = false,
}: {
  currency: Currency;
  paymentsEnabled: boolean;
  signedIn: boolean;
  premium: boolean;
  canCancel: boolean;
  endsAt: string | null;
  invited?: boolean;
}) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [plan, setPlan] = useState<Plan>("annual");
  const [premium, setPremium] = useState(initiallyPremium);
  const [canCancel, setCanCancel] = useState(initiallyCanCancel);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!paymentsEnabled || currency !== "INR") return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [currency, paymentsEnabled]);
  useEffect(() => {
    if (!message.startsWith("Payment received")) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/checkout");
        const data = (await response.json()) as { premium?: boolean };
        if (data.premium) {
          setPremium(true);
          setMessage("");
        }
      } catch {
        /* retry on next interval */
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [message]);

  async function upgrade() {
    if (!signedIn) {
      window.location.href = "/signup?next=/pricing";
      return;
    }
    if (currency !== "INR") return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, currency }),
      });
      const result = (await response.json()) as {
        payload?: { key_id?: string; subscription_id?: string; prefill?: { email?: string } };
        error?: string;
      };
      if (!response.ok || !result.payload || !window.Razorpay)
        throw new Error(result.error ?? "Checkout is still loading. Please try again.");
      const checkout = new window.Razorpay({
        key: result.payload.key_id,
        subscription_id: result.payload.subscription_id,
        prefill: result.payload.prefill,
        name: "Excel Guru",
        description: `${plan} premium access`,
        handler: () => setMessage("Payment received — activating premium…"),
      });
      checkout.open();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Checkout unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function manage() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/manage", { method: "POST" });
      const result = (await response.json()) as { ok?: boolean; endsAt?: string | null };
      if (response.ok && result.ok) {
        setEndsAt(result.endsAt ?? endsAt);
        setCanCancel(false);
        setMessage("");
      } else setMessage("Could not manage your subscription right now.");
    } catch {
      setMessage("Could not manage your subscription right now.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="pricing-page w-full max-w-[1160px] m-[0_auto] p-[var(--s8)_var(--s5)_var(--s9)] text-text grid
          grid-cols-[minmax(0,_1fr)_minmax(340px,_460px)] gap-s8 [align-items:start]
          [@media(max-width:860px)]:flex [@media(max-width:860px)]:flex-col [@media(max-width:860px)]:gap-s6
          [@media(max-width:860px)]:p-[var(--s6)_var(--s4)_var(--s8)]"
      id="main"
    >
      <section
        className="pricing-intro [&_h1]:text-[clamp(2.4rem,_5.4vw,_4rem)] [&_h1]:leading-[1] [&_h1]:tracking-[-0.035em] [&_h1]:m-[0_0_var(--s5)]
          [&>p:not(.eyebrow)]:text-ledger-md [&>p:not(.eyebrow)]:leading-[1.6] [&>p:not(.eyebrow)]:max-w-[32rem]
          [&>p:not(.eyebrow)]:text-muted [&>p:not(.eyebrow)]:m-0
          [&_ul]:list-none [&_ul]:m-[var(--s6)_0_0] [&_ul]:p-0 [&_ul]:[border-top:1px_solid_var(--ink)] [&_ul]:max-w-[32rem]
          [&_li]:flex [&_li]:items-center [&_li]:gap-s3 [&_li]:p-[var(--s4)_0] [&_li]:[border-bottom:1px_solid_var(--border)]
          [&_li]:text-ink
          [&_li::before]:[content:''] [&_li::before]:[flex:none] [&_li::before]:w-[22px] [&_li::before]:h-[22px]
          [&_li::before]:[border:2px_solid_var(--ink)] [&_li::before]:rounded-ledger-sm
          [&_li::before]:[background:var(--primary)_url(/pricing-check.svg)_center_/_12px_no-repeat]"
      >
        <p className="eyebrow">
          <span className="ref">D1</span>Excel Guru Premium
        </p>
        <h1>Learn Excel without limits</h1>
        <p>
          Build practical spreadsheet skills with a clear path from your first formula to advanced
          projects.
        </p>
        <ul>
          <li>Unlock every lesson and guided practice</li>
          <li>Learn with projects that mirror real work</li>
          <li>Earn a certificate when you complete the curriculum</li>
        </ul>
      </section>
      <section
        className="pricing-card sticky top-[84px] bg-surface [border:var(--line)] rounded-ledger-lg p-s6 [box-shadow:var(--shadow-2)]
          [&_h2]:text-ink [&_h2]:text-ledger-lg [&_h2]:m-[var(--s2)_0_0]
          [@media(max-width:860px)]:static [@media(max-width:860px)]:w-full [@media(max-width:860px)]:p-[var(--s5)_var(--s4)]"
        aria-labelledby="pricing-title"
      >
        <div className="pricing-card-heading flex items-start justify-between gap-s3 mb-s5">
          <div>
            <p className="pricing-eyebrow text-muted [font:500_var(--fs-xs)/1_var(--mono)] uppercase tracking-[0.06em] m-0">
              One plan, full access
            </p>
            <h2 id="pricing-title">Choose your plan</h2>
          </div>
          <div
            className="currency-toggle flex p-[3px] [border:var(--line)] rounded-ledger bg-surface-sunk
          [&_button]:min-h-[32px] [&_button]:[border:0] [&_button]:rounded-[7px] [&_button]:p-[4px_12px] [&_button]:text-muted
          [&_button]:[background:transparent] [&_button]:[font:600_var(--fs-xs)_var(--mono)] [&_button]:cursor-pointer
          [&_button]:[transition:background-color_var(--d2)_var(--ease),_color_var(--d2)_var(--ease),_box-shadow_var(--d2)]
          [&_button[aria-pressed='true']]:text-ink [&_button[aria-pressed='true']]:[background:var(--surface)]
          [&_button[aria-pressed='true']]:[box-shadow:var(--shadow-1)]"
            aria-label="Currency"
          >
            <button
              type="button"
              aria-pressed={currency === "INR"}
              onClick={() => setCurrency("INR")}
            >
              INR
            </button>
            <button
              type="button"
              aria-pressed={currency === "USD"}
              onClick={() => setCurrency("USD")}
            >
              USD
            </button>
          </div>
        </div>
        <label
          className={`plan-option ${plan === "annual" ? "selected" : ""} ${planOptionClasses}`}
        >
          <input
            type="radio"
            name="plan"
            value="annual"
            checked={plan === "annual"}
            onChange={() => setPlan("annual")}
            disabled={invited}
          />
          <span
            className="plan-info grid gap-[3px] [flex:1] min-w-0
          [&>strong]:flex [&>strong]:flex-wrap [&>strong]:items-center [&>strong]:gap-s2 [&>strong]:text-ink
          [&_small]:text-muted [&_small]:font-normal [&_small]:text-ledger-sm"
          >
            <strong>
              Annual{" "}
              <span
                className="popular-badge p-[3px_7px] rounded-[4px] bg-highlight text-ink [font:600_0.66rem/1.2_var(--mono)] tracking-[0.04em] uppercase
          whitespace-nowrap"
              >
                Most popular
              </span>
            </strong>
            <small>Best value for committed learners</small>
          </span>
          <strong
            className="plan-price [&_small]:text-muted [&_small]:font-normal [&_small]:text-[0.75rem] [&_small]:block
          [&_small]:[font-family:var(--font)] [&_small]:tracking-[0] [&_small]:mt-[3px]
          text-ink text-right whitespace-nowrap [font:600_1.3rem/1.1_var(--mono)] tracking-[-0.03em] tabular-nums"
          >
            {formatPrice(currency, PLANS[currency].annual)}
            <small>/ year</small>
          </strong>
        </label>
        <label
          className={`plan-option ${plan === "monthly" ? "selected" : ""} ${planOptionClasses}`}
        >
          <input
            type="radio"
            name="plan"
            value="monthly"
            checked={plan === "monthly"}
            onChange={() => setPlan("monthly")}
            disabled={invited}
          />
          <span
            className="plan-info grid gap-[3px] [flex:1] min-w-0
          [&>strong]:flex [&>strong]:flex-wrap [&>strong]:items-center [&>strong]:gap-s2 [&>strong]:text-ink
          [&_small]:text-muted [&_small]:font-normal [&_small]:text-ledger-sm"
          >
            <strong>Monthly</strong>
            <small>Flexible month to month</small>
          </span>
          <strong
            className="plan-price [&_small]:text-muted [&_small]:font-normal [&_small]:text-[0.75rem] [&_small]:block
          [&_small]:[font-family:var(--font)] [&_small]:tracking-[0] [&_small]:mt-[3px]
          text-ink text-right whitespace-nowrap [font:600_1.3rem/1.1_var(--mono)] tracking-[-0.03em] tabular-nums"
          >
            {formatPrice(currency, PLANS[currency].monthly)}
            <small>/ month</small>
          </strong>
        </label>
        {invited ? (
          <div
            className="premium-state text-center leading-[1.5] mt-s5
          [&_p]:font-semibold [&_p]:text-primary-strong"
          >
            <p>Included with your invite</p>
            <p>You joined with an invite code, so every lesson is unlocked. No payment needed.</p>
          </div>
        ) : premium ? (
          <div
            className="premium-state text-center leading-[1.5] mt-s5
          [&_p]:font-semibold [&_p]:text-primary-strong"
          >
            <p>You're premium</p>
            {canCancel && paymentsEnabled ? (
              <button
                className={`pricing-button secondary ${pricingButtonClasses}`}
                type="button"
                onClick={() => void manage()}
                disabled={busy}
              >
                Manage / cancel subscription
              </button>
            ) : endsAt ? (
              <p>Your plan ends on {new Date(endsAt).toLocaleDateString()}</p>
            ) : null}
          </div>
        ) : !paymentsEnabled ? (
          <p
            className="region-message text-center leading-[1.5] m-[var(--s5)_0_0] p-[var(--s3)_var(--s4)]
          [border:1px_solid_color-mix(in_srgb,_var(--warning)_35%,_var(--border))] rounded-ledger
          [background:color-mix(in_srgb,_var(--warning)_8%,_var(--surface))] text-ink"
            role="status"
          >
            Upgrade coming soon
          </p>
        ) : currency === "USD" ? (
          <p
            className="region-message text-center leading-[1.5] m-[var(--s5)_0_0] p-[var(--s3)_var(--s4)]
          [border:1px_solid_color-mix(in_srgb,_var(--warning)_35%,_var(--border))] rounded-ledger
          [background:color-mix(in_srgb,_var(--warning)_8%,_var(--surface))] text-ink"
            role="status"
          >
            Coming soon in your region. Switch to INR to pay with Razorpay.
          </p>
        ) : (
          <button
            className={`pricing-button ${pricingButtonClasses}`}
            type="button"
            onClick={() => void upgrade()}
            disabled={busy}
          >
            {busy ? "Please wait…" : "Upgrade"}
          </button>
        )}
        <p className="refund-copy text-muted text-ledger-sm text-center m-[var(--s3)_0_0]">
          Cancel any time · full refund if unhappy
        </p>
        {!signedIn && currency === "INR" && !premium && (
          <p className="signin-copy text-muted text-ledger-sm text-center m-[var(--s3)_0_0]">
            You'll create an account before checkout.
          </p>
        )}
        {message && (
          <p
            className="pricing-status text-center leading-[1.5] text-ink text-ledger-sm"
            role="status"
          >
            {message}
          </p>
        )}
      </section>
      <p
        className="pricing-back [grid-column:1_/_-1] m-0 text-ledger-sm
          [&_a]:text-muted
          [@media(max-width:860px)]:[order:3]"
      >
        <Link href="/profile">Back to profile</Link>
      </p>
    </main>
  );
}
