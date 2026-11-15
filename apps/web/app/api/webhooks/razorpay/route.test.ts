import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, state } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  state: { mode: "success", inserted: false, deleted: 0, upserts: 0, profileWrites: 0, lastUpdatedAt: null as string | null },
}));
vi.mock("../../../../lib/supabase/admin", () => ({ createAdminClient }));
import { POST } from "./route";

const secret = "test-secret";
const body = JSON.stringify({ id: "evt_body_1", event: "subscription.activated", created_at: 1_700_000_000, payload: { subscription: { entity: { id: "sub_1", current_end: 1_800_000_000, notes: { userId: "user_1", plan: "annual" } } } } });
const signature = createHmac("sha256", secret).update(body).digest("hex");

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
        maybeSingle: async () => table === "subscriptions" ? { data: null, error: null } : { data: { group_id: null }, error: null },
        upsert: async (row: any) => {
          state.upserts++;
          state.lastUpdatedAt = row.updated_at;
          if (state.mode === "fail_once" && state.upserts === 1) return { error: { message: "db error" } };
          q.lastUpsert = row;
          return { error: null };
        },
        update: () => ({ eq: async () => { state.profileWrites++; return { error: null }; } }),
        then(resolve: (v: unknown) => void) {
          resolve(table === "subscriptions" ? { data: q.lastUpsert ? [{ status: q.lastUpsert.status, period_end: q.lastUpsert.period_end, plan: q.lastUpsert.plan }] : [], error: null } : { data: { group_id: null }, error: null });
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
    Object.assign(state, { mode: "success", inserted: false, deleted: 0, upserts: 0, profileWrites: 0, lastUpdatedAt: null });
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
});
