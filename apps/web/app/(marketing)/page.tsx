import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { currencyForCountry, formatPrice, PLANS } from "@/lib/plans";
import { STATIC_METADATA } from "@/lib/seo";
import "./landing.css";

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
    <main className="landing">
      <header className="nav">
        <div className="wrap">
          <Link className="brand" href="/">
            <span className="mark" aria-hidden="true">fx</span>
            Excel Guru
          </Link>
          <Link className="hide-sm" href="/pricing">Pricing</Link>
          <Link className="hide-sm" href="/help">Help</Link>
          <Link href="/login">Log in</Link>
          <Link className="btn" href="/signup">Sign up</Link>
        </div>
      </header>

      <div className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <h1>Learn Excel by typing <mark>real</mark> formulas.</h1>
            <p className="lead">
              A spreadsheet that runs in your browser, with every answer checked the moment you type it.
              Start with the intro lesson. No account needed.
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/lesson/intro">Start free — no sign-up</Link>
              <Link className="btn btn-quiet" href="#learn">See all 15 modules</Link>
            </div>
            <ul className="stats">
              {STATS.map((s) => (
                <li key={s.label}>
                  <strong>{s.value}</strong>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          <figure className="sheet" aria-label="A lesson: type =SUM(B2:B5) into cell B6 and the answer is marked correct" style={{ margin: 0 }}>
            <div className="sheet-bar" aria-hidden="true"><i /><i /><i /><span>Lesson 3 · SUM</span></div>
            <div className="sheet-task" aria-hidden="true">
              <p>Total the four regions in B6.</p>
              <small>Type a formula, then press Enter.</small>
            </div>
            <div className="fx" aria-hidden="true">
              <b>fx</b>
              <span><span className="typed">=SUM(B2:B5)</span><i className="caret" /></span>
            </div>
            <div className="grid-sheet" aria-hidden="true">
              <div className="h" /><div className="h">A</div><div className="h">B</div>
              <div className="h">1</div><div><b>Region</b></div><div className="n"><b>Sales</b></div>
              <div className="h">2</div><div>North</div><div className="n">1,240</div>
              <div className="h">3</div><div>South</div><div className="n">980</div>
              <div className="h">4</div><div>East</div><div className="n">1,410</div>
              <div className="h">5</div><div>West</div><div className="n">1,190</div>
              <div className="h">6</div><div><b>Total</b></div><div className="sel"><span>4,820</span></div>
            </div>
            <div className="feedback" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18" /><path d="m6 10.5 3 3 5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span><strong>Correct.</strong> SUM adds every cell from B2 to B5.</span>
            </div>
          </figure>
        </section>

        <section aria-labelledby="how">
          <p className="eyebrow">How it works</p>
          <h2 id="how">Three steps from lesson to answer.</h2>
          <p className="section-lead">Short lessons, a real grid, and feedback before you lose your train of thought.</p>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="card" key={s.title}>
                <div className="mini" aria-hidden="true">
                  {i === 0 && (
                    <>
                      <div className="row"><span className="dot done" />SUM</div>
                      <div className="row on"><span className="dot" />COUNT</div>
                      <div className="row"><span className="dot" />Logical</div>
                    </>
                  )}
                  {i === 1 && (
                    <>
                      <div className="formula"><em>=INDEX</em>(C2:C9, <em>MATCH</em>(F2, A2:A9, 0))</div>
                      <div className="note">Cells, ranges and functions work as in Excel.</div>
                    </>
                  )}
                  {i === 2 && (
                    <>
                      <span className="tag bad">Not quite</span>
                      <div className="note">The range stops at row 8. Extend it to row 9 to include the last sale.</div>
                      <span className="tag ok">Fixed: 4,820</span>
                    </>
                  )}
                </div>
                <div className="card-body">
                  <div className="step">Step {i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="learn">
          <p className="eyebrow">Curriculum</p>
          <h2 id="learn">What you&apos;ll learn</h2>
          <p className="section-lead">Fifteen modules, from your first SUM to array formulas.</p>
          <ul className="modules">
            {MODULES.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="cta-row">
            <Link className="btn" href="/lesson/intro">Try your first lesson</Link>
          </div>
        </section>

        <section aria-labelledby="pricing">
          <p className="eyebrow">Plans</p>
          <h2 id="pricing">Pricing</h2>
          <p className="section-lead">The intro lesson is free. Everything else is one plan, billed your way.</p>
          <div className="plans">
            <div className="card">
              <div className="card-body">
                <h3>Monthly</h3>
                <div className="price">
                  {formatPrice(currency, plan.monthly)} <small>/ month</small>
                </div>
                <p>All lessons, projects, daily challenge and certificate.</p>
              </div>
            </div>
            <div className="card plan-best">
              <div className="card-body">
                <h3>
                  Annual <span className="badge">Save {annualSaving}%</span>
                </h3>
                <div className="price">
                  {formatPrice(currency, plan.annual)} <small>/ year</small>
                </div>
                <p>Everything in Monthly, billed once a year.</p>
              </div>
            </div>
          </div>
          <p className="price-link"><Link href="/pricing">See pricing details</Link></p>
        </section>

        <section aria-labelledby="faq">
          <p className="eyebrow">Questions</p>
          <h2 id="faq">FAQ</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer>
        <div className="wrap">
          <p>© {new Date().getFullYear()} Excel Guru</p>
          <nav aria-label="Footer navigation">
            <Link href="/pricing">Pricing</Link>
            <Link href="/help">Help</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
