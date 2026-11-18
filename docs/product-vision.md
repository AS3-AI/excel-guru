# Excel Guru — Product Vision

_Last updated: 18 Nov 2026 · Owner: Sukaran_

## 1. What it is

Excel Guru teaches Excel by doing, not watching. Every lesson runs inside a real, working spreadsheet in the
browser: the learner types a formula, the sheet recalculates instantly, and the answer is graded on its
**result** (so `=SUM(B2:B4)` and `=B2+B3+B4` both count). Short, bite-sized lessons build from the first
formula to lookups, dynamic arrays and keyboard shortcuts.

**Vision:** the fastest way for anyone to go from "I avoid spreadsheets" to "I'm the Excel person on my team" —
and, later, to pass the Excel test in a job interview.

## 2. Target customer (ICP)

**Primary — early-career job seekers and students in India (18–28)**
- Commerce, BBA/MBA, engineering and finance students; freshers applying for analyst, operations, finance and
  MIS roles where an Excel test is part of hiring.
- Pain: YouTube tutorials are passive; they "know" VLOOKUP but freeze when asked to use it.
- Pays with UPI; price-sensitive, so a monthly plan (₹499) and a cheap annual plan (₹1,499).

**Secondary — working professionals who use Excel daily**
- Analysts, accountants, sales/ops coordinators who want to be faster (shortcuts, lookups, dynamic arrays).
- Values: speed, a certificate to show a manager, learning in 5-minute chunks.

**Later — institutions**
- Colleges and training companies buying seats for a batch (group admin, institutional email domains).

## 3. Features

| Area | Feature | Status |
|---|---|---|
| Simulator | In-browser grid with formula bar, point mode, coloured references, whole row/column refs | ✅ Live |
| Engine | Own formula parser + evaluator, dependency recalculation, Excel errors, dynamic arrays (spill), dates | ✅ Live |
| Lessons | 86 lessons across 16 modules (SUM, COUNT, Logical, Lookup, Index Match, Text, Statistical, Dates, Arrays, Shortcuts, Tables…) | ✅ Live |
| Step types | Formula, select-a-range, keyboard shortcut (Win/Mac), multiple choice | ✅ Live |
| Grading | Same grader in browser (instant) and on server (trusted, re-grades before awarding points) | ✅ Live |
| Progress | Saved per user; signed-out progress kept locally and merged on sign-up | ✅ Live |
| Engagement | Points, daily streaks, daily leaderboards, LinkedIn share bonus | ✅ Live |
| Help | Video per lesson, downloadable .xlsx practice workbook | ✅ Live |
| AI help | AI explanation of a wrong answer, cached, 👍/👎 rating | 🟡 Built, switched off |
| Payments | Free tier (2 lessons) + paywall; Razorpay monthly/annual (INR) | 🟡 Test mode |
| SEO | `/learn/<function>` articles, help, terms, privacy, sitemap | ✅ Live |
| Certificates, daily challenge, review mode, projects, profile, group admin | — | ⬜ After launch |
| Stripe / USD pricing | — | ⬜ Deferred |

## 4. User flow

1. **Land** on the homepage → see a live spreadsheet demo → "Try your first lesson".
2. **Intro lesson without signing up** — type a first formula, get "Correct! +10 pts" instantly.
3. **Sign up** (Google or email) → onboarding → local progress is merged into the account.
4. **Dashboard** — lessons completed, next recommended lesson, today's top scores and streaks, module cards.
5. **Play a lesson** — Check / Show answer / Skip; finish → celebration with points, streak, accuracy → auto-advance.
6. **Paywall** — opening the 3rd lesson without premium redirects to `/pricing`.
7. **Pay** (Razorpay / UPI) → premium unlocks all modules.
8. **Come back daily** — streaks and leaderboards reset at midnight IST.
9. *(Later)* finish all lessons → verifiable certificate → share on LinkedIn.

## 5. Current progress

| Stage | Goal | Status |
|---|---|---|
| 1. Foundations & simulator | Sign in and play one lesson end to end in a real grid | ✅ Done (12–13 Nov) |
| 2. Learning loop | Every step type graded, progress saved, dashboard, first half of curriculum | ✅ Done (16 Nov) |
| 3. Engagement & money | Points, streaks, leaderboards, AI help, video, payments, all 86 lessons | ✅ Done — one payment bug open |
| 4. Certificates, daily challenge, projects | Reasons to finish and return | ⬜ Not started (post-launch) |
| 5. Harden & launch | Security pass, SEO, legal, go live | 🟡 In progress |
| 6. Growth content | ~45 more SEO / exam-prep / shortcut pages | ⬜ After launch |
| 7. SQL track | Same engine idea applied to SQL | ⬜ After launch |

**Before public launch:** fill legal placeholders · fix "Manage / cancel subscription" bug · turn email
confirmation back on · switch Razorpay to live keys and test a real ₹499 purchase + refund · "Start free" on
landing + email waitlist · cross-browser and phone play-through · launch posts and first 10 beta users.

## 6. Success metrics (first 90 days)

- Visitor → intro-lesson completion rate
- Sign-up → 2nd lesson completion (activation)
- Free → paid conversion at the paywall
- 7-day streak retention
- Paying users and monthly revenue
