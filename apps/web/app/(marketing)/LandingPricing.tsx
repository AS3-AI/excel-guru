"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { currencyForCountry, formatPrice, PLANS, type Currency } from "@/lib/plans";

const planClasses = [
  "flex flex-col gap-s2 p-s6 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-2)]",
  "[transition:transform_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]",
  "[&:hover]:[transform:translate(-3px,_-3px)] [&:hover]:[box-shadow:8px_8px_0_var(--ink)]",
  "[&_h3]:flex [&_h3]:items-center [&_h3]:gap-s2 [&_h3]:text-ledger-md [&_h3]:m-0",
  "[&_p]:m-[0_0_var(--s5)] [&_p]:text-text [&_p]:[flex:1]",
  "[&_.price]:[font:700_2.5rem/1.1_var(--mono)] [&_.price]:tracking-[-0.04em] [&_.price]:text-ink",
  "[&_.price]:m-[var(--s2)_0_var(--s1)]",
  "[&_.price_small]:[font:400_var(--fs-sm)_var(--font)] [&_.price_small]:tracking-[0] [&_.price_small]:text-muted",
  "[&_.price_small]:ml-[6px]",
  "[&.plan-best]:bg-mint",
].join(" ");

export function LandingPricing() {
  const [currency, setCurrency] = useState<Currency>(() => currencyForCountry(null));

  useEffect(() => {
    let active = true;
    void fetch("/api/pricing?scope=region")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { currency?: Currency } | null) => {
        if (!active || !data?.currency) return;
        if (data.currency === "INR" || data.currency === "USD") {
          setCurrency(data.currency);
        }
      })
      .catch(() => {
        /* keep default currency */
      });
    return () => {
      active = false;
    };
  }, []);

  const plan = PLANS[currency];
  const annualSaving = Math.round((1 - plan.annual / (plan.monthly * 12)) * 100);

  return (
    <div
      className="plans grid gap-s5 grid-cols-[repeat(3,_minmax(0,_1fr))]
          [&[data-shown]_.plan]:[animation:rise_0.6s_var(--ease)_backwards]
          [&[data-shown]_.plan:nth-child(2)]:[animation-delay:0.1s]
          [&[data-shown]_.plan:nth-child(3)]:[animation-delay:0.2s]
          [@media(max-width:860px)]:grid-cols-[minmax(0,_1fr)]"
      data-reveal
    >
      <div className={`plan ${planClasses}`}>
        <h3>Try it</h3>
        <div className="price">Free</div>
        <p>The intro lesson, then one more with a free account.</p>
        <Link className="btn btn-quiet btn-block" href="/lesson/intro">
          Start free
        </Link>
      </div>
      <div className={`plan ${planClasses}`}>
        <h3>Monthly</h3>
        <div className="price num">
          {formatPrice(currency, plan.monthly)}
          <small>/ month</small>
        </div>
        <p>All lessons, projects, daily challenge and certificate.</p>
        <Link className="btn btn-quiet btn-block" href="/pricing">
          Choose monthly
        </Link>
      </div>
      <div
        className={`plan plan-best ${planClasses}
          [&_.badge]:bg-highlight [&_.badge]:text-ink`}
      >
        <h3>
          Annual <span className="badge">Save {annualSaving}%</span>
        </h3>
        <div className="price num">
          {formatPrice(currency, plan.annual)}
          <small>/ year</small>
        </div>
        <p>Everything in Monthly, billed once a year.</p>
        <Link className="btn btn-block" href="/pricing">
          Choose annual
        </Link>
      </div>
    </div>
  );
}
