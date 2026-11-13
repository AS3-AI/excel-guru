---
name: new-lesson
description: Write or fix a lesson JSON file in content/lessons following the schema in docs/SPEC.md
---
1. Read "Lesson schema v2" in docs/SPEC.md and one gold lesson in content/lessons/sum/.
2. Write content/lessons/<module>/<id>.json.
3. Use schema v2 (Product spec §5). Every formula step needs grid, targetCell, expectedValue, mustUse, solution and explain. Write all text yourself; never copy wording from docs/teardown.md.
4. Avoid browser-reserved shortcuts (Ctrl/Cmd + W, T, N, Q, Tab).
5. Run pnpm validate-content and fix until it passes.
