import type { Metadata } from "next";
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

export default function PricingPage() {
  return (
    <>
      <SiteHeader current="pricing" />
      <PricingClient paymentsEnabled={paymentsEnabled(process.env.PAYMENTS_ENABLED)} />
      <SiteFooter />
    </>
  );
}
