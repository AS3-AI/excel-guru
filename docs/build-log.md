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
| T17 Shortcut steps | — | — | — | queued | after T16 |
| T19 Progress API | codex | a9f9205 | passed (3 rounds), live-tested on Supabase | pushed | replay rule A; race + A/B cycle farming bounded (~2–4×/day) |
| T20 Dashboard + access | — | — | — | queued | after T19 |
