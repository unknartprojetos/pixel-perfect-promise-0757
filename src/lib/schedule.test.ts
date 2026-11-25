import { describe, expect, it } from "vitest";
import { buildSlots, isNightTime } from "./schedule";

describe("anti-ban schedule", () => {
  it("pauses between 23:00 and 07:30 Brasília", () => {
    expect(isNightTime(new Date("2026-01-01T02:30:00Z"))).toBe(true); // 23:30 BRT
    expect(isNightTime(new Date("2026-01-01T10:29:00Z"))).toBe(true); // 07:29 BRT
    expect(isNightTime(new Date("2026-01-01T10:31:00Z"))).toBe(false);
  });
  it("spaces messages within the delay window", () => {
    const s = buildSlots({ start: new Date("2026-01-01T15:00:00Z"), count: 3, delayMin: 45, delayMax: 90, nightPause: true, random: () => 0 });
    expect((s[1]!.getTime() - s[0]!.getTime()) / 1000).toBe(45);
  });
  it("moves night sends to 07:30", () => {
    const s = buildSlots({ start: new Date("2026-01-01T03:00:00Z"), count: 1, delayMin: 45, delayMax: 90, nightPause: true });
    expect(s[0]!.toISOString()).toBe("2026-01-01T10:30:00.000Z");
  });
});
