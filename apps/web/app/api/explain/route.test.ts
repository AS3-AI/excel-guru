import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, requestGeminiExplanation } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), requestGeminiExplanation: vi.fn(),
}));
vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../lib/explain", async (importOriginal) => ({ ...(await importOriginal<object>()), requestGeminiExplanation }));
import { POST } from "./route";

async function post(input: string) {
  return POST(new Request("http://localhost/api/explain", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4, 10.0.0.1" }, body: JSON.stringify({ lessonId: "intro", stepId: "s3", input }) }));
}

function adminDb({ cache = [], count = 0, countError = null, insertError = null }: { cache?: any[]; count?: number; countError?: Error | null; insertError?: Error | null } = {}) {
  const events: string[] = [];
  const client = { from: (table: string) => {
    let data: any;
    const q: any = {
      select: () => q, eq: () => q, gte: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: cache[0] ?? null, error: null }),
      update: () => { events.push("cache-update"); return q; },
      insert: (row: any) => { data = row; events.push(table === "explain_calls" ? "call-insert" : "cache-insert"); return q; },
      single: async () => ({ data: { id: "new" }, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve(table === "explain_calls" ? { count, error: countError } : { data: [], error: null }),
    };
    if (table === "explain_calls") {
      q.then = (resolve: (value: unknown) => unknown) => resolve({ count, error: countError });
      const oldInsert = q.insert;
      q.insert = (row: any) => { events.push("call-insert"); return { then: (resolve: (value: unknown) => unknown) => resolve({ error: insertError }) }; };
      void oldInsert;
    }
    return q;
  } };
  return { client, events };
}

describe("explain route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    createAdminClient.mockReturnValue(null);
  });

  it("rejects input longer than 200 characters before grading", async () => {
    const response = await post("=" + "1+".repeat(150) + "1");
    expect(response.status).toBe(400);
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("rejects an unreadable formula without calling Gemini", async () => {
    const response = await post("=SUM(B2");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "not_explainable" });
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("rejects a plain value without calling Gemini", async () => {
    const response = await post("5");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "not_explainable" });
  });

  it("rejects a correct answer", async () => {
    const response = await post("=B2+B3");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "not_wrong" });
  });

  it("lets a readable wrong formula through the guards", async () => {
    const response = await post("=B2-B3");
    expect(response.status).toBe(503);
  });

  it("refuses signed-out calls when the IP salt is missing", async () => {
    delete process.env.EXPLAIN_IP_SALT;
    createAdminClient.mockReturnValue({});
    const response = await post("=B2-B3");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable" });
  });

  it("fails closed when the quota count fails", async () => {
    process.env.EXPLAIN_IP_SALT = "test-salt";
    const db = adminDb({ countError: new Error("count failed") });
    createAdminClient.mockReturnValue(db.client);
    const response = await post("=B2-B3");
    expect(response.status).toBe(503);
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("refuses the 21st uncached call without inserting or calling Gemini", async () => {
    process.env.EXPLAIN_IP_SALT = "test-salt";
    const db = adminDb({ count: 20 });
    createAdminClient.mockReturnValue(db.client);
    const response = await post("=B2-B3");
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "limit" });
    expect(db.events).not.toContain("call-insert");
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("fails closed when the call-log insert fails", async () => {
    process.env.EXPLAIN_IP_SALT = "test-salt";
    const db = adminDb({ insertError: new Error("insert failed") });
    createAdminClient.mockReturnValue(db.client);
    const response = await post("=B2-B3");
    expect(response.status).toBe(503);
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("serves a cache hit without counting or inserting", async () => {
    process.env.EXPLAIN_IP_SALT = "test-salt";
    const db = adminDb({ cache: [{ id: "cached", text: "Cached help", score: 0, served_count: 1 }] });
    createAdminClient.mockReturnValue(db.client);
    const response = await post("=B2-B3");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "cached", cached: true });
    expect(db.events).toEqual(["cache-update"]);
    expect(requestGeminiExplanation).not.toHaveBeenCalled();
  });

  it("records an allowed miss before invoking Gemini", async () => {
    process.env.EXPLAIN_IP_SALT = "test-salt";
    const db = adminDb({ count: 19 });
    createAdminClient.mockReturnValue(db.client);
    requestGeminiExplanation.mockImplementation(async () => {
      expect(db.events).toContain("call-insert");
      return "Check the range.";
    });
    const response = await post("=B2-B3");
    expect(response.status).toBe(200);
    expect(db.events).toEqual(["call-insert", "cache-insert"]);
  });

  it("allows signed-in callers without the IP salt", async () => {
    delete process.env.EXPLAIN_IP_SALT;
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } });
    const db = adminDb({ count: 0 });
    createAdminClient.mockReturnValue(db.client);
    requestGeminiExplanation.mockResolvedValue("Check the range.");
    const response = await post("=B2-B3");
    expect(response.status).toBe(200);
    expect(db.events[0]).toBe("call-insert");
  });
});
