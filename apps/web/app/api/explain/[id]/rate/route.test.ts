import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, rpcMock } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("../../../../../lib/supabase/server", () => ({ createClient }));
vi.mock("../../../../../lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function postRequest(body: unknown, id = VALID_ID) {
  const request = new Request(`http://localhost/api/explain/${id}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/explain/[id]/rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-123" } } }),
      },
    });
    rpcMock.mockResolvedValue({ data: 1, error: null });
    createAdminClient.mockReturnValue({
      rpc: rpcMock,
    });
  });

  describe("401 signed out", () => {
    it("returns 401 signed out when session is null", async () => {
      createClient.mockResolvedValue(null);
      const response = await postRequest({ helpful: true });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    });

    it("returns 401 signed out when user is null", async () => {
      createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null } }) },
      });
      const response = await postRequest({ helpful: true });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    });
  });

  describe("400 bad body", () => {
    it("returns 400 bad body on invalid JSON string", async () => {
      const response = await postRequest("{invalid-json");
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });

    it("returns 400 bad body when body is null or not an object", async () => {
      const response = await postRequest("plain text");
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });

    it("returns 400 bad body when helpful is missing", async () => {
      const response = await postRequest({});
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });

    it("returns 400 bad body when helpful is not boolean", async () => {
      const response = await postRequest({ helpful: "true" });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });
  });

  describe("404 bad id", () => {
    it("returns 404 bad id for invalid uuid format", async () => {
      const response = await postRequest({ helpful: true }, "not-a-uuid");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("404 when rpc returns null", () => {
    it("returns 404 when rpc returns null (explanation not found)", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      const response = await postRequest({ helpful: true });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    });
  });

  describe("503 on rpc error", () => {
    it("returns 503 on rpc error", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "database error" } });
      const response = await postRequest({ helpful: true });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
    });

    it("returns 503 unavailable when admin client cannot be created", async () => {
      createAdminClient.mockReturnValue(null);
      const response = await postRequest({ helpful: true });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
    });
  });

  describe("200 calls rpc with exactly those args", () => {
    it("returns 200 calls rpc with exactly those args when helpful is true", async () => {
      rpcMock.mockResolvedValue({ data: 1, error: null });
      const response = await postRequest({ helpful: true }, VALID_ID);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(rpcMock).toHaveBeenCalledWith("rate_explanation", {
        p_explanation_id: VALID_ID,
        p_user_id: "user-123",
        p_helpful: true,
      });
    });
  });

  describe("helpful false passes p_helpful false", () => {
    it("returns 200 and passes helpful false as p_helpful false", async () => {
      rpcMock.mockResolvedValue({ data: -1, error: null });
      const response = await postRequest({ helpful: false }, VALID_ID);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(rpcMock).toHaveBeenCalledWith("rate_explanation", {
        p_explanation_id: VALID_ID,
        p_user_id: "user-123",
        p_helpful: false,
      });
    });
  });
});
