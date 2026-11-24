import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient, updateMock, selectMock, eqMock, singleMock } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const eqMock = vi.fn(() => ({ select: selectMock }));
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  return {
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    updateMock,
    selectMock,
    eqMock,
    singleMock,
  };
});

vi.mock("../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../lib/rate-limit", () => ({ rateLimit: async () => true }));

import { PATCH } from "./route";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user_test_123", email: "test@example.com" } } }),
      },
    });
    singleMock.mockResolvedValue({
      data: {
        first_name: "Ashish",
        username: "ashish_dev",
        email: "test@example.com",
        linkedin_url: "https://linkedin.com/in/ashish",
      },
      error: null,
    });
    createAdminClient.mockReturnValue({
      from: () => ({
        update: updateMock,
      }),
    });
  });

  it("returns 401 when signed out", async () => {
    createClient.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ firstName: "Ashish" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is not an object", async () => {
    const res = await PATCH(new NextRequest("http://localhost/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when firstName is empty or invalid", async () => {
    const res = await PATCH(patchRequest({ firstName: "" }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("Enter your first name");
  });

  it("returns 400 when linkedinUrl is not a valid linkedin url", async () => {
    const res = await PATCH(patchRequest({ linkedinUrl: "https://evil.com/hack" }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("valid LinkedIn URL");
  });

  it("returns 400 when no fields to update", async () => {
    const res = await PATCH(patchRequest({}));
    expect(res.status).toBe(400);
  });

  it("updates firstName and linkedinUrl successfully", async () => {
    const res = await PATCH(patchRequest({
      firstName: "Ashish",
      linkedinUrl: "https://www.linkedin.com/in/ashish-sharma",
    }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      first_name: "Ashish",
      linkedin_url: "https://www.linkedin.com/in/ashish-sharma",
    });
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("clears linkedinUrl when null or empty string passed", async () => {
    const res = await PATCH(patchRequest({ linkedinUrl: "" }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      linkedin_url: null,
    });
  });
});
