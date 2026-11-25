import { describe, expect, it } from "vitest";
import { parseOfferRegex, isSoldText, isIPhoneOffer } from "./parser";

describe("offer parser", () => {
  it("extracts a typical supplier post", () => {
    const p = parseOfferRegex("iPhone 14 Pro Max 256gb roxo\nBateria 88%\nImpecável\nR$ 4.350");
    expect(p).toMatchObject({ model: "iPhone 14 Pro Max", storage: "256GB", battery_health: 88, cost: 4350, isValid: true });
  });
  it("detects technical alerts", () => {
    const p = parseOfferRegex("ip 12 128gb tela trocada face id off 1800");
    expect(p.technical_alerts).toEqual(["Tela trocada", "Face ID OFF"]);
    expect(p.cost).toBe(1800);
  });
  it("detects sold replies", () => {
    expect(isSoldText("Vendido!")).toBe(true);
    expect(isSoldText("já foi")).toBe(true);
    expect(isSoldText("disponível")).toBe(false);
  });
  it("ignores non offers", () => {
    expect(isIPhoneOffer("bom dia pessoal")).toBe(false);
  });
});
