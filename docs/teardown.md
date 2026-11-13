# ExcelExercises.com — Product Teardown

Captured 2026-11-12, signed out, desktop at 1440px. Sources:

- **Static analysis** of the served HTML/JS: `levelInfo.js`, `practice.html`, `answerListeners.js`, `incorrectAnswer.js`, `checkPremium.js`, `sqlLevelInfo.js`, `sitemap.xml`.
- **Runtime capture** with REA (`rea inspect-web-page`, `rea capture-web-screenshot`) attached over CDP to an isolated headless Chrome.
- **Scripted interaction** over CDP to record the correct and incorrect answer states. Firestore and Cloud Functions requests were blocked before the wrong answers, so no test data reached their backend.

Screenshots are in `teardown-shots/`.

> **Clone boundary.** Copy the mechanics, flows, information architecture and gamification model; those are what this document is for. Do **not** copy their lesson prose, question text, datasets, testimonials, logo, brand name, or "Jake" founder story. Write our own lesson content (Excel Guru already plans this as lesson JSON). The curriculum below lists topics, which are generic Excel knowledge, not their text.

---

## 1. Product in one paragraph

A browser-based, gamified Excel trainer. Each lesson is a short run of "screens" (questions). On each screen the learner either types a formula into a mini spreadsheet, presses a keyboard shortcut, or selects a cell or range. Feedback is instant. A correct answer earns random points and advances the progress bar; a wrong answer opens a side drawer with the solution and an AI "Formula Assistant" explanation. The learner reaches 100% after about 5 correct answers (signed out) or 7 (signed in), and the lesson completes. Daily points, streaks and public leaderboards drive retention. A certificate is issued when every lesson is complete. Two lessons are free; after that there's a hard paywall (annual, monthly, or lifetime). A secondary SQL track reuses the same shell.

## 2. Tech stack (observed)

| Layer | What they use | Notes for our clone |
|---|---|---|
| Hosting | Firebase Hosting, static multi-page `.html` (Firebase default 404 page) | We use Next.js (apps/web) |
| UI | jQuery 3, Bootstrap 4, W3.CSS fragments, Font Awesome 4/6, Montserrat | Plain modern CSS/Tailwind |
| Spreadsheet grid | **Univer 0.25.1** (`@univerjs/presets`, `preset-sheets-core`) loaded on demand from unpkg (~10 MB, React 18 + RxJS UMD), switched on per question by `sheet: true`. Legacy path: a hand-built HTML `<table>` plus a separate formula text box | We have our own engine (packages/engine) and grid. Their whole "point mode" layer (see §6.3) is worth copying |
| Data | Firestore v8 SDK straight from the client: `problemSets/ps{N}/screens/screen{M}`, `users/{email}`, `activity`, `scores`, `incorrectAnswers`, `incorrectShortcutAnswers` | We keep lessons as JSON in the repo and grade on the server (SPEC §2) |
| Auth | Firebase Auth, with email/password and Google (`apis.google.com/js/platform.js`) | Supabase auth |
| Payments | Stripe through the Firebase "Run Payments with Stripe" extension (`customers/{uid}/subscriptions`, `customers/{uid}/payments`) | PaymentProvider interface |
| AI tutor | Client writes a wrong answer to `incorrectAnswers`; a backend trigger fills `assistantResponse`; the client listens with `onSnapshot` | Server-side Gemini call (never from the client) |
| Points animation | odometer.js | Any count-up |
| Analytics/ads | Microsoft UET (`_uetsid`), Google Ads (`_gcl_ls`), Facebook Pixel and SDK, Microsoft Clarity (`_cltk`), LinkedIn Insight on SQL pages | Choose our own |

**Weaknesses to beat:**

1. **Grading and premium checks run entirely on the client.** Answers are stored as plain lists in public Firestore docs. Premium is decided in browser JS from a hard-coded allowlist of institutional email domains plus Stripe docs. Points are written straight from the client to `users` and `scores`. All of it can be spoofed. Our SPEC already re-grades on the server.
2. **The formula path matches strings.** Accepted answers are a list of lower-cased, whitespace-stripped strings. Univer questions can also use `contains` plus the computed result.
3. **Error handling uses `alert()`.** The dialogs read "contact jake@…".
4. **The 10 MB grid bundle is lazy-loaded** on the first formula question.

## 3. Sitemap and pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Marketing landing page | public |
| `/lessons.html` | **Dashboard**: progress, next recommended lesson, leaderboards, projects, module grid | public (signed out shows 0/85) |
| `/{module}-lessons.html` ×15 | Module page: title, "x/N Lessons Completed", numbered lesson list | public |
| `/practice.html?lesson=N` | **Practice player** (the core product) | lessons 1–2 free; others need an account and then premium |
| `/register.html?completed=N` | Sign-up (reached after a signed-out learner finishes a lesson) | – |
| `/login.html` | Log in | – |
| `/populate-profile.html` | Profile onboarding for an authenticated user with no Firestore doc | auth |
| `/premium.html` | Paywall and pricing | – |
| `/flashcard-mode.html` | Endless shuffled review cards plus "Suggested Practice" (§5.9) | auth (redirects to login) |
| `/profile.html` | Account, progress, LinkedIn URL, certificate, projects, subscription, delete account | auth |
| `/daily-challenge.html` | Daily timed challenge plus worldwide leaderboard | public, scores need auth |
| `/admin-portal.html` | Group admin: learner activity grid, invites | group admin |
| `/certification.html` | Certificate search/verify by name or ID | public |
| `/wine-dashboard.html`, trout, UFO, interview assessment | Project pages: description, "Skills to know" links, "View completed project", Start | premium (trout is free) |
| `/excel-functions.html` + `/excel-functions/*.html` (~45) | SEO blog: one article per function, each with a sticky footer CTA "Continue to X practice exercises →" | public |
| `/excel-shortcuts/*.html` | SEO shortcut articles | public |
| `/excel-functions/mo-200…`, `mo-201…`, `indeed-excel-assessment-practice` | SEO pages targeting certification and job-test queries | public |
| `/sql.html`, `/sql-lessons.html`, `/sql-{module}-lessons.html` ×6, `/sql-practice.html?lesson=N` (23) | SQL track, same shell, purple accent | same model |
| `/terms.html`, `/privacy.html`, `/sitemap.xml` | Legal and SEO | public |

Navigation: the top nav has logo, Dashboard, Flashcard Mode, Blog, an "Excel ▾" track switcher (Excel/SQL), and Log In / Sign Up. Practice and module pages drop the nav and use a breadcrumb bar instead (`Dashboard > Module > Lesson`), navy on practice pages.

## 4. User flows

### 4.1 First visit to first lesson (signed out)
1. The landing page CTA "Start Learning for Free" (subtext "No sign up necessary") goes to `practice.html?lesson=89` ("Intro to Excel").
2. The player loads without an account. Points accrue and the sidebar box reads "You won't appear on the leaderboard until you log in or create an account".
3. Each correct answer adds 20% (signed out), so 5 correct answers complete the lesson.
4. On completion: redirect to `register.html?completed=89`. **The sign-up wall sits after the first win, not before it.**

### 4.2 Registration
- Form fields: First Name, Username, Email, Confirm Email, Password (plus Google sign-in). The right column shows 5-star testimonial cards.
- Copy angle: "Create a free profile to save your progress! … you need a profile to progress to more advanced lessons."
- After sign-up, if the user doc is missing, the user goes to `populate-profile.html`. The new user doc starts with `myCompletedLessons: [1]`, `level`, `streak`, `pointsDate`, `userPoints`, `startDate`, plus optional `groupId`, `cohort` and `linkedinUrl`.

### 4.3 Returning learner
- Dashboard, then "Next recommended lesson" (the first lesson in `recommendedLessonOrder` not yet completed), then practice, then completion. Completion writes `activity` and `users.myCompletedLessons`, then `scores` (the daily leaderboard), then **auto-redirects to the next recommended lesson**. There's no completion screen; the user lands straight in the next lesson.
- Once everything is done, the user goes to `flashcard-mode.html`.

### 4.4 Paywall
- `numberOfFreeLessons = 2`. The current lesson is added to the completed list *before* the check, so **opening a 3rd lesson** while not premium gives a **hard redirect to `/premium.html`**. Intro counts toward the 2; this was verified live (§5.10).
- If free lessons remain, the user is let through (a "soft paywall" that's only logged).
- Premium if any of: the email matches the institutional domain allowlist (schools and companies with group deals), an active Stripe subscription exists, or a non-refunded "Lifetime" payment exists.

### 4.5 Daily loop (points and streak)
- Points reset daily. The `pointsDate` field is compared with today:
  - same day: keep the points;
  - yesterday: `streak + 1`;
  - older: `streak = 1`.
- The streak box copy depends on state: "Complete a lesson today to start your streak!", "…to reach N days!", or "Complete a lesson tomorrow to increase your streak!".

### 4.6 Certificate
- Earned when every lesson is done; generated from the dashboard. It's shareable to LinkedIn ("Licenses & certifications"), social and email, and exportable as PDF.
- `/certification.html` is a public verification page with a single search box (name or certificate ID).

## 5. Page-by-page UI

**Design tokens:**

| Token | Value | Use |
|---|---|---|
| Primary green | `#29b277` | Buttons, headings |
| Green hover/dark | `#1f9463` | |
| Navy | `#193656` | Headline text, breadcrumb bar, correct-answer footer |
| Cream background | `#fdf5e6` | Landing, practice and register pages |
| Orange | `#faa434` / `#ff9800` | Incorrect drawer header |
| Red | `#da2c38` | Low-accuracy tag |
| Light grey | `#f8f9fa` / `#f1f1f1` | Surfaces |
| Body text | `#484848` | |
| SQL accent | purple ≈ `#635bff` | Whole SQL track |

Font: Montserrat throughout. Buttons are pill-shaped with a darker bottom border, which gives a "pressable" 3D look. Cards have a 4px green left border.

### 5.1 Landing (`01-landing.png`)
Sections, top to bottom:
1. Hero: H1 "…helps regular people learn **Excel** as quickly as possible." with the key word highlighted green, a sub-line, a large green CTA, and a check-mark row of topics.
2. Navy stats bar: "250,000+ registered users | 50+ partner organizations".
3. Logo strip of partner organizations.
4. "What people are saying" testimonials.
5. Benefit sections: fun/gamified; practice for busy people; solves the "boring video" problem; career boost; hands-on; beginners to experts.
6. Repeated "Get Started for Free!" CTAs.
7. Footer: social links, Learn SQL, Certification, Blog, Terms, Privacy, Sitemap.

### 5.2 Dashboard `/lessons.html` (`02-dashboard.png`)
- H1 "Become the Excel Master of Your Office".
- **Total Lessons Completed** card: "0 / 85" with a segmented progress bar. Each segment is colour-coded by its legend: **Low Accuracy** (red), **Needs Practice (≥14 days)** (yellow), **Good (<14 days)** (green). This is spaced-repetition status per lesson. Under it: "Get a certificate of completion upon completion of all lessons".
- A row of 3 cards:
  - **Next Recommended Lesson** (big green button);
  - **Today's High Scores 📈** (top 3, plus "My Points Today");
  - **Today's High Streaks 🔥** (top 3, plus "My Streak Today").
- **Projects** row: 4 cards with emoji, one-liner, and a "PREMIUM" badge (Trout is free).
- **Lessons** grid: 15 module cards (title plus the functions covered, see §7).
- Footer.

### 5.3 Module page (`03-module-page.png`)
Breadcrumb, H2 module name, "0/9 Lessons Completed", and a numbered list group of lessons. Lessons not yet completed are greyed. Clicking one opens `practice.html?lesson=N`.

### 5.4 Practice player (`04`–`07`), the core screen
Three-column layout on the cream background:

- **Left sidebar** (green left border): the full lesson list in recommended order, numbered. The current lesson carries a grey "IN PROGRESS" pill. Clicking a lesson jumps to it.
- **Centre:**
  - lesson title (navy);
  - a "0%" label with a green progress bar;
  - a white card with the question HTML (bold key terms, inline red `code` chips, a bold call to action like "Click on cell B2 to continue.");
  - the spreadsheet (name box with cell ref, ✕ ✓ fx, formula bar, A–G × 1–8 grid).
- **Right sidebar:** Today's High Scores, Today's High Streaks, and share buttons (LinkedIn, Facebook, X, Email). An optional ▶ video button opens a YouTube modal (some lessons have a YouTube ID).
- **Sticky footer bar** (`#practiceFooterBar`) changes with state:
  - *Idle:* grey footer with a "Skip Question" outline pill (and a "Previous" button when allowed).
  - *Formula, classic mode:* a "Check Answer" button, with "or press Enter" hint text.
  - *Correct* (`05`): the footer turns **navy**, shows **"Correct!" in green**, "+N pts" (odometer count-up), and a big green **"Continue →"** button with "or press enter". The question's explanation is revealed and the right-hand "My Points Today" updates live.
  - *Incorrect* (`06`): a **right-hand drawer slides in** with an orange header "Incorrect (n)" and ×. It has a "Show Answer" button (reveals "SOLUTION: `=…`") and a **"✨ Formula Assistant"** section that shows typing dots and then the AI explanation, with 👍/👎 rating and a "Thanks" confirmation. On wide screens the drawer is aligned to the question card.
- **Shortcut screens** (`07`): no formula bar. A static screenshot of the Excel ribbon swaps image per keystroke (`excelImages/*.png`). Key-chip hints show "Hold ⌘ + Shift, press ↓". There's a yellow "Mobile device detected — Skip section" banner on touch devices and a Mac skip bar when a Windows-only shortcut has no Mac variant.
- A loading spinner shows until the first screen loads. A connection banner appears on Firestore failure, with automatic retry.

### 5.5 Register (`08`), Login, Premium (`09`)
- **Register:** two columns (form card | testimonial cards).
- **Premium:**
  - H1 "Upgrade to Continue Learning", 3 check bullets (all lessons; data files and interview assessments; LinkedIn certificate), 2 proof images, emailed-testimonial screenshots.
  - Right: a sticky pricing card "One plan with everything included" with radio options:
    - **Annual $59.99/yr (shown as $4.99/mo)**, badge "Most Popular — Save 75%";
    - **Lifetime $199 one-time**;
    - **Monthly $19.99/mo**.
  - Green "Upgrade" button, "Cancel any time · 100% refund if you're unhappy".
  - (For us, prices come from `apps/web/lib/plans.ts`.)

### 5.6 Projects (`11`)
Breadcrumb, title with emoji, "View Completed Project" link to a read-only OneDrive embed, a description, "Skills to Know" links to SEO articles, and a "Start Project" button. Project screens use question type `e`: a downloadable `.xlsx`, an OneDrive-embedded workbook, and a typed answer.

### 5.7 SEO articles (`13`)
Long-form article (syntax, argument list, examples with images) with a **sticky bottom CTA "Continue to VLOOKUP practice exercises →"** that deep-links to the matching practice lesson. This is their main acquisition channel.

### 5.8 SQL track (`12`)
Same player; purple accent; a textarea instead of a grid; a "Check Answer" button; a "Skip this question" outline button; its own leaderboards. Grading is a normalized string match of the SQL statement (whitespace collapsed, lowercase). No live DB was observed in the client.

### 5.9 Signed-in experience (free account; captured in the user's own logged-in Chrome)

**Dashboard, signed in** (`14`)
- The top nav swaps Log In/Sign Up for an **"Account ▾"** menu with Profile, Get Help and Log Out. The "Excel ▾" track switcher stays.
- The High Scores card gains a promo: "Earn points *and* help your colleagues learn Excel! Share on LinkedIn for **500 extra points**", with a SHARE button. Clicking it sets `users.sharedOnLinkedin = true`, adds +500, and opens the LinkedIn share URL. It's a one-time offer.
- Each module card gets a thin progress bar.
- Elements that are hidden until relevant:
  - **"Go to Admin Portal"** button, only for group admins;
  - **"Generate Certificate of Completion"** button, which replaces "Next recommended lesson" once everything is done;
  - **Reset Progress** link and modal ("All completed lessons will be deleted…"), which sets `myCompletedLessons: []`;
  - a **Daily Challenge accuracy chart**: Chart.js line chart of the last 7 days' accuracy %, green fill, y-axis 0–100, gaps spanned; empty state "No daily challenge scores in the last 7 days." with a "Today's daily challenge" CTA.
- **Project cards open a modal** with a screenshot of the finished workbook, a one-paragraph description, and a gate box. Signed out, it reads "Sign in or create an account" (Sign In / Create Account). Signed in but free, it reads "Upgrade to continue" with an **Upgrade to Premium** button (`17`). Premium users get "Start Project". Trout is ungated.
- The total shows "0 / 83" while profile shows "0/85": two different counts, a small inconsistency.

**Profile `/profile.html`** (`16`)
- Layout: green gradient page with a single white column of cards, a "Hey, {name}" greeting, and a minimal nav (Practice, Blog).
- Cards, in order:
  1. **Account Details:** email, username, member since, last active.
  2. **Lesson Progress:** "0/85" bar plus an outlined orange "Reset Progress" button.
  3. **SQL Lesson Progress:** purple, "0/23", "Go to SQL Lessons →".
  4. **Leaderboard Options:** LinkedIn profile URL field and Save; the URL is shown on leaderboards.
  5. **Certificate of Completion:** a disabled "Generate Certificate" button until all lessons are done, "Complete all lessons to unlock", and "View existing certificate →".
  6. **Excel Projects:** a thumbnail list (Trout; UFO, Wine and Job Interview Prep each with a Premium pill), each with a "View Project →" button.
  7. **Subscription:** Access Level "Standard", "Upgrade to Premium". Premium users get a Stripe customer-portal button (`goToPortal()`).
  8. **Delete Account:** a two-step confirm. It re-authenticates if the last sign-in isn't recent, then deletes the user doc and the auth user.

**Certificate generation**
- A modal asks for the name twice ("Your name cannot be changed after the certificate is generated"), checks the two match, then writes `certifications/{autoId} {name, nameLower, date, id: userId}`.
- A **backend trigger renders the PDF** and writes `pdfUrl`. The client waits on `onSnapshot`, then redirects to `certification.html?id={userId}`.
- If a certificate with a `pdfUrl` already exists, the user is redirected straight there.
- Verification searches by name (`nameLower`) or ID.

**Flashcard Mode `/flashcard-mode.html`** (`15`), free for signed-in users
- It reuses the practice player layout.
- Left: **"📋 Suggested Practice — based on your last 30 days"**: lessons ranked by how many flashcards you missed, each with an "N missed" badge and a link back to the lesson.
- Questions come from a separate `challengeQuestions` pool. They're shuffled, drawn without repeats until the pool is used up, and endless.
- Card types are the same as in lessons: a formula typed into an "Answer Goes Here" field over a static grid, or shortcuts.
- Wrong answers are logged to `incorrectChallengeAnswers {userId, ps, date}`, which feeds Suggested Practice.
- Points sync to the daily leaderboard every 60 seconds and on page unload.

**Daily Challenge `/daily-challenge.html`**
- One challenge per day, stored in `challenges` keyed by `date: YYYYMMDD`.
- The page shows the date, **"Today's Topics"** pills that link to the related lessons, and a "Start Challenge" button.
- A **Worldwide Leaderboard** card ranks players, with gold, silver and bronze rank colours.
- The completion panel shows **Accuracy, Time (mm:ss.ms) and Global Rank**, then "Come back tomorrow for another challenge", plus share buttons (Facebook, LinkedIn, X, email, copy link).
- Scores are stored in `challenges/{id}/scores/{userId} {accuracy, time}`.
- No challenge was posted on the capture day, so the questions themselves weren't seen. This matches our SPEC's `mcq` step type and `daily_challenge_scores` table.

**Admin Portal `/admin-portal.html`**, for B2B/teacher users (`users.admin = groupId`)
- Controls: Term Start Date, "Days of history to show" (default 14; more than 30 days groups by month), and Update View.
- A note explains that accuracy means first-try correctness, and that low accuracy may mean the learner leans on the formula assistant.
- Learner table columns: Username (with first name), User ID, Total Completed, Accuracy, then one column per day (Today, Yesterday, Mon 11/10…) or per month showing the lessons completed.
- **Invite Users:** paste emails separated by commas or newlines, then Send Invites. This writes `groups/{groupId}/invitations/{email} {date_invited, invited_by, groupId, cohort: 1}`. An invitations table lists their status.
- Activity data comes from `activity` filtered by `groupId`. Every lesson completion carries `groupId` and `cohort` for exactly this view.

**Get Help:** an Account-menu item (contact form or mailto).

### 5.10 Completion and paywall, verified live on the user's account (`18`–`23`)

The run completed **Intro to Excel (89)** and **Cell Selection Shortcuts (5)**, then opened **COUNT Function (25)**.

**Lesson length**
- Signed in, each correct answer adds +15%. Intro reached 100% after **7 answers**, and so did lesson 5.
- At 100% the footer stays navy, showing "Correct! +N pts", Continue, and "or press enter" (`18`).

**Completion**
- Pressing Continue at 100% saves the activity and the completed lesson, then the points.
- It then **redirects straight into the next recommended lesson** (`19`). There's no summary screen.
- In the sidebar the finished lesson's pill turns green: **"COMPLETE"**. The new lesson shows "IN PROGRESS".
- My Points Today jumped to 2047 after the 7 Intro answers (the code's random 1–5 × 89 per answer). **My Streak Today** became 1, with "Complete a lesson tomorrow to increase your streak!".

**Hold-down question UI** (`19`)
- Prompt text, then **key-chip hint** ("Shift" + "→") above a static grid. The target cell ("Select me") is pre-filled, and there's no formula bar.
- Recorded data: `hold1:"Shift", hold2:"nil", push:39` (a keyCode). The Mac variants (`Meta` = ⌘) were applied automatically, e.g. "Hold ⌘ and Shift and press ➡" = `Meta+Shift+39`.
- Lesson 5's seven screens were all hold-downs: Shift+→, ⌘+→ ×2, ⌘+Shift+→, Shift+↓, ⌘+Shift+→, ⌘+Shift+↓. This is the "introduce, repeat, combine" pattern.

**AI Formula Assistant, a real response** (`20`)
- A wrong key press (a synthetic event that didn't register as a held Shift) opened the orange "Incorrect (1)" drawer.
- In order, it contained: a "Show Answer" pill, then the "✨ Formula Assistant" bar, then a chat-bubble explanation. The explanation was tailored to the mistake: pressing only → moves the active cell instead of extending the selection. It even explained where Shift sits on a Mac keyboard.
- Below that: "Helpful 👍" / "Not helpful 👎", and the disclaimer "Formula Assistant uses AI and may not always be correct. See our blog articles for reference."
- It appeared instantly, so it was a **cached response** for this (lesson, question, wrong answer).

**Hard paywall, the exact rule**
- After only 2 completions (`myCompletedLessons = [89, 5]`), opening lesson 25 **redirected instantly to `/premium.html`** (`21`). There was no modal or warning, and the user never saw the lesson.
- Cause: on load the practice page calls `recommendNextLesson()`, which pushes the *current* lesson into the in-memory completed list **before** checking `length > numberOfFreeLessons (2)`.
- **Net rule: a free account gets exactly 2 lessons, and the Intro lesson counts as one of them.** (The `isIntro` exemption only lets you replay the intro itself.)

**Dashboard after the 2 completions** (`22`, `23`)
- "1 / 83": Intro (89) isn't in any module, so it isn't counted.
- The total bar shows a small green "Good" segment. Next recommended lesson: COUNT Function → (which leads straight to the paywall).
- **Module cards show a thin navy progress bar.** Cell Selection Shortcuts shows 1/7 filled.

## 6. Mechanics (exact rules recovered from code)

### 6.1 Lesson and screen model
- Lesson = "problem set" `ps{N}`, holding ordered screens `screen1…screenK`.
- The progress bar is not tied to screen count. Each correct answer adds **+20% signed out, +15% signed in**, capped at 100%; 100% ends the lesson.
- If the learner runs past the last screen, the player **recycles from screen 4**.
- **Skip** adds no progress. **Previous** goes back one screen.

### 6.2 Question types (`type` field)
| type | Name | Input | Graded by |
|---|---|---|---|
| `f` | Formula | Type in the grid (Univer) or the formula field | Classic: normalized string ∈ `solution[]`. Univer: (a) `cell` set → **select that cell, range, column (`B:B`) or row (`3:3`)**; (b) `contains[]` + `result` → the typed text contains every token **and** the computed value equals `result` (numeric or case-insensitive compare, waits up to 2s for recalculation); (c) otherwise string match at `activeCell` |
| `s` | Shortcut sequence | Sequential key presses (e.g. Alt, H, …) | Each `event.key` must equal `solution[i]` in order; ribbon picture `pics[i+1]` swaps per correct key |
| `h` | Hold-down shortcut | Chord: hold `hold1` (+ `hold2`), press `push` | Key matcher handles Left/Right modifiers. Mac variants `titleMac`, `solutionMac`, `correctAnswerMac`. Optional `postcondition` grid shows the result (e.g. a selection highlight) |
| `p` | Picture | Image plus text answer | String match |
| `e` | Embed/project | Downloadable file plus OneDrive iframe on screen1 | String match |

Common screen fields: `title` (HTML prompt), `correctAnswer` (HTML shown on "Show Answer"), `explanation` (shown after correct), `precondition {rows, columns, values, position, highlightCells}`, `activeCell`, `mobileButtons[]` (tap-to-insert tokens on mobile, e.g. `(`, `,`, `:`), `video`, `sheet` (boolean, use Univer).

Normalization for string matching: smart quotes become straight quotes, all whitespace is stripped, and text is lowercased.

### 6.3 Grid UX details worth copying (the Univer layer)
These are what make it feel like real Excel:
- **Point mode:** while typing a formula, after `(`, `,` or an operator, clicking or dragging a cell, or using arrow keys (Shift+arrow extends), inserts the reference. Further arrows replace the last inserted ref.
- **Coloured reference highlighting:** each reference in the formula gets a colour, and the matching range is outlined in the grid, as in Excel.
- Typing Space after a column letter or row number can insert a whole-column/row reference.
- Trailing spaces are kept in formulas; the selection border is thickened; the editor stays visible while pointing.
- The grid claims keyboard focus on each new screen (Delete clears, Enter commits).
- Grid size is fixed at 7–8 columns × 8 rows. The target cell is highlighted. On a correct answer the result is written into the active cell.

### 6.4 Scoring
- **Points per correct answer = random(1–5) × lessonNumber.** Later-numbered lessons pay more; the intro (89) paid +89. Points only feed the daily leaderboard.
- First-try tracking: each screen logs `{questionStart, questionEnd, allCorrect, question}` to `activity`. This drives the dashboard's **Low Accuracy** tag and a per-lesson accuracy/last-completed badge in the player. Status comes from the most recent `activity` doc for each lesson: **first-try accuracy < 50% means Low Accuracy (red)**; otherwise, **last completion ≥ 14 days ago means Needs Practice (yellow)**; otherwise **Good (green)**. The dashboard's total bar stacks the three counts as segments.
- **Show Answer** is available after the first wrong answer (`incorrectAnswersBeforeShowingSolution = 0`). The code sets a reduced "points if correct" value (15, then 10 on a wrong answer, then 5 after reveal), though progress still uses the flat increment.

### 6.5 AI "Formula Assistant"
1. On a wrong answer, query `incorrectAnswers` where (lesson, question, userAnswer) match, `score >= 0`, ordered by score desc, limit 1.
2. **Cache hit:** show the stored `assistantResponse` immediately.
3. **Miss:** write the doc `{lessonNumber, questionNumber, userAnswer, correctAnswer, values, position, question, isFormulaQuestion, …, score: 0}`. A backend trigger generates the explanation, and the client shows it through `onSnapshot`.
4. 👍/👎 increments or decrements `score`, so explanations rated below 0 are no longer served. A separate `incorrectShortcutAnswers` collection handles wrong shortcut answers.
5. **Copy this design:** cache explanations by (lesson, step, normalized wrong answer), let users rate them, and retire low-rated ones. It cuts LLM cost sharply. Do it server-side through `/api/…`, per our Gemini rule.

### 6.6 Recommendation and review
- `recommendedLessonOrder` is a fixed global order (below). Next lesson = the first one not yet completed.
- The dashboard colours each completed lesson **red / yellow / green** by accuracy and age (≥14 days since last done = Needs Practice). Flashcard Mode is the review surface.
- Older curated tracks in code: "Essentials" (10 lessons) and "Advanced" orders.

### 6.7 Social and growth
- Share buttons (LinkedIn, Facebook, X, email) on every practice page.
- A LinkedIn URL on the profile is shown on the leaderboard.
- The institutional plan is an email-domain allowlist with `groupId`/`cohort` on users and on activity. That data feeds a teacher/admin view (our SPEC already has groups/admin portal).
- Sign-up is gated *after* the first completed lesson.

## 7. Curriculum, chapter by chapter

The dashboard says 85 lessons. IDs come from their code and are listed for cross-reference only; use our own IDs. Format: **lesson title** (type mix), shown in recommended order within each module.

| # | Module (dashboard subtitle) | Lessons |
|---|---|---|
| 0 | **Intro Lessons** | Intro to Excel: cells, references, select a cell, first formula `=2+2` |
| 1 | **SUM Functions** (SUM, SUMIF, SUMIFS) | SUM Function · AutoSum · Intro to SUMIF · SUMIF & Sum Range · SUMIFS Function · SUM Functions Skill Summary · SUMIF Practice · SUMIFS Practice · Debugging SUM Functions |
| 2 | **COUNT Functions** (COUNT, COUNTIF, COUNTIFS) | COUNT Function · COUNTIF Function · COUNTIFS Function · COUNT Practice · COUNT Skill Summary · Other Count Functions (COUNTA/COUNTBLANK) · COUNTIF + Wildcards |
| 3 | **Logical Functions** (True/False, AND/OR, IF, IS, IFS, SWITCH) | True & False · AND, OR, XOR · IF Function · IS Functions · IFS Function · SWITCH Function · IF Combinations |
| 4 | **Lookup Functions** (VLOOKUP, HLOOKUP, XLOOKUP) | VLOOKUP · HLOOKUP · VLOOKUP 2 · HLOOKUP 2 · VLOOKUP Practice · XLOOKUP · XLOOKUP 2 · More VLOOKUP Practice · VLOOKUP Approximate Match · XLOOKUP & Wildcards |
| 5 | **Text Search Functions** (LEN, LEFT, RIGHT, MID, FIND, wildcards, SEARCH) | LEN, LEFT, RIGHT · MID · LEN/LEFT/RIGHT/MID Practice · Wildcard Characters · FIND · SEARCH · TEXTBEFORE & TEXTAFTER |
| 6 | **Intro to Shortcuts** | Intro to Shortcuts (Alt key tips) · Text Formatting Shortcuts · Number Formatting Shortcuts · Fill Right & Fill Down · Cut, Copy, Paste · Data Shortcuts |
| 7 | **Cell Selection Shortcuts** | Arrow Keys · Cell Selection Shortcuts · Larger Cell Selections · Row and Column Selections · Cell Selection Shortcuts 2 · Larger Cell Selections 2 · Cell Selection Skill Summary |
| 8 | **Text Manipulation** (CONCAT, TEXTJOIN, UPPER/LOWER/PROPER, SUBSTITUTE) | CONCAT · TEXTJOIN · UPPER, LOWER, PROPER · SUBSTITUTE |
| 9 | **Index Match Lookup** | MATCH · INDEX · INDEX MATCH Lookup · Index Match Skill Summary · INDEX MATCH Practice · MATCH Practice |
| 10 | **Statistical Functions** (AVERAGE, MIN, MAX, LARGE, SMALL, FLOOR, CEILING, MEDIAN, MODE) | AVERAGE · MIN, MAX, LARGE, SMALL · FLOOR & CEILING · MIN/MAX/LARGE/SMALL Practice · ODD and EVEN · MEDIAN · MODE |
| 11 | **Tables** (Filters, Pivot Tables) | Pivot Tables 1 · Pivot Tables 2 · Table Filters · Tables Skill Summary |
| 12 | **Date Functions** (DATE, TODAY, DATEDIF, DAYS) | DATE · TODAY · DATEDIF · DAYS · Date Functions Skill Summary |
| 13 | **Other Excel Skills** | Worksheets · Conditional Formatting |
| 14 | **Array Formulas** (UNIQUE, FILTER, SORT) | UNIQUE · FILTER |
| 15 | **Combined Skills** | Real Estate Analysis · Hospital Administration (multi-function case studies) |
| P | **Projects** | Trout data-model dashboard (free) · Excel Interview Assessment · Wine Dashboard (CONCAT, drop-downs, VLOOKUP, absolute refs, charts) · UFO Dashboard |

**Global recommended order:** Intro → cell selection → COUNT → larger selections → SUM → True/False → IF → number formatting → fill → arrows → AutoSum → SUMIF chain → wildcards → COUNTIF/S → AND/OR, IS, IFS, SWITCH → selection chapter → VLOOKUP/HLOOKUP/XLOOKUP → INDEX/MATCH → text search → shortcuts → stats → dates → text manipulation → tables → misc → advanced practice → arrays → combined. The pattern **interleaves easy shortcut lessons between function lessons** and puts each "Skill Summary" or "Practice" lesson after its concept lessons.

**Lesson-internal pattern** (observed on Intro): concept text with a bold term, then the smallest possible action (click B2), then a guided formula typed exactly as shown, then variations on given data, then an "apply" question. Skill Summary lessons mix every function in the module.

**SQL track (23 lessons, 6 modules):**
- The Basics: What is SQL?, Null Values
- Basic Queries: SELECT, SELECT DISTINCT, ORDER BY, Aliases & Arithmetic, LIMIT
- Filtering: WHERE; AND/OR/NOT; IN & BETWEEN; LIKE & Wildcards; Not Equal To
- Data Modification: INSERT, UPDATE, DELETE
- Joins: Inner Join, and more
- Aggregates: MIN & MAX, COUNT, AVG, and more

## 8. Mapping to Excel Guru (proposals only; the schema is frozen)

Our SPEC already covers formula, shortcut and info steps, server re-grading, points, streaks, certificates, groups, and a merge of signed-out progress. Gaps found in this teardown, as **proposals** to raise rather than make:

1. **`select` step type:** "select cell/range/row/column X". Used heavily in intro and selection lessons, and graded by range equality. It isn't in the current step union.
2. **Chord vs. sequence shortcuts:** they distinguish hold-down chords (`h`) from Alt key-tip sequences (`s`, e.g. Alt→H→…). Our `keys` string handles chords; Alt sequences need an array form.
3. **`contains` + value grading** matches our `mustUse` + `expectedValue`. Good, we already do better than string matching.
4. **Optional `postcondition` grid** for shortcut steps (show the selection or result after success) and **`mobileButtons`** for touch input.
5. **AI explanation cache with ratings** (§6.5). Needs an API route and a table (`ai_explanations`: lesson, step, wrong_input_norm, text, score, count).
6. **Per-lesson review status** (red/yellow/green by accuracy and 14-day age) on the dashboard. `lesson_progress.first_try_correct` already supports it.
7. **No completion screen; auto-advance to the next recommended lesson.** Decide whether to copy this. A brief celebration screen with streak and points is probably better.
8. **SEO article → practice deep-link pages**, one per function. Cheap acquisition that drove their growth.
9. **Projects** (download a workbook, build it, answer check questions) as premium content.
10. **Sign-up wall after the first completed lesson**, not before.
11. **Flashcard mode with "Suggested Practice"**: an endless shuffled pool, with missed questions grouped by lesson and linked back. Cheap to build on our step types and a strong retention loop.
12. **One-time share bonus** (+500 points for a LinkedIn share) and a **LinkedIn URL shown on the leaderboard**.
13. **Admin portal** day-by-day completion grid with first-try accuracy, plus a bulk email invite. This matches our groups/admin SPEC row.
14. **Certificate:** confirm the name twice, render the PDF server-side, publish a public verify page by name or ID.

## 9. Things we observed but did not capture

- Premium-only screens: the inside of projects, the Stripe checkout and customer portal, and lessons past the free limit. The account is "Standard" (free). The hard paywall *was* triggered live (§5.10).
- The red "Low Accuracy" and yellow "Needs Practice" dashboard states. These need lower accuracy or completions at least 14 days old.
- Daily Challenge questions. None was posted on the capture day.
- The Univer `contains`/`result` grading path and how many screens a typical lesson has. Lesson content is stored in Firestore and was deliberately not scraped.
- The backend AI prompt or model. It runs server-side and is invisible to us.
- Mobile layout below 993px. Only the mobile banners were seen in code.
