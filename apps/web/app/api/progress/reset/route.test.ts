import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, rateLimitMock } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("../../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../../lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

import { POST } from "./route";

describe("POST /api/progress/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 503 when admin client is unavailable", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user_123" } } }) },
    });
    createAdminClient.mockReturnValue(null);
    const res = await POST();
    expect(res.status).toBe(503);
  });

  it("returns 429 when rate limited", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user_123" } } }) },
    });
    createAdminClient.mockReturnValue({});
    rateLimitMock.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(429);
  });

  it("deletes lesson_progress, lesson_completions, and step_attempts on reset", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user_123" } } }) },
    });

    const deletedTables: string[] = [];
    createAdminClient.mockReturnValue({
      from: (table: string) => ({
        delete: () => ({
          eq: (_col: string, val: string) => {
            deletedTables.push(`${table}:${val}`);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(deletedTables).toContain("lesson_progress:user_123");
    expect(deletedTables).toContain("lesson_completions:user_123");
    expect(deletedTables).toContain("step_attempts:user_123");
  });
});
