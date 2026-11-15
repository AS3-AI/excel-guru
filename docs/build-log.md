# Build log

One line per card. Builder: `agent` = Claude subagent, `codex` = Codex CLI (`codex exec`), prompted and reviewed by Claude.
Status: built → reviewed → merged → pushed (live). Checks = typecheck, test, validate-content, web build.

| Card | Builder | Commits | Review | Status | Notes |
|---|---|---|---|---|---|
| T1–T5, T7–T10 | agent | — | passed | pushed | Phase 1 |
| T11 Player polish | agent | a810464, f89c36d | passed | pushed | |
| T12 Engine functions | agent | e701532 | passed | pushed | Excel checks pending: TEXTBEFORE on empty, COUNTIF empty criterion |
| T6 Dynamic arrays | agent | 774fe7e, b383f32 | passed | pushed | grid spill-anchor heuristic can mislabel one layout |
| T13 Element-wise functions | — | — | — | parked | card only |
| T14 Grade spilled answers | — | — | — | parked | card only |
| T15 Grader for every step type | agent | fd7729f, 1165e72 | passed | pushed | |
| T18 Point mode + coloured refs | agent | f34bfb6, 695f534 | passed | pushed | whole-row refs off; iOS pointing untested on a device |
| T21 CI | agent | fde79b9 | — | built | needs a real run on GitHub (2 test branches) |
| T16 Player v1 | codex | 34571cf, 14d0680 | passed (3 rounds) | pushed | grid select mode added; T19 brings real COMPLETE badges |
| T17 Shortcut steps | codex | cb47bc0 | passed (2 rounds), Mac browser-tested | pushed | attempt cap max(200, 25×steps); `[shortcut, shortcut, info]` on touch can't finish |
| T19 Progress API | codex | a9f9205 | passed (3 rounds), live-tested on Supabase | pushed | replay rule A; race + A/B cycle farming bounded (~2–4×/day) |
| T22 Merge race fix | codex | 25c2445 | passed; migration tested on scratch Postgres | pushed | migration 0002 run in Supabase 15 Nov |
| T23 Rich text + module slugs | codex | 105cf3a | checked in Chrome | pushed | |
| Content: SUM module | codex + Claude | sum-1 (Claude), 8c05798 | 3 pedagogy rounds, ready | pushed | style guide docs/content-style.md |
| T20 Dashboard + access | codex | bf568cf | passed (2 rounds) | pushed | progress routes paywall-gated; free users can still *open* extra lessons (migration later); live free-tier flow verified 15 Nov (sign-up → merge → 2nd lesson → 3rd = /pricing, 403 on save) |

## Open bugs
- ~~Merge race~~ fixed by T22 (single-flight + unique index). Was: two concurrent `/api/progress/merge` calls for the same lesson both award points (seen: 90 instead of 45 after sign-up; React StrictMode double-runs the merge effect in dev, and dashboard + player both call it). Fix: single-flight `mergeLocalProgress()` on the client + a DB unique index on (user, lesson, IST day) where points > 0.
- Engine: unquoted text inside SUMIF criteria (`=SUMIF(A2:A5,Hike,B2:B5)`) returns 0; Excel returns `#NAME?` (an error criterion should propagate).
