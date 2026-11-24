import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { currencyForCountry, formatPrice, PLANS } from "@/lib/plans";
import { STATIC_METADATA } from "@/lib/seo";
import { MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Doodle } from "@/components/Doodles";
import "./landing.css";
import { HeroSheet } from "./HeroSheet";

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

const FACTS = [
  { value: "86", label: "lessons" },
  { value: "15", label: "modules" },
  { value: "0", label: "installs" },
];

// Functions taught in the lessons (from lesson titles in content/lessons).
const FUNCTIONS = ["SUM", "SUMIFS", "COUNTIF", "IF", "IFS", "XLOOKUP", "VLOOKUP", "INDEX", "MATCH", "FILTER", "UNIQUE", "TEXTJOIN", "LEFT", "MID", "SEARCH", "SUBSTITUTE", "AVERAGE", "MEDIAN", "LARGE", "DATEDIF", "TODAY", "SWITCH", "CEILING", "COUNTIFS"];

// Grid-paper cells (column, row on the 96×32 hero grid) that light up in turn, like a moving selection.
const LIT = [[9, 3], [11, 6], [8, 9], [12, 11], [10, 14], [13, 4], [7, 12]] as const;

const STEPS = [
  { col: "A", title: "Pick a lesson", text: "Short lessons across 15 modules, from your first SUM to INDEX/MATCH and dynamic arrays." },
  { col: "B", title: "Type real formulas", text: "A working spreadsheet runs in your browser. Cells, ranges and functions behave as they do in Excel." },
  { col: "C", title: "Get feedback instantly", text: "Every answer is checked the moment you press Enter, with an explanation of the exact mistake when you miss." },
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
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  const signedIn = !!user;

  const country = (await headers()).get("x-vercel-ip-country");
  const currency = currencyForCountry(country);
  const plan = PLANS[currency];
  const annualSaving = Math.round((1 - plan.annual / (plan.monthly * 12)) * 100);

  const lessonTotal = MODULES.reduce((sum, m) => sum + m.total, 0);

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main className="landing" id="main">
        <section className="hero block-mint">
          <div className="hero-paper" aria-hidden="true">
            {LIT.map(([c, r], i) => <i key={i} style={{ left: c * 96, top: r * 32, animationDelay: `${i * 1.1}s` }} />)}
          </div>
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow"><span className="ref">A1</span>Interactive Excel lessons</p>
              <h1>Learn Excel by typing <mark>real formulas</mark>.<Doodle name="squiggle" className="d-squiggle" /></h1>
              <p className="lead">
                {signedIn ? (
                  "Welcome back! Continue your streak and pick up right where you left off, or review your formulas."
                ) : (
                  "A spreadsheet that runs in your browser, with every answer checked the moment you press Enter. Start with the intro lesson. No account needed."
                )}
              </p>
              <div className="hero-actions">
                {signedIn ? (
                  <>
                    <Link className="btn btn-lg" href="/dashboard">Go to Dashboard <Icon name="arrowRight" size={18} /></Link>
                    <Link className="btn btn-lg btn-quiet" href="/profile">View Profile</Link>
                  </>
                ) : (
                  <>
                    <Link className="btn btn-lg" href="/lesson/intro">Start the free lesson <Icon name="arrowRight" size={18} /></Link>
                    <Link className="btn btn-lg btn-quiet" href="#curriculum">Browse the curriculum</Link>
                  </>
                )}
              </div>
              <dl className="facts" data-reveal>
                {FACTS.map((f) => (
                  <div key={f.label}><dt className="num" data-count={f.value}>{f.value}</dt><dd>{f.label}</dd></div>
                ))}
              </dl>
            </div>
            <div className="hero-art">
              <div className="hero-frame" aria-hidden="true" />
              <HeroSheet />
              <Doodle name="pencil" className="d-pencil float" fill="var(--highlight)" />
              <Doodle name="sparkle" className="d-spark1 twinkle" fill="var(--highlight)" />
              <Doodle name="sparkle" className="d-spark2 twinkle" fill="var(--surface)" />
              <Doodle name="arrow" className="d-arrow" />
            </div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => <ul key={copy}>{FUNCTIONS.map((fn) => <li key={fn}><b>=</b>{fn}()</li>)}</ul>)}
          </div>
        </div>

        <section className="band block-butter" aria-labelledby="how">
          <div className="wrap">
            <div className="band-head" data-reveal>
              <p className="eyebrow"><span className="ref">B1</span>How it works</p>
              <h2 id="how">From lesson to answer in one sitting.</h2>
              <Doodle name="bulb" className="d-head float" fill="var(--highlight)" />
              <p className="section-lead">Short lessons, a real grid, and feedback before you lose your train of thought.</p>
            </div>
            <ol className="bento">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`bento-card bento-${i}`} data-reveal>
                  <span className="ledger-col" aria-hidden="true">{s.col}</span>
                  <div className="ledger-copy">
                    <h3><span className="num">{String(i + 1).padStart(2, "0")}</span>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                  <div className="mini" aria-hidden="true">
                    {i === 0 && (
                      <>
                        <div className="row"><span className="dot done"><Icon name="check" size={10} strokeWidth={3} /></span>SUM<small>9 lessons</small></div>
                        <div className="row on"><span className="dot" />COUNT<small>7 lessons</small></div>
                        <div className="row"><span className="dot" />Logical<small>7 lessons</small></div>
                      </>
                    )}
                    {i === 1 && (
                      <>
                        <div className="formula"><b>fx</b><span><em>=INDEX</em>(<i className="r1">C2:C9</i>, <em>MATCH</em>(<i className="r2">F2</i>, <i className="r3">A2:A9</i>, 0))</span></div>
                        <div className="note">References are coloured as you type, like the real thing.</div>
                      </>
                    )}
                    {i === 2 && (
                      <>
                        <span className="tag bad">Not quite</span>
                        <div className="note">The range stops at row 8. Extend it to row 9 to include the last sale.</div>
                        <span className="tag ok"><Icon name="check" size={12} strokeWidth={2.5} />Correct · 4,820</span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band block-lilac" aria-labelledby="curriculum">
          <div className="wrap curriculum">
            <div className="band-head sticky-head" data-reveal>
              <p className="eyebrow"><span className="ref">C1</span>Curriculum</p>
              <h2 id="curriculum">Fifteen modules, in the order you&apos;ll need them.</h2>
              <Doodle name="cells" className="d-cells float" fill="var(--surface)" />
              <p className="section-lead">Start with totals and counts, finish with lookups, dates and array formulas. Every module is hands-on.</p>
              <Link className="btn" href="/lesson/intro">Try your first lesson</Link>
            </div>
            <div className="sheet-table" data-reveal>
              <div className="st-row st-head" aria-hidden="true">
                <span className="st-gutter" />
                <span className="st-col">A</span>
                <span className="st-col st-n">B</span>
              </div>
              <div className="st-row st-label" aria-hidden="true">
                <span className="st-gutter num">1</span>
                <span className="st-name">Module</span>
                <span className="st-n">Lessons</span>
              </div>
              <ol>
                {MODULES.map((m) => (
                  <li key={m.slug} style={{ "--i": m.order } as React.CSSProperties}>
                    <Link className="st-row" href={`/modules/${m.slug}`}>
                      <span className="st-gutter num" aria-hidden="true">{m.order + 1}</span>
                      <span className="st-name">{m.title}</span>
                      <span className="st-n num">{m.total}<span className="sr-only"> lessons</span><i style={{ width: `${(m.total / 10) * 100}%` }} aria-hidden="true" /></span>
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="st-row st-total">
                <span className="st-gutter num" aria-hidden="true">{MODULES.length + 2}</span>
                <span className="st-name num"><b aria-hidden="true">fx</b><span aria-hidden="true">=SUM(B2:B{MODULES.length + 1})</span><span className="sr-only">Total</span></span>
                <span className="st-n num">{lessonTotal}<span className="sr-only"> lessons</span></span>
              </div>
              <p className="st-note">Plus the free intro lesson.</p>
            </div>
          </div>
        </section>

        <section className="band block-sky" aria-labelledby="pricing">
          <div className="wrap">
            <div className="band-head" data-reveal>
              <p className="eyebrow"><span className="ref">D1</span>Plans</p>
              <h2 id="pricing">Try it free. Pay when you&apos;re sure.</h2>
              <Doodle name="trophy" className="d-head float" fill="var(--highlight)" />
              <p className="section-lead">The intro lesson is free with no sign-up. Everything else is one plan, billed your way.</p>
            </div>
            <div className="plans" data-reveal>
              <div className="plan">
                <h3>Try it</h3>
                <div className="price">Free</div>
                <p>The intro lesson, then one more with a free account.</p>
                <Link className="btn btn-quiet btn-block" href="/lesson/intro">Start free</Link>
              </div>
              <div className="plan">
                <h3>Monthly</h3>
                <div className="price num">{formatPrice(currency, plan.monthly)}<small>/ month</small></div>
                <p>All lessons, projects, daily challenge and certificate.</p>
                <Link className="btn btn-quiet btn-block" href="/pricing">Choose monthly</Link>
              </div>
              <div className="plan plan-best">
                <h3>Annual <span className="badge">Save {annualSaving}%</span></h3>
                <div className="price num">{formatPrice(currency, plan.annual)}<small>/ year</small></div>
                <p>Everything in Monthly, billed once a year.</p>
                <Link className="btn btn-block" href="/pricing">Choose annual</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="band block-rose" aria-labelledby="faq">
          <div className="wrap faq-grid">
            <div className="band-head" data-reveal>
              <p className="eyebrow"><span className="ref">E1</span>Questions</p>
              <h2 id="faq">Before you start</h2>
              <Doodle name="bubble" className="d-bubble float" fill="var(--surface)" />
              <p className="section-lead">Anything else is in <Link href="/help">Help</Link>.</p>
            </div>
            <div data-reveal>
              {FAQ.map((f) => (
                <details className="faq-item" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closer" aria-labelledby="closer">
          <div className="wrap" data-reveal>
            <Doodle name="check" className="d-check float" />
            <p className="closer-fx num" aria-hidden="true"><b>fx</b>=LESSON(1)</p>
            <h2 id="closer">Your first formula is two minutes away.</h2>
            <Link className="btn btn-lg" href="/lesson/intro">Start the free lesson <Icon name="arrowRight" size={18} /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Reveal />
    </>
  );
}
