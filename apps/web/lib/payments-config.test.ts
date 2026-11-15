import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentsEnabled } from "./payments-config";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient }));
vi.mock("./supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { POST } from "../app/api/checkout/route";

describe("paymentsEnabled", () => {
  it.each([undefined, "", "false", "TRUE", "1"]) ("is off for %s", (value) => {
    expect(paymentsEnabled(value)).toBe(false);
  });

  it("is on only for the literal true value", () => {
    expect(paymentsEnabled("true")).toBe(true);
  });
});

describe("checkout payments switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns payments_disabled before authentication when off", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    const response = await POST(new Request("http://localhost/api/checkout", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "payments_disabled" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("keeps the existing authentication guard when on", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    const response = await POST(new Request("http://localhost/api/checkout", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
