import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, state } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  state: {
    mode: "success",
    inserted: false,
    deleted: 0,
    upserts: 0,
    profileWrites: 0,
    lastUpdatedAt: null as string | null,
    lastUpsert: null as any,
    lastProfileUpdate: null as any,
    existingSubscription: null as any,
  },
}));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient }));
import { POST } from "./route";

const secret = "test-secret";
const body = JSON.stringify({ id: "evt_body_1", event: "subscription.activated", created_at: 1_700_000_000, payload: { subscription: { entity: { id: "sub_1", current_end: 1_800_000_000, notes: { userId: "user_1", plan: "annual" } } } } });
const signature = createHmac("sha256", secret).update(body).digest("hex");

const makeWebhookBody = (event: string, extraEntity: Record<string, unknown> = {}, extraTop: Record<string, unknown> = {}) =>
  JSON.stringify({
    event,
    created_at: 1_700_000_000,
    payload: {
      subscription: {
        entity: {
          id: "sub_1",
          current_end: 1_800_000_000,
          created_at: 1_700_000_000,
          notes: { userId: "user_1", plan: "annual" },
          ...extraEntity,
        },
      },
    },
    ...extraTop,
  });

function mockAdmin() {
  return {
    auth: { admin: { getUserById: vi.fn(async (id: string) => {
      if (state.mode === "unknown" || id === "bad-id") return { data: { user: null }, error: { status: 404, message: "User not found" } };
      return { data: { user: { id: "user_1" } }, error: null };
    }) } },
    from(table: string) {
      const q: any = {
        insert: async () => {
          if (state.inserted) return { error: { code: "23505" } };
          state.inserted = true;
          return { error: null };
        },
        delete: () => ({ eq: async () => { state.deleted++; state.inserted = false; return { error: null }; } }),
        select: () => q,
        eq: () => q,
        maybeSingle: async () => table === "subscriptions" ? { data: state.existingSubscription ?? null, error: null } : { data: { group_id: null }, error: null },
        upsert: async (row: any) => {
          state.upserts++;
          state.lastUpdatedAt = row.updated_at;
          state.lastUpsert = row;
          if (state.mode === "fail_once" && state.upserts === 1) return { error: { message: "db error" } };
          q.lastUpsert = row;
          return { error: null };
        },
        update: (payload: any) => ({
          eq: async () => {
            state.profileWrites++;
            state.lastProfileUpdate = payload;
            return { error: null };
          },
        }),
        then(resolve: (v: unknown) => void) {
          const subsData = state.lastUpsert && !(state.mode === "fail_once" && state.upserts === 1)
            ? [{ status: state.lastUpsert.status, period_end: state.lastUpsert.period_end, plan: state.lastUpsert.plan }]
            : (state.existingSubscription ? [{ status: state.existingSubscription.status, period_end: state.existingSubscription.period_end, plan: state.existingSubscription.plan }] : []);
          resolve(table === "subscriptions" ? { data: subsData, error: null } : { data: { group_id: null }, error: null });
        },
      };
      return q;
    },
  };
}

function request(headerId = "some_unsigned_header_id", raw = body) {
  return new Request("http://localhost/api/webhooks/razorpay", { method: "POST", headers: { "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex"), "x-razorpay-event-id": headerId }, body: raw });
}

describe("Razorpay webhook route", () => {
  beforeEach(() => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", secret);
    Object.assign(state, {
      mode: "success",
      inserted: false,
      deleted: 0,
      upserts: 0,
      profileWrites: 0,
      lastUpdatedAt: null,
      lastUpsert: null,
      lastProfileUpdate: null,
      existingSubscription: null,
    });
    createAdminClient.mockReturnValue(mockAdmin());
  });

  it("applies a valid event and recomputes premium", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpdatedAt).toBe("2023-11-14T22:13:20.000Z");
    expect(state.profileWrites).toBe(1);
  });
  it("returns 200 without writes for a duplicate", async () => {
    state.inserted = true;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(0);
  });
  it("rejects a tampered signature", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST", headers: { "x-razorpay-signature": signature }, body: body.replace("activated", "cancelled") }));
    expect(response.status).toBe(400);
  });
  it("acknowledges an unknown user without writes", async () => {
    state.mode = "unknown";
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(0);
    expect(state.deleted).toBe(0);
  });
  it("acknowledges a malformed user id without writes", async () => {
    const malformed = body.replace("user_1", "bad-id");
    const response = await POST(request("header", malformed));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(0);
    expect(state.profileWrites).toBe(0);
    expect(state.deleted).toBe(0);
  });
  it("deletes the dedupe row after failed upsert so retry succeeds", async () => {
    state.mode = "fail_once";
    expect((await POST(request())).status).toBe(500);
    expect(state.deleted).toBe(1);
    expect((await POST(request())).status).toBe(200);
    expect(state.upserts).toBe(2);
  });
  it("ignores changes to the unsigned event id header", async () => {
    expect((await POST(request("header_one"))).status).toBe(200);
    expect((await POST(request("header_two"))).status).toBe(200);
    expect(state.upserts).toBe(1);
  });

  it("upserts active row with period_end from current_end on subscription.activated", async () => {
    const raw = makeWebhookBody("subscription.activated");
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpsert).toEqual({
      user_id: "user_1",
      provider: "razorpay",
      provider_ref: "sub_1",
      plan: "annual",
      status: "active",
      period_end: new Date(1_800_000_000 * 1000).toISOString(),
      updated_at: "2023-11-14T22:13:20.000Z",
    });
    expect(state.lastProfileUpdate).toMatchObject({ is_premium: true, plan: "annual" });
  });

  it("upserts active row with period_end from current_end on subscription.charged", async () => {
    const raw = makeWebhookBody("subscription.charged");
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpsert).toEqual({
      user_id: "user_1",
      provider: "razorpay",
      provider_ref: "sub_1",
      plan: "annual",
      status: "active",
      period_end: new Date(1_800_000_000 * 1000).toISOString(),
      updated_at: "2023-11-14T22:13:20.000Z",
    });
    expect(state.lastProfileUpdate).toMatchObject({ is_premium: true, plan: "annual" });
  });

  it("logs console.error when notes.plan is missing on subscription.activated", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = makeWebhookBody("subscription.activated", { plan_id: "plan_123", notes: { userId: "user_1" } });
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(consoleSpy).toHaveBeenCalledWith("Razorpay webhook ignored: missing notes", "subscription.activated");
    expect(state.upserts).toBe(0);
    expect(state.profileWrites).toBe(0);
    consoleSpy.mockRestore();
  });

  it("logs console.error when notes.userId is missing on subscription.activated", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = makeWebhookBody("subscription.activated", { notes: { plan: "annual" } });
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(consoleSpy).toHaveBeenCalledWith("Razorpay webhook ignored: missing notes", "subscription.activated");
    expect(state.upserts).toBe(0);
    expect(state.profileWrites).toBe(0);
    consoleSpy.mockRestore();
  });

  it("upserts cancelled row and updates is_premium false on subscription.cancelled", async () => {
    const raw = makeWebhookBody("subscription.cancelled");
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpsert).toMatchObject({ status: "cancelled", plan: "annual" });
    expect(state.lastProfileUpdate).toMatchObject({ is_premium: false, plan: null });
  });

  it("upserts cancelled row and updates is_premium false on subscription.completed", async () => {
    const raw = makeWebhookBody("subscription.completed");
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpsert).toMatchObject({ status: "cancelled", plan: "annual" });
    expect(state.lastProfileUpdate).toMatchObject({ is_premium: false, plan: null });
  });

  it("upserts past_due row and updates is_premium false on subscription.halted", async () => {
    const raw = makeWebhookBody("subscription.halted");
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(1);
    expect(state.lastUpsert).toMatchObject({ status: "past_due", plan: "annual" });
    expect(state.lastProfileUpdate).toMatchObject({ is_premium: false, plan: null });
  });

  it("ignores an older activated event arriving after a cancelled subscription", async () => {
    state.existingSubscription = {
      status: "cancelled",
      updated_at: "2023-11-15T00:00:00.000Z",
      period_end: null,
      plan: "annual",
    };
    const olderActivated = makeWebhookBody("subscription.activated", {}, { created_at: 1_700_000_000 });
    const response = await POST(request("hdr", olderActivated));
    expect(response.status).toBe(200);
    expect(state.upserts).toBe(0);
  });

  it("returns received: true and writes nothing for unknown event subscription.authenticated", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = JSON.stringify({
      event: "subscription.authenticated",
      created_at: 1_700_000_000,
      payload: { subscription: { entity: { id: "sub_1", notes: { userId: "user_1", plan: "annual" } } } },
    });
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(state.upserts).toBe(0);
    expect(state.profileWrites).toBe(0);
    expect(state.inserted).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns received: true and writes nothing for unknown event subscription.pending", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = JSON.stringify({
      event: "subscription.pending",
      created_at: 1_700_000_000,
      payload: { subscription: { entity: { id: "sub_1", notes: { userId: "user_1", plan: "annual" } } } },
    });
    const response = await POST(request("hdr", raw));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(state.upserts).toBe(0);
    expect(state.profileWrites).toBe(0);
    expect(state.inserted).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
