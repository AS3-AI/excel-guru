import type { Metadata } from "next";
import Link from "next/link";
import { STATIC_METADATA } from "@/lib/seo";
import { MODULES } from "@/lib/modules";
import { getOrder } from "@/lib/lessons";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Doodle } from "@/components/Doodles";
import { HeroActions } from "./HeroActions";
import { HeroSheet } from "./HeroSheet";
import { LandingPricing } from "./LandingPricing";

const landingClasses = [
  "[&_[data-shown]_.doodle_path]:[animation:draw_1.2s_var(--ease)_backwards]",
  "[&_[data-shown]_.doodle_path]:[animation-delay:calc(var(--d,_0)_*_140ms_+_300ms)]",
  "[html[data-motion='on']_&_[data-reveal]:not([data-shown])_.doodle_path]:[stroke-dashoffset:1]",
  "[html[data-motion='on']_&_[data-reveal]:not([data-shown])_.doodle_path]:[fill-opacity:0]",
  "[&_h1]:relative [&_h1]:text-ledger-2xl [&_h1]:leading-[0.98] [&_h1]:tracking-[-0.035em] [&_h1]:[font-weight:750]",
  "[&_h1]:m-[0_0_var(--s5)] [&_h1]:[font-variation-settings:'opsz'_96]",
  "[&_h1_mark]:[color:inherit] [&_h1_mark]:[background-color:transparent] [&_h1_mark]:whitespace-nowrap",
  "[&_h1_mark]:[background-image:linear-gradient(var(--highlight),_var(--highlight))]",
  "[&_h1_mark]:[background-repeat:no-repeat] [&_h1_mark]:[background-size:100%_0.84em]",
  "[&_h1_mark]:[background-position:0_78%] [&_h1_mark]:rounded-ledger-sm [&_h1_mark]:p-[0_0.14em] [&_h1_mark]:m-[0_-0.04em]",
  "[&_h1_mark]:[animation:marker_0.9s_var(--ease)_0.45s_backwards]",
  "[html[data-motion='on']_&_[data-reveal]:not([data-shown])]:opacity-0",
  "[html[data-motion='on']_&_[data-reveal]:not([data-shown])]:[transform:translateY(24px)]",
  "[&_[data-reveal]:not([data-shown])]:[transition:opacity_0.7s_var(--ease),_transform_0.7s_var(--ease)]",
  "[&_[data-reveal][data-shown]]:[animation:reveal_0.7s_var(--ease)_backwards]",
  "[@media(max-width:640px)]:[&_h1_mark]:whitespace-normal",
].join(" ");

const heroClasses = [
  "[&_.doodle_path]:[animation:draw_1.2s_var(--ease)_backwards]",
  "[&_.doodle_path]:[animation-delay:calc(var(--d,_0)_*_140ms_+_300ms)]",
  "relative overflow-hidden p-[var(--s8)_0_var(--s9)]",
  "[@media(min-width:980px)]:min-h-[min(calc(100svh_-_62px),_880px)] [@media(min-width:980px)]:flex",
  "[@media(min-width:980px)]:items-center [@media(min-width:980px)]:p-[var(--s7)_0]",
  "[@media(max-width:640px)]:p-[var(--s6)_0_var(--s8)]",
].join(" ");

const tickerClasses = [
  "overflow-hidden [border-top:var(--line)] bg-ink",
  "[&:hover_.ticker-track]:[animation-play-state:paused]",
  "[&_ul]:flex [&_ul]:m-0 [&_ul]:p-0 [&_ul]:list-none",
  "[&_li]:p-[14px_26px] [&_li]:[border-right:1px_solid_rgb(255_255_255_/_0.16)]",
  "[&_li]:[font:600_var(--fs-sm)_var(--mono)] [&_li]:[color:rgb(255_255_255_/_0.85)] [&_li]:whitespace-nowrap",
  "[&_li_b]:text-highlight",
].join(" ");

const bentoCardClasses = [
  "flex flex-col gap-s5 p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-2)]",
  "[&[data-shown]]:[transition:transform_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]",
  "[&[data-shown]:hover]:[transform:translate(-3px,_-3px)] [&[data-shown]:hover]:[box-shadow:8px_8px_0_var(--ink)]",
  "[&.bento-0]:[grid-column:span_7]",
  "[&.bento-1]:[grid-column:span_5]",
  "[&.bento-2]:[grid-column:1_/_-1] [&.bento-2]:flex-row [&.bento-2]:items-center",
  "[&.bento-2_.ledger-copy]:[flex:1]",
  "[&.bento-2_.mini]:[flex:1] [&.bento-2_.mini]:bg-rose",
  "[&.bento-0_.mini]:bg-mint",
  "[&.bento-1_.mini]:bg-lilac",
  "[&[data-shown]:nth-child(2)]:[animation-delay:0.1s]",
  "[&[data-shown]:nth-child(3)]:[animation-delay:0.2s]",
  "[&[data-shown]_.mini_.row]:[animation:rise_0.5s_var(--ease)_backwards]",
  "[&[data-shown]_.mini_.row:nth-child(2)]:[animation-delay:0.35s]",
  "[&[data-shown]_.mini_.row:nth-child(3)]:[animation-delay:0.45s]",
  "[&[data-shown]_.mini_.dot.done]:[animation:pop_0.5s_var(--ease)_0.6s_backwards]",
  "[&[data-shown]_.mini_.r1]:[animation:ink-in_0.6s_var(--ease)_0.4s_backwards]",
  "[&[data-shown]_.mini_.r2]:[animation:ink-in_0.6s_var(--ease)_0.6s_backwards]",
  "[&[data-shown]_.mini_.r3]:[animation:ink-in_0.6s_var(--ease)_0.8s_backwards]",
  "[&[data-shown]_.mini_.tag.bad]:[animation:shake_0.45s_var(--ease)_0.4s_backwards]",
  "[&[data-shown]_.mini_.note]:[animation:rise_0.5s_var(--ease)_0.6s_backwards]",
  "[&[data-shown]_.mini_.tag.ok]:[animation:pop_0.5s_var(--ease)_1.1s_backwards]",
  "[@media(max-width:860px)]:[&.bento-0]:[grid-column:1_/_-1]",
  "[@media(max-width:860px)]:[&.bento-1]:[grid-column:1_/_-1]",
  "[@media(max-width:860px)]:[&.bento-2]:flex-col [@media(max-width:860px)]:[&.bento-2]:items-stretch",
].join(" ");

const stRowClasses = [
  "grid grid-cols-[44px_minmax(0,_1fr)_120px] items-stretch [border-bottom:1px_solid_var(--border)] text-text",
  "no-underline",
  "[&>span]:flex [&>span]:items-center [&>span]:p-[10px_14px] [&>span]:min-h-[42px]",
  "[&>span+span]:[border-left:1px_solid_var(--border)]",
  "[&.st-head>span]:min-h-[30px] [&.st-head>span]:pt-[4px] [&.st-head>span]:pb-[4px] [&.st-head>span]:justify-center",
  "[&.st-head>span]:bg-butter [&.st-head>span]:text-ink [&.st-head>span]:[font:600_0.76rem_var(--mono)]",
  "[&.st-head]:[border-bottom:2px_solid_var(--ink)]",
  "[&.st-label]:font-bold [&.st-label]:text-ink",
  "[&:is(a)]:[transition:background-color_var(--d1)_var(--ease)]",
  "[&:is(a):hover]:bg-highlight [&:is(a):hover]:no-underline",
  "[&:is(a):hover_.st-gutter]:text-ink [&:is(a):hover_.st-gutter]:bg-highlight [&:is(a):hover_.st-gutter]:font-bold",
  "[&:is(a):hover_.st-name]:text-ink [&:is(a):hover_.st-name]:font-semibold",
  "[&:is(a):hover_.st-n_i]:bg-primary",
  "[&:is(a):focus-visible]:[outline-offset:-3px] [&:is(a):focus-visible]:rounded-[0]",
  "[&.st-total]:[border-bottom:0] [&.st-total]:[border-top:2px_solid_var(--ink)] [&.st-total]:font-bold",
  "[&.st-total]:text-ink",
  "[&.st-total_.st-name]:gap-[10px] [&.st-total_.st-name]:text-muted [&.st-total_.st-name]:font-medium",
  "[&.st-total_.st-name]:text-[0.88rem]",
  "[&.st-total_.st-name_b]:text-primary-strong [&.st-total_.st-name_b]:[font-style:italic]",
  "[&.st-total_.st-n]:[box-shadow:inset_0_0_0_2px_var(--primary)]",
  "[@media(max-width:640px)]:grid-cols-[36px_minmax(0,_1fr)_84px]",
].join(" ");

const closerClasses = [
  "relative overflow-hidden p-[var(--s9)_0] bg-ink text-surface [border-top:var(--line)]",
  "[&_.wrap]:relative [&_.wrap]:grid [&_.wrap]:[justify-items:start] [&_.wrap]:gap-s5",
  "[&_h2]:text-surface [&_h2]:max-w-[22ch] [&_h2]:m-0 [&_h2]:text-[clamp(1.9rem,_4.4vw,_3rem)] [&_h2]:tracking-[-0.03em]",
  "[&_.btn]:[--btn-bg:var(--highlight)] [&_.btn]:[--btn-fg:var(--ink)] [&_.btn]:border-surface",
  "[&_.btn]:[box-shadow:4px_4px_0_var(--surface)]",
  "[&_.btn:hover]:[--btn-bg:#fff] [&_.btn:hover]:[box-shadow:5px_5px_0_var(--surface)]",
  "[&_.btn:active]:[box-shadow:0_0_0_var(--surface)]",
].join(" ");

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
  { value: "2400+", label: "current users" },
];

// Functions taught in the lessons (from lesson titles in content/lessons).
const FUNCTIONS = [
  "SUM",
  "SUMIFS",
  "COUNTIF",
  "IF",
  "IFS",
  "XLOOKUP",
  "VLOOKUP",
  "INDEX",
  "MATCH",
  "FILTER",
  "UNIQUE",
  "TEXTJOIN",
  "LEFT",
  "MID",
  "SEARCH",
  "SUBSTITUTE",
  "AVERAGE",
  "MEDIAN",
  "LARGE",
  "DATEDIF",
  "TODAY",
  "SWITCH",
  "CEILING",
  "COUNTIFS",
];

const STEPS = [
  {
    col: "A",
    title: "Pick a lesson",
    text: "Short lessons across 15 modules, from your first SUM to INDEX/MATCH and dynamic arrays.",
  },
  {
    col: "B",
    title: "Type real formulas",
    text: "A working spreadsheet runs in your browser. Cells, ranges and functions behave as they do in Excel.",
  },
  {
    col: "C",
    title: "Get feedback instantly",
    text: "Every answer is checked the moment you press Enter, with an explanation of the exact mistake when you miss.",
  },
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

export default function Home() {
  const lessonOrder = getOrder();
  const lessonTotal = MODULES.reduce((sum, m) => sum + m.total, 0);

  return (
    <>
      <SiteHeader />
      <main className={`landing ${landingClasses}`} id="main">
        <section
          className={`hero block-mint bg-mint
          ${heroClasses}`}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 [background-image:linear-gradient(rgb(20_32_26_/_0.09)_1px,_transparent_1px),_linear-gradient(90deg,_rgb(20_32_26_/_0.09)_1px,_transparent_1px)] [background-size:96px_32px] [background-position:-1px_-1px] [mask-image:radial-gradient(ellipse_75%_85%_at_75%_40%,_#000_0%,_transparent_75%)]" />
          </div>
          <div
            className="wrap hero-grid relative grid gap-s8 items-center grid-cols-[minmax(0,_1fr)]
          [@media(min-width:980px)]:grid-cols-[minmax(0,_11fr)_minmax(0,_10fr)]"
          >
            <div className="hero-copy">
              <h1>
                Learn Excel by typing{" "}
                <span className="relative inline-block whitespace-nowrap">
                  <mark>real formulas.</mark>
                  <Doodle
                    name="squiggle"
                    className="d-squiggle absolute left-0 bottom-[-14px] w-full h-auto text-primary pointer-events-none"
                  />
                </span>
              </h1>
              <HeroActions lessonOrder={lessonOrder} />
              <dl
                className="facts flex gap-s3 m-[var(--s7)_0_0] p-0
          [&>div]:min-w-[96px] [&>div]:p-[var(--s3)_var(--s4)] [&>div]:[border:var(--line)] [&>div]:rounded-ledger
          [&>div]:bg-surface [&>div]:[box-shadow:var(--shadow-1)]
          [&_dt]:text-[1.7rem] [&_dt]:font-bold [&_dt]:text-ink [&_dt]:leading-[1.1]
          [&_dd]:m-[2px_0_0] [&_dd]:text-text [&_dd]:text-ledger-sm
          [@media(max-width:640px)]:[&>div]:min-w-0 [@media(max-width:640px)]:[&>div]:[flex:1]
          [@media(max-width:640px)]:[&>div]:p-[var(--s2)_var(--s3)]"
                data-reveal
              >
                {FACTS.map((f) => (
                  <div key={f.label}>
                    <dt className="num" data-count={f.value}>
                      {f.value}
                    </dt>
                    <dd>{f.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div
              className="hero-art relative p-[18px_18px_0_0] [animation:rise_0.9s_var(--ease)_0.15s_backwards]
          [@media(max-width:640px)]:p-[12px_12px_0_0]"
            >
              <div
                className="hero-frame absolute inset-[0_0_18px_18px] [border:var(--line)] rounded-ledger-lg bg-surface
          [@media(max-width:640px)]:inset-[0_0_12px_12px]"
                aria-hidden="true"
              />
              <HeroSheet />
              <Doodle
                name="pencil"
                className="d-pencil float w-[120px] left-[-64px] bottom-[-40px] text-ink z-[2]
          [@media(max-width:979px)]:w-[84px] [@media(max-width:979px)]:left-auto [@media(max-width:979px)]:right-[-10px]
          [@media(max-width:979px)]:bottom-[-36px]"
                fill="var(--highlight)"
              />
              <Doodle
                name="sparkle"
                className="d-spark1 twinkle w-[46px] top-[-26px] right-[40px]
          [@media(max-width:640px)]:right-[10px]"
                fill="var(--highlight)"
              />
              <Doodle
                name="sparkle"
                className="d-spark2 twinkle w-[26px] top-[20px] right-[-18px] [animation-delay:0.8s]"
                fill="var(--surface)"
              />
              <Doodle
                name="arrow"
                className="d-arrow w-[120px] left-[-150px] top-[28%] [transform:rotate(8deg)]
          [@media(max-width:1180px)]:hidden"
              />
            </div>
          </div>
        </section>

        <div className={`ticker ${tickerClasses}`} aria-hidden="true">
          <div
            className="ticker-track flex w-[max-content] [animation:ticker_48s_linear_infinite]
          [@media(prefers-reduced-motion:reduce)]:[animation:none]"
          >
            {[0, 1].map((copy) => (
              <ul key={copy}>
                {FUNCTIONS.map((fn) => (
                  <li key={fn}>
                    <b>=</b>
                    {fn}()
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <section
          className="band block-butter relative p-[var(--s9)_0] [border-top:var(--line)]
          [@media(max-width:640px)]:p-[var(--s8)_0]
          bg-butter"
          aria-labelledby="how"
        >
          <div className="wrap">
            <div className="band-head relative max-w-[40rem]" data-reveal>
              <h2 id="how">From lesson to answer in one sitting.</h2>
              <Doodle
                name="bulb"
                className="d-head float w-[76px] right-[-110px] top-[-6px]
          [@media(max-width:860px)]:right-0 [@media(max-width:860px)]:top-[-70px] [@media(max-width:860px)]:w-[58px]"
                fill="var(--highlight)"
              />
              <p className="section-lead text-text max-w-[34rem] m-[0_0_var(--s6)] text-[1.05rem]">
                Short lessons, a real grid, and feedback before you lose your train of thought.
              </p>
            </div>
            <ol className="bento list-none m-0 p-0 grid grid-cols-[repeat(12,_minmax(0,_1fr))] gap-s5">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className={`bento-card bento-${i} ${bentoCardClasses}`}
                  data-reveal
                >
                  <span className="ledger-col hidden" aria-hidden="true">
                    {s.col}
                  </span>
                  <div
                    className="ledger-copy [&_h3]:flex [&_h3]:items-baseline [&_h3]:gap-s3 [&_h3]:text-ledger-lg [&_h3]:mb-s2
          [&_h3_.num]:inline-grid [&_h3_.num]:place-items-center [&_h3_.num]:min-w-[34px] [&_h3_.num]:h-[26px]
          [&_h3_.num]:[border:var(--line)] [&_h3_.num]:rounded-ledger-sm [&_h3_.num]:bg-highlight [&_h3_.num]:text-ink
          [&_h3_.num]:text-ledger-xs [&_h3_.num]:font-bold
          [&_p]:m-0 [&_p]:text-text [&_p]:max-w-[32rem]"
                  >
                    <h3>
                      <span className="num">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </h3>
                    <p>{s.text}</p>
                  </div>
                  <div
                    className="mini min-h-[150px] p-[18px] bg-surface-warm [border:var(--line)] rounded-ledger flex flex-col justify-center gap-[8px]
          [font:500_0.82rem_var(--mono)] overflow-hidden
          [&_.row]:flex [&_.row]:items-center [&_.row]:gap-[10px] [&_.row]:p-[8px_10px] [&_.row]:rounded-ledger-sm
          [&_.row]:bg-surface [&_.row]:[border:var(--line)] [&_.row]:text-muted
          [&_.row_small]:ml-auto [&_.row_small]:text-[0.72rem] [&_.row_small]:text-muted
          [&_.row.on]:text-ink [&_.row.on]:[box-shadow:3px_3px_0_var(--ink)] [&_.row.on]:[transform:translate(-2px,_-2px)]
          [&_.dot]:grid [&_.dot]:place-items-center [&_.dot]:w-[16px] [&_.dot]:h-[16px] [&_.dot]:rounded-[50%]
          [&_.dot]:[border:2px_solid_var(--ink)] [&_.dot]:[flex:none] [&_.dot]:text-primary-ink
          [&_.dot.done]:bg-primary
          [&_.formula]:flex [&_.formula]:rounded-ledger-sm [&_.formula]:bg-surface [&_.formula]:[border:var(--line)]
          [&_.formula]:text-ink [&_.formula]:overflow-hidden
          [&_.formula_b]:p-[10px] [&_.formula_b]:[border-right:2px_solid_var(--ink)] [&_.formula_b]:text-primary-strong
          [&_.formula_b]:[font-style:italic]
          [&_.formula_span]:p-[10px_12px] [&_.formula_span]:whitespace-nowrap [&_.formula_span]:overflow-hidden
          [&_.formula_span]:[text-overflow:ellipsis]
          [&_.formula_em]:text-ink [&_.formula_em]:[font-style:normal] [&_.formula_em]:font-bold
          [&_.formula_i]:[font-style:normal] [&_.formula_i]:font-semibold
          [&_.r1]:text-track-sql
          [&_.r2]:text-danger
          [&_.r3]:[color:color-mix(in_srgb,_var(--primary)_70%,_var(--track-sql))]
          [&_.tag]:inline-flex [&_.tag]:items-center [&_.tag]:gap-[4px] [&_.tag]:[align-self:flex-start] [&_.tag]:p-[3px_8px]
          [&_.tag]:[border:2px_solid_var(--ink)] [&_.tag]:rounded-ledger-sm [&_.tag]:text-[0.74rem] [&_.tag]:font-bold
          [&_.tag]:bg-surface
          [&_.tag.ok]:bg-mint [&_.tag.ok]:text-ink
          [&_.bad]:text-danger
          [&_.note]:text-ink [&_.note]:[font-family:var(--font)] [&_.note]:text-[0.86rem] [&_.note]:leading-[1.45]"
                    aria-hidden="true"
                  >
                    {i === 0 && (
                      <>
                        <div className="row">
                          <span className="dot done">
                            <Icon name="check" size={10} strokeWidth={3} />
                          </span>
                          SUM<small>9 lessons</small>
                        </div>
                        <div className="row on">
                          <span className="dot" />
                          COUNT<small>7 lessons</small>
                        </div>
                        <div className="row">
                          <span className="dot" />
                          Logical<small>7 lessons</small>
                        </div>
                      </>
                    )}
                    {i === 1 && (
                      <>
                        <div className="formula">
                          <b>fx</b>
                          <span>
                            <em>=INDEX</em>(<i className="r1">C2:C9</i>, <em>MATCH</em>(
                            <i className="r2">F2</i>, <i className="r3">A2:A9</i>, 0))
                          </span>
                        </div>
                        <div className="note">
                          References are coloured as you type, like the real thing.
                        </div>
                      </>
                    )}
                    {i === 2 && (
                      <>
                        <span className="tag bad">Not quite</span>
                        <div className="note">
                          The range stops at row 8. Extend it to row 9 to include the last sale.
                        </div>
                        <span className="tag ok">
                          <Icon name="check" size={12} strokeWidth={2.5} />
                          Correct · 4,820
                        </span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="band block-lilac relative p-[var(--s9)_0] [border-top:var(--line)]
          [@media(max-width:640px)]:p-[var(--s8)_0]
          bg-lilac"
          aria-labelledby="curriculum"
        >
          <div
            className="wrap curriculum grid gap-s7 grid-cols-[minmax(0,_1fr)] [align-items:start]
          [@media(min-width:980px)]:grid-cols-[minmax(0,_5fr)_minmax(0,_6fr)] [@media(min-width:980px)]:gap-s8"
          >
            <div
              className="band-head sticky-head relative max-w-[40rem]
          [@media(min-width:980px)]:top-[100px]"
              data-reveal
            >
              <h2 id="curriculum">Fifteen modules, in the order you&apos;ll need them.</h2>
              <Doodle
                name="cells"
                className="d-cells float relative block w-[110px] m-[var(--s2)_0_var(--s5)]"
                fill="var(--surface)"
              />
              <p className="section-lead text-text max-w-[34rem] m-[0_0_var(--s6)] text-[1.05rem]">
                Start with totals and counts, finish with lookups, dates and array formulas. Every
                module is hands-on.
              </p>
              <Link className="btn" href="/lesson/intro">
                Try your first lesson
              </Link>
            </div>
            <div
              className="sheet-table bg-surface [border:var(--line)] rounded-ledger-lg overflow-hidden [box-shadow:var(--shadow-2)] text-[0.95rem]
          [&_ol]:list-none [&_ol]:m-0 [&_ol]:p-0
          [&[data-shown]_li]:[animation:row-in_0.45s_var(--ease)_backwards]
          [&[data-shown]_li]:[animation-delay:calc(var(--i,_0)_*_45ms)]
          [&[data-shown]_.st-n_i]:[animation:bar_0.8s_var(--ease)_backwards]
          [&[data-shown]_.st-n_i]:[animation-delay:calc(var(--i,_0)_*_45ms_+_200ms)]
          [&[data-shown]_.st-n_i]:[transform-origin:left]
          [&[data-shown]_.st-total_.st-n]:[animation:total-flash_1s_var(--ease)_0.9s_backwards]"
              data-reveal
            >
              <div className={`st-row st-head ${stRowClasses}`} aria-hidden="true">
                <span className="st-gutter justify-center bg-surface-sunk text-muted text-[0.76rem] p-0!" />
                <span className="st-col">A</span>
                <span
                  className="st-col st-n relative justify-end tabular-nums
          [&_i]:absolute [&_i]:left-[10px] [&_i]:top-[50%] [&_i]:h-[8px] [&_i]:max-w-[calc(100%_-_52px)] [&_i]:mt-[-4px]
          [&_i]:[border:1.5px_solid_var(--ink)] [&_i]:rounded-[2px] [&_i]:bg-mint
          [@media(max-width:640px)]:[&_i]:hidden"
                >
                  B
                </span>
              </div>
              <div className={`st-row st-label ${stRowClasses}`} aria-hidden="true">
                <span className="st-gutter num justify-center bg-surface-sunk text-muted text-[0.76rem] p-0!">
                  1
                </span>
                <span className="st-name">Module</span>
                <span
                  className="st-n relative justify-end tabular-nums
          [&_i]:absolute [&_i]:left-[10px] [&_i]:top-[50%] [&_i]:h-[8px] [&_i]:max-w-[calc(100%_-_52px)] [&_i]:mt-[-4px]
          [&_i]:[border:1.5px_solid_var(--ink)] [&_i]:rounded-[2px] [&_i]:bg-mint
          [@media(max-width:640px)]:[&_i]:hidden"
                >
                  Lessons
                </span>
              </div>
              <ol>
                {MODULES.map((m) => (
                  <li key={m.slug} style={{ "--i": m.order } as React.CSSProperties}>
                    <Link className={`st-row ${stRowClasses}`} href={`/modules/${m.slug}`}>
                      <span
                        className="st-gutter num justify-center bg-surface-sunk text-muted text-[0.76rem] p-0!"
                        aria-hidden="true"
                      >
                        {m.order + 1}
                      </span>
                      <span className="st-name">{m.title}</span>
                      <span
                        className="st-n num relative justify-end tabular-nums
          [&_i]:absolute [&_i]:left-[10px] [&_i]:top-[50%] [&_i]:h-[8px] [&_i]:max-w-[calc(100%_-_52px)] [&_i]:mt-[-4px]
          [&_i]:[border:1.5px_solid_var(--ink)] [&_i]:rounded-[2px] [&_i]:bg-mint
          [@media(max-width:640px)]:[&_i]:hidden"
                      >
                        {m.total}
                        <span className="sr-only"> lessons</span>
                        <i style={{ width: `${(m.total / 10) * 100}%` }} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <div className={`st-row st-total ${stRowClasses}`}>
                <span
                  className="st-gutter num justify-center bg-surface-sunk text-muted text-[0.76rem] p-0!"
                  aria-hidden="true"
                >
                  {MODULES.length + 2}
                </span>
                <span className="st-name num">
                  <b aria-hidden="true">fx</b>
                  <span aria-hidden="true">=SUM(B2:B{MODULES.length + 1})</span>
                  <span className="sr-only">Total</span>
                </span>
                <span
                  className="st-n num relative justify-end tabular-nums
          [&_i]:absolute [&_i]:left-[10px] [&_i]:top-[50%] [&_i]:h-[8px] [&_i]:max-w-[calc(100%_-_52px)] [&_i]:mt-[-4px]
          [&_i]:[border:1.5px_solid_var(--ink)] [&_i]:rounded-[2px] [&_i]:bg-mint
          [@media(max-width:640px)]:[&_i]:hidden"
                >
                  {lessonTotal}
                  <span className="sr-only"> lessons</span>
                </span>
              </div>
              <p className="st-note m-0 p-[10px_14px] [border-top:1px_solid_var(--border)] bg-surface-warm text-muted text-ledger-sm">
                Plus the free intro lesson.
              </p>
            </div>
          </div>
        </section>

        <section
          className="band block-sky relative p-[var(--s9)_0] [border-top:var(--line)]
          [@media(max-width:640px)]:p-[var(--s8)_0]
          bg-sky"
          aria-labelledby="pricing"
        >
          <div className="wrap">
            <div className="band-head relative max-w-[40rem]" data-reveal>
              <h2 id="pricing">Try it free. Pay when you&apos;re sure.</h2>
              <Doodle
                name="trophy"
                className="d-head float w-[76px] right-[-110px] top-[-6px]
          [@media(max-width:860px)]:right-0 [@media(max-width:860px)]:top-[-70px] [@media(max-width:860px)]:w-[58px]"
                fill="var(--highlight)"
              />
              <p className="section-lead text-text max-w-[34rem] m-[0_0_var(--s6)] text-[1.05rem]">
                The intro lesson is free with no sign-up. Everything else is one plan, billed your
                way.
              </p>
            </div>
            <LandingPricing />
          </div>
        </section>

        <section
          className="band block-rose relative p-[var(--s9)_0] [border-top:var(--line)]
          [@media(max-width:640px)]:p-[var(--s8)_0]
          bg-rose"
          aria-labelledby="faq"
        >
          <div
            className="wrap faq-grid grid gap-s6 grid-cols-[minmax(0,_1fr)]
          [@media(min-width:980px)]:grid-cols-[minmax(0,_5fr)_minmax(0,_7fr)] [@media(min-width:980px)]:gap-s8
          [&>div:last-child]:p-[var(--s2)_var(--s5)] [&>div:last-child]:bg-surface [&>div:last-child]:[border:var(--line)]
          [&>div:last-child]:rounded-ledger-lg [&>div:last-child]:[box-shadow:var(--shadow-2)]
          [&_.faq-item:last-child]:[border-bottom:0]"
          >
            <div className="band-head relative max-w-[40rem]" data-reveal>
              <h2 id="faq">Before you start</h2>
              <Doodle
                name="bubble"
                className="d-bubble float relative block w-[110px] mt-s2"
                fill="var(--surface)"
              />
              <p className="section-lead text-text max-w-[34rem] m-[0_0_var(--s6)] text-[1.05rem]">
                Anything else is in <Link href="/help">Help</Link>.
              </p>
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

        <section className={`closer ${closerClasses}`} aria-labelledby="closer">
          <div className="wrap" data-reveal>
            <Doodle
              name="check"
              className="d-check float w-[160px] right-[6%] top-[50%] mt-[-80px] text-highlight
          [@media(max-width:860px)]:hidden"
            />
            <p
              className="closer-fx num inline-flex gap-[12px] m-0 p-[6px_12px] [border:2px_solid_rgb(255_255_255_/_0.3)] rounded-ledger-sm
          [color:rgb(255_255_255_/_0.8)] text-ledger-sm
          [&_b]:text-highlight [&_b]:[font-style:italic]
          [&::after]:[content:''] [&::after]:w-[2px] [&::after]:h-[1em] [&::after]:[align-self:center] [&::after]:bg-highlight
          [&::after]:[animation:blink_1s_steps(1)_infinite]"
              aria-hidden="true"
            >
              <b>fx</b>=LESSON(1)
            </p>
            <h2 id="closer">Your first formula is two minutes away.</h2>
            <Link className="btn btn-lg" href="/lesson/intro">
              Start the free lesson <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Reveal />
    </>
  );
}
