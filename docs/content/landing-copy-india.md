# Landing page copy — India variant (draft 3, for owner review)

Status: **draft. Nothing here is in the code yet.** This is an alternative to `landing-copy.md` (draft 1), meant
for visitors where `currencyForCountry()` returns INR. Same facts, same structure, different emphasis. Approve,
edit or reject by block number.

Original wording; nothing copied from `docs/teardown.md`. Prices are never typed: `{monthly}`, `{annual}`,
`{per_month}`, `{per_day}` come from `plans.ts` at build time.

## The reasoning (why the copy looks different for India)

| What the Indian reader tends to feel | What the copy does about it |
|---|---|
| **Excel is a career gate, not a hobby.** It is on the job description, in the campus test and in the interview. The fear is being filtered out, not "being slow". | Lead with the outcome that matters: being the person who can do it, at work and in interviews. |
| **The real competitor is free YouTube.** They have already watched videos and still can't do it unaided. | Name it kindly in section 3 and say what videos can't do: make you type it and tell you if it's wrong. |
| **Distrust of "free" and of subscriptions.** Hidden card charges and hard-to-cancel plans are a known worry. | Put the risk reversal in the first screen: no sign-up, no card, full refund. Say it three times, in different places. |
| **Price is judged by value per rupee.** Annual-first, shown as a small daily or monthly number, and compared with what they'd otherwise spend. | Annual is the hero plan. Show the per-month and per-day figure. No invented "coaching class" prices. |
| **Mobile-first, patchy data.** Many learn on a phone. | Say "works on your phone" in the hero, not in the FAQ. |
| **Proof before belief.** They want to see it work before they trust it. | The demo comes right after the hero. Real numbers only. Testimonial slot stays empty until we have real ones. |
| **Certificates carry weight** (CV, LinkedIn, family). | Keep the certificate, framed as something a recruiter can check. Delivered soon, so worded as "coming", not "get". |
| **Pride and family.** Learning is often a "get ahead" move that someone is watching. | One line on being the person others ask for help. Not overdone. |

Not used on purpose: fake countdown timers, "only 3 seats left", invented learner counts, invented
testimonials, salary promises. These convert once and cost trust. We have none of the facts to back them.

## Things I need you to confirm before this is built
1. **UPI.** Razorpay supports it, but is it switched on for our account? If yes, the "pay by UPI" line is a strong
   trust signal. If no, the line is deleted.
2. **Free tier rule** (intro with no sign-up, then 2 lessons in total with a free account). FAQ uses it.
3. **"No card needed to start"** is true today, since payment only happens at the paywall.
4. **Certificate, projects, daily challenge** are not live. Copy says "coming", as in draft 1.
5. **Hindi / Hinglish.** All copy below is plain English that works across regions. Optional: a Hinglish line under
   the button. Offered at the end, not built in.

---

## 1. Hero

**Headline (use this one):**
> Be the person who actually knows Excel.

*Why:* it sells the outcome the reader is afraid of missing (being the one who can do it), in plain words.

**Keep-the-mechanic alternative (the draft 1 line, safest to A/B against):**
> Learn Excel by typing real formulas.

**Other options to test:**
- Excel is in the job description. Make it your strength.
- Watched the videos. Still stuck on the formula? Practise it for real.

**Lead:**
> Type real formulas in a real spreadsheet, and see straight away whether you got it right. Short lessons, any
> device, nothing to install. Ready for the test, the interview and your first week at work.

**Button:** `Start the first lesson — free`

**Line under the button (the risk reversal, first screen):**
> No sign-up. No card. Works on your phone.

**Stats row (true today or promised):**
| Number | Label |
|---|---|
| 86 | hands-on lessons |
| 15 | modules, from SUM to INDEX/MATCH |
| 4 | real-data projects *(coming)* |
| 1 | certificate anyone can verify *(coming)* |

---

## 2. See it before you believe it

**Heading:** Try one lesson. Then decide.

**Visual:** a real clip or three stills: task, formula typed into the grid, green tick with a one-line reason.
No mock-ups.

**Caption:**
> This is the whole product. A task, a real grid, your formula, an instant check. If it's wrong, you're told why.

---

## 3. Why videos alone don't work (new, answers the YouTube objection)

**Heading:** You've watched the videos. Can you do it without them?

> Watching someone use VLOOKUP feels like learning it. Then you open a blank sheet and it's gone.
> Here you type the formula yourself, every time, and you're told at once if it's right. That is the part
> videos can't give you, and it's the part that sticks.

*Tone check:* respectful of free resources. We don't attack YouTube; we say what we add.

---

## 4. How it works

**Heading:** Three steps in every lesson

1. **Get a small task.** One idea at a time, with data you can check in your head.
2. **Type the formula yourself.** In a real spreadsheet, in your browser.
3. **See if it's right, and why.** A plain-English explanation, not just a red cross.

*[TESTIMONIAL slot here. Empty until a real one exists.]*

---

## 5. What you'll be able to do (framed for work and interviews)

**Heading:** The Excel that gets asked, and used

Same module table as draft 1, section 4 (SUM to Combined). Add one framing line above it:

> These are the skills that come up in tests, interviews and the first month of a job.

*Check:* this is a claim about the curriculum, not about outcomes. It is safe if the owner agrees the modules
(lookups, IF, dates, text clean-up) are the commonly asked ones.

**Link under the grid:** `Read the free Excel function guides →` (`/learn`)

---

## 6. Who it's for

**Heading:** Made for students, job seekers and anyone new to office work

> Starting from zero? Lesson one begins with a single sum. Preparing for placements or an interview? You'll
> practise the formulas people ask about. Just started a job and bluffing a little in meetings? Lesson by lesson,
> you stop bluffing.

*Why:* "bluffing" names the real, unspoken feeling without shaming it. Soften if it reads too sharp for you.

---

## 7. Pricing

**Heading:** Start free. Pay only when you want everything.

**Intro line:**
> The first lessons are free, with no card. Premium opens every lesson and, as they launch, the projects, the
> daily challenge and your certificate.

**Annual (first, highlighted, "Best value"):**
> {annual} a year. That's {per_month} a month, about {per_day} a day. Save {saving}% against monthly.

**Monthly:**
> {monthly} a month. Stop any time.

**Under both (guarantee, same words as the pricing page):**
> Cancel any time · full refund if unhappy

**Payment line** *(only if UPI is confirmed on):*
> Pay by UPI, card or net banking.

**Premium includes:**
- Every lesson, all 86
- Four real-data projects *(coming)*
- Daily challenge and leaderboards *(coming)*
- A certificate with a public link a recruiter can check *(coming)*

**Button:** `Start free`

*Do not add:* any price comparison to coaching classes or courses unless you give me a real, checkable figure.
*Note:* leave AI explanations off this list unless the Gemini key is set.

---

## 8. FAQ (the objections an Indian buyer actually has, first)

**Why pay when there's free stuff on YouTube?**
> Free videos are good for seeing a formula once. They can't make you type it or tell you what you got wrong. Try
> the first lesson free and judge for yourself.

**Do I need a card to start?**
> No. The first lesson needs no sign-up and no card. You only pay if you choose to upgrade.

**What if I pay and it's not for me?**
> Cancel whenever you like. If you're not happy, you get a full refund.

**Will I be able to cancel easily?**
> Yes. You keep access until the end of the period you paid for, and nothing renews without you being able to stop it.
> *(Confirm the cancel flow matches this before publishing.)*

**I'm a complete beginner. Will I keep up?**
> Yes. Lesson one is a single sum. Each lesson adds one idea, and you move on only when you've done it.

**Can I learn on my phone?**
> Yes. Lessons run in your browser on a phone or laptop. Nothing to install.
> *(The roadmap lists real-phone testing as still open (O4). Don't ship this line until that passes.)*

**Do I need Excel installed?**
> No.

**Will it help with Google Sheets too?**
> Almost every formula you learn works the same way in Google Sheets.

**Do I get a certificate?**
> Premium members who finish every lesson will get one, with a public link anyone can verify. It is launching
> soon.

---

## 9. Closing

**Heading:** Your first formula is two minutes away.
*(Time the intro lesson. If it isn't true, use "one click away".)*

> Type one formula. See it checked. Then decide if this is for you.

**Button:** `Start the first lesson — free`

**Line under:** No sign-up. No card. Works on your phone.

---

## Optional Hinglish microcopy (not built in; your call)
Only under the main button, in Roman script, if you want warmth for a Tier 2/3 audience:
> Pehla formula khud type karo. Sahi hai ya galat, turant pata chalega.

I'd test this as a variant rather than ship it by default. A wrong register reads as trying too hard.

## What changed against draft 1, in one list
- New headline built on identity and outcome; draft 1's mechanic headline kept as the A/B control.
- Risk reversal (no sign-up, no card, refund) moved to the first screen and repeated.
- New section 3 for the "I already have YouTube" objection.
- Work and interview framing added to the module list and "who it's for".
- Pricing shows per-month and per-day; payment-method line added (if UPI is on).
- FAQ reordered so money and trust objections come first.
- Everything not live yet is marked "coming", as in draft 1. No invented testimonials, counts or urgency.

## How we judge it
Once analytics is on: click-through on the main button, share who finish lesson one, and headline A/B
(identity headline vs. the draft 1 mechanic). Change one thing at a time.
