import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { hashIp, rateLimit, rateLimitKey } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allowed: returns true when the RPC permits the request", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const admin = { rpc: mockRpc };

    const allowed = await rateLimit(admin, "progress:user-123", 60, 60);

    expect(allowed).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("hit_rate_limit", {
      p_key: "progress:user-123",
      p_max: 60,
      p_window_seconds: 60,
    });
  });

  it("blocked: returns false when the RPC reports limit exceeded", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const admin = { rpc: mockRpc };

    const allowed = await rateLimit(admin, "progress:user-123", 60, 60);

    expect(allowed).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith("hit_rate_limit", {
      p_key: "progress:user-123",
      p_max: 60,
      p_window_seconds: 60,
    });
  });

  it("rpc error fails open: returns true and logs a short line when RPC returns an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "connection timeout", code: "57P01" },
    });
    const admin = { rpc: mockRpc };

    const allowed = await rateLimit(admin, "checkout:user-456", 10, 60);

    expect(allowed).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    const errorOutput = consoleError.mock.calls[0]?.join(" ") ?? "";
    expect(errorOutput).toMatch(/rateLimit/i);
    expect(errorOutput).toMatch(/connection timeout/i);
  });

  it("rpc error fails open: returns true and logs when RPC call throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockRpc = vi.fn().mockRejectedValue(new Error("network failure"));
    const admin = { rpc: mockRpc };

    const allowed = await rateLimit(admin, "billing/manage:user-789", 5, 60);

    expect(allowed).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    const errorOutput = consoleError.mock.calls[0]?.join(" ") ?? "";
    expect(errorOutput).toMatch(/rateLimit/i);
    expect(errorOutput).toMatch(/network failure/i);
  });

  it("rpc error fails open: returns true when admin client is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const allowed = await rateLimit(null, "waitlist:hash", 5, 60);

    expect(allowed).toBe(true);
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("key format", () => {
  it("formats user route keys as <route>:<user id>", () => {
    expect(rateLimitKey("progress", "usr_abc123")).toBe("progress:usr_abc123");
    expect(rateLimitKey("progress/merge", "usr_abc123")).toBe("progress/merge:usr_abc123");
    expect(rateLimitKey("progress/reset", "usr_abc123")).toBe("progress/reset:usr_abc123");
    expect(rateLimitKey("share-bonus", "usr_abc123")).toBe("share-bonus:usr_abc123");
    expect(rateLimitKey("checkout", "usr_abc123")).toBe("checkout:usr_abc123");
    expect(rateLimitKey("billing/manage", "usr_abc123")).toBe("billing/manage:usr_abc123");
    expect(rateLimitKey("explain/rate", "usr_abc123")).toBe("explain/rate:usr_abc123");
  });

  it("hashes IP addresses using sha256 with the explain salt style", () => {
    const ip = "203.0.113.4";
    const salt = "my-test-salt";
    const expected = createHash("sha256").update(`ip:${ip}:${salt}`).digest("hex");

    const hash = hashIp(ip, salt);

    expect(hash).toBe(expected);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces distinct hashes for different IPs and salts", () => {
    const salt = "shared-salt";
    const hash1 = hashIp("203.0.113.4", salt);
    const hash2 = hashIp("203.0.113.5", salt);
    const hash3 = hashIp("203.0.113.4", "other-salt");

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("handles null or missing IP safely", () => {
    const hash = hashIp(null, "salt");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashIp("", "salt"));
  });

  it("formats waitlist key as waitlist:<hash>", () => {
    const hash = hashIp("203.0.113.4", "salt");
    expect(rateLimitKey("waitlist", hash)).toBe(`waitlist:${hash}`);
  });
});
