import { NextRequest, NextResponse } from "next/server";
import { isEntitled } from "@excel-guru/payments";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { currencyForCountry } from "../../../lib/plans";
import { paymentsEnabled } from "../../../lib/payments-config";
import { hasSupabaseAuthCookie } from "../../../lib/auth";

export async function GET(request: NextRequest) {
  const currency = currencyForCountry(request.headers.get("x-vercel-ip-country"));
  const billingEnabled = paymentsEnabled(process.env.PAYMENTS_ENABLED);
  const headers = { "Cache-Control": "private, no-store" };

  if (request.nextUrl.searchParams.get("scope") === "region") {
    return NextResponse.json({ currency, paymentsEnabled: billingEnabled }, { headers });
  }

  const base = {
    currency,
    paymentsEnabled: billingEnabled,
    signedIn: false,
    premium: false,
    canCancel: false,
    endsAt: null as string | null,
    invited: false,
  };

  if (!hasSupabaseAuthCookie(request.cookies.getAll())) {
    return NextResponse.json(base, { headers });
  }

  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };

  if (!user) {
    return NextResponse.json(base, { headers });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ...base, signedIn: true }, { headers });
  }

  const [profileRes, subRes] = await Promise.all([
    admin
      .from("profiles")
      .select("is_premium,invited,group_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("subscriptions").select("status,period_end").eq("user_id", user.id),
  ]);

  let groupPremium = false;
  if (profileRes.data?.group_id) {
    const { data: group } = await admin
      .from("groups")
      .select("has_paid_access")
      .eq("id", profileRes.data.group_id)
      .maybeSingle();
    groupPremium = group?.has_paid_access === true;
  }

  const subscriptions = subRes.data ?? [];
  const active = subscriptions.find(
    (row) =>
      row.status === "active" && (!row.period_end || Date.parse(row.period_end) > Date.now()),
  );
  const premium =
    profileRes.data?.is_premium === true || isEntitled(subscriptions, Date.now(), groupPremium);

  return NextResponse.json(
    {
      currency,
      paymentsEnabled: billingEnabled,
      signedIn: true,
      premium,
      invited: profileRes.data?.invited === true,
      canCancel: !!active,
      endsAt: active?.period_end ?? null,
    },
    { headers },
  );
}
