import type { Metadata } from "next";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currencyForCountry } from "@/lib/plans";
import { paymentsEnabled } from "@/lib/payments-config";
import { STATIC_METADATA } from "@/lib/seo";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: STATIC_METADATA.pricing.title,
  description: STATIC_METADATA.pricing.description,
  openGraph: {
    title: STATIC_METADATA.pricing.title,
    description: STATIC_METADATA.pricing.description,
  },
};

export default async function PricingPage() {
  const requestHeaders = await headers();
  const currency = currencyForCountry(requestHeaders.get("x-vercel-ip-country"));
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let premium = false;
  let invited = false;
  let canCancel = false;
  let endsAt: string | null = null;
  if (user) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("profiles").select("is_premium,invited").eq("user_id", user.id).maybeSingle();
      premium = data?.is_premium === true;
      invited = data?.invited === true;
      const { data: subscriptions } = await admin.from("subscriptions").select("status,period_end").eq("user_id", user.id);
      const active = (subscriptions ?? []).find((row) => row.status === "active" && (!row.period_end || Date.parse(row.period_end) > Date.now()));
      canCancel = !!active;
      endsAt = active?.period_end ?? null;
    }
  }
  return <><SiteHeader signedIn={!!user} current="pricing" /><PricingClient currency={currency} paymentsEnabled={paymentsEnabled(process.env.PAYMENTS_ENABLED)} signedIn={!!user} premium={premium} canCancel={canCancel} endsAt={endsAt} invited={invited} /><SiteFooter /></>;
}
