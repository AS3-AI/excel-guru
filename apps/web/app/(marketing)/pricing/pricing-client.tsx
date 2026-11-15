"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLANS, formatPrice, type Currency } from "@/lib/plans";

type Plan = "monthly" | "annual";
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open(): void }; } }

export function PricingClient({ currency: initialCurrency, signedIn, premium: initiallyPremium, canCancel: initiallyCanCancel, endsAt: initialEndsAt }: { currency: Currency; signedIn: boolean; premium: boolean; canCancel: boolean; endsAt: string | null }) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [plan, setPlan] = useState<Plan>("annual");
  const [premium, setPremium] = useState(initiallyPremium);
  const [canCancel, setCanCancel] = useState(initiallyCanCancel);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (currency !== "INR") return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, [currency]);
  useEffect(() => {
    if (!message.startsWith("Payment received")) return;
    const timer = window.setInterval(async () => {
      try { const response = await fetch("/api/checkout"); const data = await response.json() as { premium?: boolean }; if (data.premium) { setPremium(true); setMessage(""); } } catch { /* retry on next interval */ }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [message]);

  async function upgrade() {
    if (!signedIn) { window.location.href = "/signup?next=/pricing"; return; }
    if (currency !== "INR") return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, currency }) });
      const result = await response.json() as { payload?: { key_id?: string; subscription_id?: string; prefill?: { email?: string } }; error?: string };
      if (!response.ok || !result.payload || !window.Razorpay) throw new Error(result.error ?? "Checkout is still loading. Please try again.");
      const checkout = new window.Razorpay({ key: result.payload.key_id, subscription_id: result.payload.subscription_id, prefill: result.payload.prefill, name: "Excel Guru", description: `${plan} premium access`, handler: () => setMessage("Payment received — activating premium…") });
      checkout.open();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout unavailable. Please try again."); }
    finally { setBusy(false); }
  }
  async function manage() {
    setBusy(true);
    try { const response = await fetch("/api/billing/manage", { method: "POST" }); const result = await response.json() as { ok?: boolean; endsAt?: string | null }; if (response.ok && result.ok) { setEndsAt(result.endsAt ?? endsAt); setCanCancel(false); setMessage(""); } else setMessage("Could not manage your subscription right now."); }
    catch { setMessage("Could not manage your subscription right now."); }
    finally { setBusy(false); }
  }
  return <main className="pricing-page">
    <section className="pricing-intro"><p className="pricing-eyebrow">Excel Guru Premium</p><h1>Learn Excel without limits</h1><p>Build practical spreadsheet skills with a clear path from your first formula to advanced projects.</p>
      <ul><li>Unlock every lesson and guided practice</li><li>Learn with projects that mirror real work</li><li>Earn a certificate when you complete the curriculum</li></ul>
    </section>
    <section className="pricing-card" aria-labelledby="pricing-title">
      <div className="pricing-card-heading"><div><p className="pricing-eyebrow">One plan, full access</p><h2 id="pricing-title">Choose your plan</h2></div><div className="currency-toggle" aria-label="Currency"><button type="button" aria-pressed={currency === "INR"} onClick={() => setCurrency("INR")}>INR</button><button type="button" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>USD</button></div></div>
      <label className={`plan-option ${plan === "annual" ? "selected" : ""}`}><input type="radio" name="plan" value="annual" checked={plan === "annual"} onChange={() => setPlan("annual")} /><span className="plan-info"><strong>Annual <span className="popular-badge">Most popular</span></strong><small>Best value for committed learners</small></span><strong className="plan-price">{formatPrice(currency, PLANS[currency].annual)}<small>/ year</small></strong></label>
      <label className={`plan-option ${plan === "monthly" ? "selected" : ""}`}><input type="radio" name="plan" value="monthly" checked={plan === "monthly"} onChange={() => setPlan("monthly")} /><span className="plan-info"><strong>Monthly</strong><small>Flexible month to month</small></span><strong className="plan-price">{formatPrice(currency, PLANS[currency].monthly)}<small>/ month</small></strong></label>
      {premium ? <div className="premium-state"><p>You're premium</p>{canCancel ? <button className="pricing-button secondary" type="button" onClick={() => void manage()} disabled={busy}>Manage / cancel subscription</button> : endsAt ? <p>Your plan ends on {new Date(endsAt).toLocaleDateString()}</p> : null}</div> : currency === "USD" ? <p className="region-message" role="status">Coming soon in your region. Switch to INR to pay with Razorpay.</p> : <button className="pricing-button" type="button" onClick={() => void upgrade()} disabled={busy}>{busy ? "Please wait…" : "Upgrade"}</button>}
      <p className="refund-copy">Cancel any time · full refund if unhappy</p>{!signedIn && currency === "INR" && !premium && <p className="signin-copy">You'll create an account before checkout.</p>}{message && <p className="pricing-status" role="status">{message}</p>}
    </section>
    <p className="pricing-back"><Link href="/dashboard">← Back to dashboard</Link></p>
  </main>;
}
