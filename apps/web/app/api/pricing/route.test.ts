import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, state } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  state: {
    isPremium: false,
    invited: false,
    groupPaid: false,
    activeSub: false,
  },
}));

vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));

import { GET } from "./route";

function mockAdmin() {
  return {
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () =>
          table === "profiles"
            ? {
                data: {
                  is_premium: state.isPremium,
                  invited: state.invited,
                  group_id: state.groupPaid ? "group_1" : null,
                },
                error: null,
              }
            : { data: { has_paid_access: state.groupPaid }, error: null },
        then: (resolve: (v: unknown) => void) =>
          resolve(
            table === "subscriptions"
              ? {
                  data: state.activeSub ? [{ status: "active", period_end: null }] : [],
                  error: null,
                }
              : { data: [], error: null },
          ),
      };
      return q;
    },
  };
}

describe("GET /api/pricing", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    state.isPremium = false;
    state.invited = false;
    state.groupPaid = false;
    state.activeSub = false;
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user_1" } } }) },
    });
    createAdminClient.mockReturnValue(mockAdmin());
  });

  it("returns region currency without hitting Supabase for scope=region", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/pricing?scope=region", {
        headers: { "x-vercel-ip-country": "IN" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ currency: "INR", paymentsEnabled: true });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns signedOut state immediately when no auth cookie exists", async () => {
    createClient.mockClear();
    const res = await GET(new NextRequest("http://localhost/api/pricing"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ signedIn: false, premium: false, currency: "USD" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("marks group-paid learners as premium even if profiles.is_premium is false", async () => {
    state.groupPaid = true;
    const req = new NextRequest("http://localhost/api/pricing", {
      headers: { cookie: "sb-test-auth-token=tok", "x-vercel-ip-country": "IN" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      currency: "INR",
      signedIn: true,
      premium: true,
      canCancel: false,
    });
  });

  it("marks active subscription holders as premium with canCancel", async () => {
    state.activeSub = true;
    const req = new NextRequest("http://localhost/api/pricing", {
      headers: { cookie: "sb-test-auth-token=tok" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      signedIn: true,
      premium: true,
      canCancel: true,
    });
  });
});
