import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, requestGeminiExplanation } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), requestGeminiExplanation: vi.fn(),
}));
vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../lib/explain", async (importOriginal) => ({ ...(await importOriginal<object>()), requestGeminiExplanation }));
import { POST } from "./route";

async function post(input: string) {
  return POST(new Request("http://localhost/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: "intro", stepId: "s3", input }) }));
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
});
