import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient, getOrder } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getOrder: vi.fn(() => ["intro", "sum-1"]),
}));

vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../lib/rate-limit", () => ({ rateLimit: async () => true }));
vi.mock("../../../lib/lessons", () => ({ getOrder }));

import { GET, POST } from "./route";

describe("/api/certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not have full access", async () => {
    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Ashish", is_premium: false, invited: false, group_id: null }, error: null }) }) }) };
        }
        if (table === "lesson_progress") {
          return { select: () => ({ eq: async () => ({ data: [{ lesson_id: "intro" }, { lesson_id: "sum-1" }], error: null }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      },
    });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 403 when not all lessons are completed", async () => {
    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Ashish", is_premium: true, invited: false, group_id: null }, error: null }) }) }) };
        }
        if (table === "lesson_progress") {
          return { select: () => ({ eq: async () => ({ data: [{ lesson_id: "intro" }], error: null }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      },
    });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("issues a certificate when entitled and curriculum complete", async () => {
    const insertSingle = vi.fn(async () => ({
      data: { credential_id: "EG-2026-1234ABCD", name: "Ashish", issued_at: "2026-11-25T00:00:00Z" },
      error: null,
    }));
    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Ashish", is_premium: false, invited: true, group_id: null }, error: null }) }) }) };
        }
        if (table === "lesson_progress") {
          return { select: () => ({ eq: async () => ({ data: [{ lesson_id: "intro" }, { lesson_id: "sum-1" }], error: null }) }) };
        }
        if (table === "subscriptions") {
          return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
        }
        if (table === "certificates") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            insert: () => ({ select: () => ({ single: insertSingle }) }),
          };
        }
        return {};
      },
    });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; certificate: { credentialId: string; name: string } };
    expect(body.ok).toBe(true);
    expect(body.certificate.credentialId).toBe("EG-2026-1234ABCD");
  });

  it("downloads an SVG certificate on GET ?download=1", async () => {
    createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { credential_id: "EG-2026-9999", name: "Ashish", issued_at: "2026-11-25T00:00:00Z" },
              error: null,
            }),
          }),
        }),
      }),
    });
    const res = await GET(new NextRequest("http://localhost:3000/api/certificate?download=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg).toContain("EG-2026-9999");
    expect(svg).toContain("Ashish");
  });
});
