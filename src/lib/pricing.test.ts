import { describe, expect, it } from "vitest";
import { categorize, computePrices, roundTo90, cardTotal } from "./pricing";

const margins = [
  { category_name: "IPHONE_11_12", fixed_margin: 200, round_to_90: true, is_active: true },
  { category_name: "IPHONE_13_15", fixed_margin: 300, round_to_90: true, is_active: true },
  { category_name: "PRO_SERIES", fixed_margin: 450, round_to_90: true, is_active: true },
  { category_name: "SEALED", fixed_margin: 200, round_to_90: true, is_active: true },
];

describe("margin rules", () => {
  it("iPhone 11-12 adds R$200", () => {
    expect(computePrices({ cost: 1500, model: "iPhone 12", sealed: false, margins, rate12: 0 }).final_price_pix).toBe(1790);
  });
  it("iPhone 13-15 adds R$300", () => {
    expect(computePrices({ cost: 2000, model: "iPhone 14", sealed: false, margins, rate12: 0 }).final_price_pix).toBe(2390);
  });
  it("Pro line adds R$450", () => {
    expect(categorize("iPhone 13 Pro Max", false)).toBe("PRO_SERIES");
    expect(computePrices({ cost: 3000, model: "iPhone 13 Pro Max", sealed: false, margins, rate12: 0 }).final_price_pix).toBe(3490);
  });
  it("sealed adds R$200 even for Pro", () => {
    expect(computePrices({ cost: 5000, model: "iPhone 15 Pro", sealed: true, margins, rate12: 0 }).final_price_pix).toBe(5290);
  });
  it("rounds up to a price ending in 90", () => {
    expect(roundTo90(3200)).toBe(3290);
    expect(roundTo90(3290)).toBe(3290);
    expect(roundTo90(3291)).toBe(3390);
  });
  it("card price nets the pix amount after the 12x fee", () => {
    expect(cardTotal(1000, 9.8)).toBe(1109);
  });
});
