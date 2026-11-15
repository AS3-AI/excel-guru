import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, state } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
  state: { active: false, groupPremium: false },
}));
vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));
import { POST } from "./route";

function mockAdmin() {
  return {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => table === "profiles" ? { data: { email: "learner@example.com", group_id: state.groupPremium ? "group_1" : null }, error: null } : { data: { has_paid_access: state.groupPremium }, error: null },
        then(resolve: (v: unknown) => void) {
          resolve(table === "subscriptions" ? { data: state.active ? [{ status: "active", period_end: null }] : [], error: null } : { data: [], error: null });
        },
      };
      return q;
    },
  };
}

describe("checkout premium guard", () => {
  beforeEach(() => {
    state.active = false;
    state.groupPremium = false;
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "user_1", email: "learner@example.com" } } }) } });
    createAdminClient.mockReturnValue(mockAdmin());
  });
  async function post() { return POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "annual", currency: "INR" }) })); }

  it("returns already_premium for an active non-expiring subscription", async () => {
    state.active = true;
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_premium" });
  });
  it("returns already_premium for premium access through a group", async () => {
    state.groupPremium = true;
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_premium" });
  });
});
