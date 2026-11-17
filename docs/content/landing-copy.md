# Landing page copy — draft 1 (card C15)

Status: **draft for owner review. Nothing here is in the code yet.** Approve, edit or reject each block, then
Claude builds it into `apps/web/app/(marketing)/page.tsx` (with T45, the "Start free" switch).

Written with the copywriting skill. Original wording; nothing copied from `docs/teardown.md`.

## Assumptions (change any of these and the copy changes)
- **Reader:** someone who uses Excel at work or study, can already type a sum, and feels slow or unsure beyond
  that. India and international.
- **Goal of the page:** get them to start the first lesson (free, no sign-up). Payment comes later, inside the product.
- **Big idea:** you learn by typing real formulas into a real spreadsheet, and every answer is checked at once.
  No videos to sit through, no Excel to install.
- **Proof we have today:** a demo of a lesson, the real numbers (86 lessons, 15 modules), and the refund promise.
  **No testimonials yet** — none are invented. Slot for the first real one is marked `[TESTIMONIAL]`.
- **Claims kept as the owner decided:** 4 real-data projects, 1 verifiable certificate, daily challenge — all
  described as part of premium, delivered soon.
- **Prices:** never typed in copy. `{monthly}`, `{annual}` and `{saving}` come from `plans.ts` at build time.
- Guarantee wording is the one already on the pricing page: "Cancel any time · full refund if unhappy".

---

## 1. Hero

**Headline (use this one):**
> Learn Excel by typing real formulas.

*Why:* specific, six words, says exactly what you do. It stays from the current page.

**Alternatives to test later (A/B):**
- Stop watching Excel videos. Start typing formulas.
- Learn Excel by doing it, not by watching.

**Lead (replaces the current paragraph and drops the waitlist sentence):**
> Type a formula, get an answer, and know straight away if it's right. If it isn't, you see why.
> You build real skill one small step at a time, right in your browser.

**Button:** `Start the first lesson — free`

**Line under the button:**
> No sign-up. No Excel needed. Works on your phone too.

**Stats row (all true today or promised):**
| Number | Label |
|---|---|
| 86 | hands-on lessons |
| 15 | modules, SUM to INDEX/MATCH |
| 4 | real-data projects |
| 1 | certificate you can verify |

---

## 2. See it (new section)

**Heading:** Try one lesson. Then decide.

**Visual:** a short looping clip or 3 stills of one lesson: the task, the formula typed into the grid, the green
check with the one-sentence explanation. *(Owner/Claude to capture from a real lesson; no mock-ups.)*

**Caption:**
> This is the whole product. A task, a real grid, your formula, an instant check. If it's wrong, you're told why.

*Source: "proof before belief" section from `landing-copy-india.md` (draft 3). Only this block was taken from it.*

---

## 3. How it works

**Heading:** Three things happen in every lesson

1. **You get a small task.** One idea at a time, with data you can check in your head.
2. **You type the formula yourself.** In a real spreadsheet that runs in your browser.
3. **You know at once if it's right.** Wrong? You see why, with a plain-English explanation.

---

## 4. What you'll be able to do (replaces the list of module names)

**Heading:** What you'll be able to do

Each line is an outcome; the function names are small print underneath.

| Module | Outcome line | Small print |
|---|---|---|
| SUM | Add up any list in seconds | SUM, SUMIF |
| COUNT | Count only the rows that match | COUNT, COUNTIF, COUNTIFS |
| Logical | Make a sheet decide for you | IF, AND, OR |
| Lookup | Find a price or name in a big table | VLOOKUP, XLOOKUP |
| Index Match | Look things up the flexible way | INDEX, MATCH |
| Text Search | Pull the piece you need out of messy text | LEFT, RIGHT, MID, FIND, SEARCH |
| Text Manipulation | Clean, join and fix names and codes | CONCAT, TEXTJOIN, UPPER, SUBSTITUTE |
| Statistical | Find the average, the biggest and the middle | AVERAGE, MIN, MAX, MEDIAN |
| Dates | Work out ages, deadlines and gaps | DATE, TODAY, DATEDIF |
| Tables | Summarise a big table by category | pivot-style summaries, FILTER |
| Array Formulas | Filter and de-duplicate in one formula | UNIQUE, FILTER |
| Intro to Shortcuts | Do the everyday moves without the mouse | Ctrl+B, fill down, Alt key tips |
| Cell Selection | Jump around a big sheet fast | Ctrl+Arrow, Shift+Arrow |
| Other Skills | Use sheets and colour-coded rules | worksheets, conditional formatting |
| Combined | Put it all together on real problems | case studies |

**Link under the grid:** `Read the free Excel function guides →` (links to `/learn`)

---

## 5. Who it's for (new, short)

**Heading:** Made for people who use Excel but don't feel good at it

> If you can add up a column but freeze at a lookup, this is for you. If you're starting from zero, lesson one
> starts with the very basics. If you're studying or job hunting, you'll learn the formulas people are asked about.

---

## 6. Pricing

**Heading:** Start free. Upgrade when you want everything.

**Intro line:**
> The first lessons are free. Premium unlocks every lesson, the projects, the daily challenge and your
> certificate.

**Annual (shown first, highlighted, "Best value"):**
> {annual} a year — that's {annual ÷ 12} a month. Save {saving}% against paying monthly.

**Monthly:**
> {monthly} a month. Stop any time.

**Under both (the guarantee, the same words as the pricing page):**
> Cancel any time · full refund if unhappy

**Premium includes:**
- Every lesson, 86 of them
- Four real-data projects
- The daily challenge and leaderboards
- A certificate you can share, with a public link anyone can check

**Button:** `Start free` (upgrade happens from the dashboard or pricing page)

*Note:* if the AI explanations stay switched off at launch, do not list them here.

---

## 7. FAQ (rewritten; objections answered first)

**I'm a total beginner. Will I keep up?**
> Yes. The first lesson starts with a single sum. Every lesson adds one idea, and you never go on until you've
> done it.

**How is this different from watching videos?**
> You do it. Every step has you type a formula, and it's checked straight away, so you find out what you don't
> know yet — not after you've watched an hour.

**Do I need Excel installed?**
> No. Lessons run in your browser, on a laptop or a phone.

**Is any of it free?**
> Yes. Try the first lesson with no sign-up. Make a free account and you get one more.
> *(Confirm this rule is still accurate before publishing.)*

**Does it work for Google Sheets too?**
> The formulas you learn work the same in Google Sheets for almost every lesson.

**Do I get a certificate?**
> Premium members who finish every lesson get one, with a public link so anyone can verify it.

**Can I cancel any time?**
> Yes. Cancel whenever you like and you keep access until the end of the period you paid for. If you're not
> happy, you get a full refund.

---

## 8. Closing

**Heading:** Your first formula is two minutes away.
*(Check this is true by timing the intro lesson; if it isn't, use "Your first formula is one click away.")*

> Type it, see it checked, and you'll know if this works for you.

**Button:** `Start the first lesson — free`

**Line under:** No sign-up. No Excel needed.

*(Waitlist form removed once T45 emails the existing waitlist.)*

---

## 9. Footer

Links: **Guides** (new) · Pricing · Help · Privacy · Terms

---

## Testimonial slot (empty until we have a real one)
`[TESTIMONIAL]` — one real sentence from a beta user, with their first name and what they do, placed between
sections 3 and 4. Ask the first 10 beta users for one.

## Questions for the owner before this is built
1. Reader and goal as assumed at the top — right?
2. Is "Your first formula is two minutes away" true? (I'll time the intro lesson.)
3. Free-tier rule in the FAQ: intro with no sign-up, then one more lesson with a free account?
4. Are the AI explanations going to be on at launch (affects the pricing list)?
5. Any wording you want changed. Reply with block numbers.

## How we judge it afterwards
Once Vercel analytics is on: share of visitors who click "Start the first lesson", share who finish lesson one, and
the headline A/B above. One change at a time.
