// apps/web/lib/plans.ts — the only place prices live
export const PLANS = {
  INR: { monthly: 499, annual: 1499, lifetime: 4999 },   // annual confirmed 12 Nov; lifetime pending
  USD: { monthly: 20,  annual: 60,   lifetime: 200 },
} as const;

export type Currency = keyof typeof PLANS;

export function currencyForCountry(country: string | null | undefined): Currency {
  return country?.toUpperCase() === "IN" ? "INR" : "USD";
}

export function formatPrice(currency: Currency, amount: number): string {
  return currency === "INR" ? `₹${amount.toLocaleString("en-IN")}` : `$${amount}`;
}
