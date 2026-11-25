import { NextResponse } from "next/server";
import { getLesson } from "../../../lib/lessons";
import { loadLessonAccess } from "../../../lib/access";
import { gradeFormulaStep } from "@excel-guru/grader";
import {
  buildExplainPrompt,
  callerKey,
  countExplainCalls,
  insertExplainCall,
  insertExplainCache,
  isExplainInputWrong,
  istDayStart,
  lookupExplainCache,
  normaliseExplainInput,
  requestGeminiExplanation,
  shouldAllowUncachedCall,
} from "../../../lib/explain";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";

const unavailable = () => NextResponse.json({ error: "ai_unavailable" }, { status: 503 });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { lessonId, stepId, input, os } = body as {
    lessonId?: unknown;
    stepId?: unknown;
    input?: unknown;
    os?: unknown;
  };
  if (
    typeof lessonId !== "string" ||
    typeof stepId !== "string" ||
    typeof input !== "string" ||
    lessonId.length > 100 ||
    stepId.length > 100 ||
    input.length > 200
  )
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const lesson = getLesson(lessonId);
  const step = lesson?.steps.find((candidate) => candidate.id === stepId);
  if (!lesson || !step) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (step.type !== "formula" && step.type !== "select" && step.type !== "shortcut")
    return NextResponse.json({ error: "unsupported_step" }, { status: 400 });
  // The player never asks about unreadable formulas or plain values, so neither may spend a Gemini call.
  if (step.type === "formula") {
    const { reason } = gradeFormulaStep(step, input);
    if (reason === "parse_error" || reason === "not_formula")
      return NextResponse.json({ error: "not_explainable" }, { status: 400 });
  }
  if (!isExplainInputWrong(step, input, os === "mac" ? "mac" : "win"))
    return NextResponse.json({ error: "not_wrong" }, { status: 400 });
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  const admin = createAdminClient();
  if (!admin) return unavailable();
  if (user) {
    try {
      const { decision } = await loadLessonAccess(admin, user.id, lessonId);
      if (!decision.allowed)
        return NextResponse.json(
          { error: decision.reason },
          { status: decision.reason === "signup" ? 401 : 403 },
        );
    } catch {
      return NextResponse.json({ error: "access_unavailable" }, { status: 503 });
    }
  } else if (lessonId !== "intro") return NextResponse.json({ error: "signup" }, { status: 401 });

  const inputNorm = normaliseExplainInput(input.slice(0, 200));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const salt = process.env.EXPLAIN_IP_SALT || "excel-guru-explain-salt";
  const caller = callerKey(user?.id ?? null, ip, salt);
  if (!caller) return unavailable();

  // Check the cache first: a hit is served without consuming today's allowance.
  try {
    const hit = await lookupExplainCache(admin, lessonId, stepId, inputNorm);
    if (hit) return NextResponse.json({ id: hit.id, text: hit.text, cached: true });
  } catch {
    return unavailable();
  }

  try {
    const count = await countExplainCalls(admin, caller, istDayStart());
    if (!shouldAllowUncachedCall(count))
      return NextResponse.json({ error: "limit" }, { status: 429 });
    if (!(await insertExplainCall(admin, caller))) return unavailable();
  } catch {
    return unavailable();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const prompt = buildExplainPrompt(lesson, stepId, input);
  try {
    const text = await requestGeminiExplanation(prompt, apiKey, model);
    if (!text) return unavailable();
    const row = await insertExplainCache(admin, {
      lesson_id: lessonId,
      step_id: stepId,
      input_norm: inputNorm,
      text,
    });
    return row ? NextResponse.json({ id: row.id, text, cached: false }) : unavailable();
  } catch {
    return unavailable();
  }
}
