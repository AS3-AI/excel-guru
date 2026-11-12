---
name: new-lesson
description: Write or fix a lesson JSON file in content/lessons following the schema in docs/SPEC.md
---
1. Read the "Data model and lesson schema" section of docs/SPEC.md and one gold lesson in content/lessons/sum/.
2. Write content/lessons/<module>/<id>.json.
3. Every formula step needs grid, targetCell, expectedValue, mustUse, solution and explain.
4. Avoid browser-reserved shortcuts (Ctrl/Cmd + W, T, N, Q, Tab).
5. Run pnpm validate-content and fix until it passes.
