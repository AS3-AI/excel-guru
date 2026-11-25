import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getOrder } from "../../../lib/lessons";
import { rateLimit } from "../../../lib/rate-limit";
import { renderCertificateSvg } from "../../../lib/profile-stats";
import { originFrom } from "../../../lib/auth";

async function loadEntitlementAndProgress(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
) {
  const [profileRes, progressRes, subRes] = await Promise.all([
    admin.from("profiles").select("first_name,is_premium,invited,group_id").eq("user_id", userId).maybeSingle(),
    admin.from("lesson_progress").select("lesson_id").eq("user_id", userId),
    admin.from("subscriptions").select("status,period_end").eq("user_id", userId).eq("status", "active"),
  ]);

  if (profileRes.error || progressRes.error || subRes.error) {
    throw new Error("Certificate status unavailable");
  }

  let groupPaid = false;
  if (profileRes.data?.group_id) {
    const { data: group } = await admin
      .from("groups")
      .select("has_paid_access")
      .eq("id", profileRes.data.group_id)
      .maybeSingle();
    groupPaid = group?.has_paid_access === true;
  }

  const activeSub = (subRes.data ?? []).some(
    (s) => !s.period_end || Date.parse(s.period_end) > Date.now(),
  );

  const hasFullAccess =
    profileRes.data?.is_premium === true ||
    profileRes.data?.invited === true ||
    groupPaid ||
    activeSub;

  const totalLessons = getOrder().length;
  const completedCount = (progressRes.data ?? []).length;

  return {
    firstName: profileRes.data?.first_name ?? "Excel Guru Graduate",
    hasFullAccess,
    completedCount,
    totalLessons,
    eligible: hasFullAccess && completedCount >= totalLessons,
  };
}

export async function POST() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Certificate service unavailable" }, { status: 503 });

  if (!(await rateLimit(admin, `certificate:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let status;
  try {
    status = await loadEntitlementAndProgress(admin, user.id);
  } catch {
    return NextResponse.json({ error: "Certificate service unavailable" }, { status: 500 });
  }

  if (!status.hasFullAccess) {
    return NextResponse.json({ error: "PRO or invited access required to issue a certificate" }, { status: 403 });
  }
  if (status.completedCount < status.totalLessons) {
    return NextResponse.json(
      { error: `Complete all ${status.totalLessons} lessons first (${status.completedCount}/${status.totalLessons} done)` },
      { status: 403 },
    );
  }

  const existing = await admin
    .from("certificates")
    .select("credential_id,name,issued_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: "Certificate service unavailable" }, { status: 500 });
  }

  if (existing.data) {
    // Keep recipient name synced with display name
    if (existing.data.name !== status.firstName) {
      await admin.from("certificates").update({ name: status.firstName }).eq("user_id", user.id);
    }
    return NextResponse.json({
      ok: true,
      certificate: {
        credentialId: existing.data.credential_id,
        name: status.firstName,
        issuedAt: existing.data.issued_at,
      },
    });
  }

  const year = new Date().getUTCFullYear();
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const credentialId = `EG-${year}-${code}`;
  const issuedAt = new Date().toISOString();

  const inserted = await admin
    .from("certificates")
    .insert({
      credential_id: credentialId,
      user_id: user.id,
      name: status.firstName,
      issued_at: issuedAt,
    })
    .select("credential_id,name,issued_at")
    .single();

  if (inserted.error) {
    return NextResponse.json({ error: "Could not issue certificate" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    certificate: {
      credentialId: inserted.data.credential_id,
      name: inserted.data.name,
      issuedAt: inserted.data.issued_at,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Certificate service unavailable" }, { status: 503 });

  const { data: cert, error } = await admin
    .from("certificates")
    .select("credential_id,name,issued_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Certificate service unavailable" }, { status: 500 });
  if (!cert) return NextResponse.json({ error: "No certificate issued yet" }, { status: 404 });

  if (request.nextUrl.searchParams.get("download") === "1") {
    const origin = originFrom((n) => request.headers.get(n), process.env.NEXT_PUBLIC_BASE_URL);
    const verifyUrl = `${origin}/verify?id=${encodeURIComponent(cert.credential_id)}`;
    const svg = renderCertificateSvg({
      recipientName: cert.name,
      credentialId: cert.credential_id,
      issuedAtIso: cert.issued_at,
      totalLessons: getOrder().length,
      verifyUrl,
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="excel-guru-certificate-${cert.credential_id}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    certificate: {
      credentialId: cert.credential_id,
      name: cert.name,
      issuedAt: cert.issued_at,
    },
  });
}
