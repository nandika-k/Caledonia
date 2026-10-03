import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES, FLOWERS, getMilestones, getTreeLevel } from "./config";
import { computeStreak, deriveVolunteers } from "./stats";
import { MIN_TREE_SPACING, spaceVolunteers } from "./layout";
import type { Activity, GroveData } from "./types";

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
  it("breaks on a gap", () =>
    expect(computeStreak(["2026-09-30", "2026-10-03"], "2026-10-03")).toBe(1));
});

describe("category flowers", () => {
  const entries = (activities: Pick<Activity, "activityType" | "hours">[]): GroveData => ({
    volunteers: [{ id: "saanvi", name: "Saanvi", x: 0.5, y: 0.5, joinedAt: "2026-01-01" }],
    activities: activities.map((activity, index) => ({
      ...activity,
      id: String(index),
      userId: "saanvi",
      date: "2026-10-03",
    })),
  });
  const flowers = (activities: Pick<Activity, "activityType" | "hours">[]) =>
    deriveVolunteers(entries(activities), "2026-10-03")[0]?.flowers;

  it("maps each service category to its flower", () => {
    expect(ACTIVITY_TYPES.map((type) => FLOWERS[type].name)).toEqual([
      "Daisy",
      "Sunflower",
      "Lavender",
      "Tulip",
      "Rose",
    ]);
    expect(flowers(ACTIVITY_TYPES.map((activityType) => ({ activityType, hours: 2 })))).toEqual({
      research: 1,
      tutoring: 1,
      environmental: 1,
      "community service": 1,
      management: 1,
    });
  });

  it("carries category-hour remainders toward the next flower", () => {
    expect(
      flowers([
        { activityType: "research", hours: 1 },
        { activityType: "research", hours: 1.5 },
        { activityType: "research", hours: 1.5 },
      ])?.research,
    ).toBe(2);
  });

  it("maps legacy mentoring entries to tutoring flowers", () => {
    expect(
      flowers([
        { activityType: "GirlHacks", hours: 4 },
        { activityType: "Mentoring", hours: 2 },
        { activityType: "Community Service", hours: 2 },
      ]),
    ).toEqual({
      research: 0,
      tutoring: 1,
      environmental: 0,
      "community service": 1,
      management: 0,
    });
  });
});

describe("grove tree spacing", () => {
  it("moves colliding volunteer positions apart while keeping Saanvi anchored", () => {
    const positioned = spaceVolunteers([
      { id: "alex", name: "Alex", x: 0.5, y: 0.55, joinedAt: "2026-01-01" },
      { id: "saanvi", name: "Saanvi", x: 0.5, y: 0.55, joinedAt: "2026-01-01" },
      { id: "maya", name: "Maya", x: 0.5, y: 0.55, joinedAt: "2026-01-01" },
    ]);

    expect(positioned[1]).toMatchObject({ x: 0.5, y: 0.55 });
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        expect(Math.hypot(positioned[i]!.x - positioned[j]!.x, (positioned[i]!.y - positioned[j]!.y) * 1.5)).toBeGreaterThanOrEqual(MIN_TREE_SPACING);
      }
    }
  });
});
