import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currencyForCountry } from "@/lib/plans";
import { paymentsEnabled } from "@/lib/payments-config";
import { PricingClient } from "./pricing-client";
import "./pricing.css";

export default async function PricingPage() {
  const requestHeaders = await headers();
  const currency = currencyForCountry(requestHeaders.get("x-vercel-ip-country"));
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let premium = false;
  let canCancel = false;
  let endsAt: string | null = null;
  if (user) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("profiles").select("is_premium").eq("user_id", user.id).maybeSingle();
      premium = data?.is_premium === true;
      const { data: subscriptions } = await admin.from("subscriptions").select("status,period_end").eq("user_id", user.id);
      const active = (subscriptions ?? []).find((row) => row.status === "active" && (!row.period_end || Date.parse(row.period_end) > Date.now()));
      canCancel = !!active;
      endsAt = active?.period_end ?? null;
    }
  }
  return <PricingClient currency={currency} paymentsEnabled={paymentsEnabled(process.env.PAYMENTS_ENABLED)} signedIn={!!user} premium={premium} canCancel={canCancel} endsAt={endsAt} />;
}
