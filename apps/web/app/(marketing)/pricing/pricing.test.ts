import { describe, expect, it } from "vitest";
import { currencyForCountry, formatPrice, PLANS } from "../../../lib/plans";

describe("pricing data and currency selection", () => {
  it("uses INR for India", () => { expect(currencyForCountry("IN")).toBe("INR"); });
  it("handles lowercase country codes", () => { expect(currencyForCountry("in")).toBe("INR"); });
  it("defaults missing country to USD", () => { expect(currencyForCountry(null)).toBe("USD"); });
  it("defaults unknown country to USD", () => { expect(currencyForCountry("GB")).toBe("USD"); });
  it("reads INR monthly amount from plans", () => { expect(PLANS.INR.monthly).toBe(499); });
  it("reads INR annual amount from plans", () => { expect(PLANS.INR.annual).toBe(1499); });
  it("reads USD monthly amount from plans", () => { expect(PLANS.USD.monthly).toBe(20); });
  it("reads USD annual amount from plans", () => { expect(PLANS.USD.annual).toBe(60); });
  it("formats INR", () => { expect(formatPrice("INR", PLANS.INR.monthly)).toBe("₹499"); });
  it("formats USD", () => { expect(formatPrice("USD", PLANS.USD.annual)).toBe("$60"); });
});
