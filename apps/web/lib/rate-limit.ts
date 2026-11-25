import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Format a rate limit key as `<route>:<identifier>`.
 */
export function rateLimitKey(route: string, identifier: string): string {
  return `${route}:${identifier}`;
}

/**
 * Hash an IP address for unauthenticated rate limiting, matching the style in explain.ts.
 */
export function hashIp(
  ip: string | null,
  salt: string = process.env.EXPLAIN_IP_SALT || "",
): string {
  const normalized = ip?.trim() || "unknown";
  return createHash("sha256").update(`ip:${normalized}:${salt}`).digest("hex");
}

/**
 * Check and increment rate limit counter via Supabase RPC `hit_rate_limit`.
 * If the RPC fails or errors, allows the request (fail open) and logs a short error.
 *
 * @param admin Supabase admin / service-role client
 * @param key Unique rate limit key (e.g. `<route>:<user_id>`)
 * @param max Maximum allowed hits within the window
 * @param windowSeconds Window length in seconds
 * @returns true if allowed, false if blocked (rate limited)
 */
export type RateLimitAdmin =
  | {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lets test fakes stand in for SupabaseClient
      rpc: (...args: any[]) => any;
    }
  | SupabaseClient;

export async function rateLimit(
  admin: RateLimitAdmin | null | undefined,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!admin || typeof admin.rpc !== "function") {
    console.error("rateLimit: admin client unavailable, failing open");
    return true;
  }

  try {
    const { data, error } = await admin.rpc("hit_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error(
        `rateLimit RPC error for key "${key}": ${error.message || JSON.stringify(error)}`,
      );
      return true; // fail open
    }

    return typeof data === "boolean" ? data : true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`rateLimit call failed for key "${key}": ${msg}`);
    return true; // fail open
  }
}
