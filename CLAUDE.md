# Excel Guru
Interactive Excel lessons. Full spec: docs/SPEC.md — read the section your task card names before coding.

## Commands
- pnpm dev                run the app
- pnpm test               unit tests (vitest)
- pnpm typecheck          tsc across all workspaces
- pnpm validate-content   runs every lesson solution through the engine

## Rules
- Work only on the task card you were given (docs/tasks/). Touch only the files it lists.
- packages/engine and packages/grader: write tests first; pure TypeScript, no DOM or Node APIs.
- Lesson schema, API contracts and the PaymentProvider interface are frozen. Propose a change; don't make it.
- Never call Gemini, Razorpay or Stripe from client code. Secrets only via process.env on the server.
- Never read or print .env.local. Env var names are in .env.example.
- Prices come only from apps/web/lib/plans.ts.
- docs/teardown.md is the product we mirror: copy its mechanics, never its text, data or branding.
- Done = typecheck, test and validate-content all pass. Paste the output as evidence.
