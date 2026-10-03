import { describe, expect, it } from "vitest";
import { getMilestones, getTreeLevel } from "./config";
import { computeStreak } from "./stats";

describe("tree levels", () => {
  it("0 hours is a seedling", () => expect(getTreeLevel(0).level).toBe("seedling"));
  it("1–5 hours is a small tree", () => {
    expect(getTreeLevel(1).level).toBe("small");
    expect(getTreeLevel(5).level).toBe("small");
  });
  it("6–15 hours is growing", () => {
    expect(getTreeLevel(6).level).toBe("growing");
    expect(getTreeLevel(15).level).toBe("growing");
  });
  it("16–30 hours is mature", () => {
    expect(getTreeLevel(16).level).toBe("mature");
    expect(getTreeLevel(30).level).toBe("mature");
  });
  it("31+ hours is enchanted", () => expect(getTreeLevel(31).level).toBe("enchanted"));
});

describe("milestones", () => {
  it("24.5 hours earns first + 10h but not 25h", () =>
    expect(getMilestones(24.5).map((m) => m.id)).toEqual(["first", "h10"]));
  it("0 hours earns none", () => expect(getMilestones(0)).toEqual([]));
});

describe("streak", () => {
  it("counts consecutive days ending today", () =>
    expect(computeStreak(["2026-10-01", "2026-10-02", "2026-10-03"], "2026-10-03")).toBe(3));
  it("breaks on a gap", () => expect(computeStreak(["2026-09-30", "2026-10-03"], "2026-10-03")).toBe(1));
});
