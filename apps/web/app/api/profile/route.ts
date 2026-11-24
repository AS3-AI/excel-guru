import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { rateLimit } from "../../../lib/rate-limit";
import { firstNameError } from "../../../lib/auth";
import { safeLinkedInUrl } from "../../../lib/leaderboard";

export async function PATCH(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  if (!(await rateLimit(admin, `profile-update:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const { firstName, linkedinUrl } = body as { firstName?: unknown; linkedinUrl?: unknown };
  const updates: { first_name?: string; linkedin_url?: string | null } = {};

  if (firstName !== undefined) {
    if (typeof firstName !== "string") {
      return NextResponse.json({ error: "First name must be a string" }, { status: 400 });
    }
    const trimmed = firstName.trim();
    const err = firstNameError(trimmed);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    updates.first_name = trimmed;
  }

  if (linkedinUrl !== undefined) {
    if (linkedinUrl === null || linkedinUrl === "") {
      updates.linkedin_url = null;
    } else if (typeof linkedinUrl === "string") {
      const trimmed = linkedinUrl.trim();
      if (trimmed === "") {
        updates.linkedin_url = null;
      } else {
        const validated = safeLinkedInUrl(trimmed);
        if (!validated) {
          return NextResponse.json({ error: "Enter a valid LinkedIn URL (e.g. https://linkedin.com/in/username)" }, { status: 400 });
        }
        updates.linkedin_url = validated;
      }
    } else {
      return NextResponse.json({ error: "LinkedIn URL must be a string" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select("first_name,username,email,linkedin_url")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
