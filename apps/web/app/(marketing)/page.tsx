import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { currencyForCountry, formatPrice, PLANS } from "@/lib/plans";
import { STATIC_METADATA } from "@/lib/seo";
import { WaitlistForm } from "./WaitlistForm";

export const metadata: Metadata = {
  title: {
    absolute: STATIC_METADATA.landing.title,
  },
  description: STATIC_METADATA.landing.description,
  openGraph: {
    title: STATIC_METADATA.landing.title,
    description: STATIC_METADATA.landing.description,
  },
};

const MODULES = [
  "SUM",
  "COUNT",
  "Logical",
  "Lookup",
  "Text Search",
  "Intro to Shortcuts",
  "Cell Selection",
  "Text Manipulation",
  "Index Match",
  "Statistical",
  "Tables",
  "Dates",
  "Other Skills",
  "Array Formulas",
  "Combined",
];

const STATS = [
  { value: "86", label: "lessons" },
  { value: "15", label: "modules" },
  { value: "4", label: "real-data projects" },
  { value: "1", label: "verifiable certificate" },
];

const STEPS = [
  { title: "Pick a lesson", text: "86 short lessons across 15 modules, from SUM to INDEX/MATCH." },
  { title: "Type real formulas", text: "A real spreadsheet runs in your browser. No downloads, no setup." },
  { title: "Get instant feedback", text: "Every answer is checked instantly, with an AI explanation when you get one wrong." },
];

const FAQ = [
  {
    q: "Do I need Excel installed?",
    a: "No. Lessons run in a spreadsheet simulator in your browser, on desktop or phone.",
  },
  {
    q: "Is any of it free?",
    a: "Yes. Try the intro lesson with no sign-up, then create a free account for one more lesson.",
  },
  {
    q: "Does it work for Google Sheets too?",
    a: "The formulas you learn work the same in Google Sheets for almost every lesson.",
  },
  {
    q: "Do I get a certificate?",
    a: "Premium members who finish every lesson get a certificate with a public verification link.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Monthly and annual plans can be cancelled whenever you like, and you keep access until the period ends.",
  },
];

export default async function Home() {
  const country = (await headers()).get("x-vercel-ip-country");
  const currency = currencyForCountry(country);
  const plan = PLANS[currency];
  const annualSaving = Math.round((1 - plan.annual / (plan.monthly * 12)) * 100);

  return (
    <main>
      <div className="wrap">
        <div className="brand">Excel Guru</div>

        <section className="hero">
          <h1>Learn Excel by typing <mark>real</mark> formulas.</h1>
          <p className="lead">
            Interactive lessons with a spreadsheet in your browser and instant feedback on every answer.
            Join the waitlist and get early access at launch.
          </p>
          <Link className="btn" href="/lesson/intro">Start free — no sign-up</Link>
          <ul className="stats">
            {STATS.map((s) => (
              <li key={s.label}>
                <strong>{s.value}</strong>
                {s.label}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how">
          <h2 id="how">How it works</h2>
          <div className="grid">
            {STEPS.map((s, i) => (
              <div className="card" key={s.title}>
                <div className="step">Step {i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="learn">
          <h2 id="learn">What you&apos;ll learn</h2>
          <ul className="modules">
            {MODULES.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link className="btn" href="/lesson/intro">Try your first lesson</Link>
        </section>

        <section aria-labelledby="pricing">
          <h2 id="pricing">Pricing</h2>
          <div className="grid">
            <div className="card">
              <h3>Monthly</h3>
              <div className="price">
                {formatPrice(currency, plan.monthly)} <small>/ month</small>
              </div>
              <p>All lessons, projects, daily challenge and certificate.</p>
            </div>
            <div className="card">
              <h3>
                Annual <span className="badge">Save {annualSaving}%</span>
              </h3>
              <div className="price">
                {formatPrice(currency, plan.annual)} <small>/ year</small>
              </div>
              <p>Everything in Monthly, billed once a year.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq">FAQ</h2>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section aria-labelledby="cta">
          <h2 id="cta">Be first in line</h2>
          <WaitlistForm source="footer" />
        </section>
      </div>

      <footer>
        <div className="wrap">
          <nav aria-label="Footer navigation">
            <Link href="/pricing">Pricing</Link>
            <Link href="/help">Help</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <p>© {new Date().getFullYear()} Excel Guru</p>
        </div>
      </footer>
    </main>
  );
}
