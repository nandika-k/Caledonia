import { describe, expect, it } from "vitest";
import { applyFilters, groupOpportunities, imageFor } from "./logic";
import { mockOpportunities } from "./mockOpportunities";
import { DEFAULT_FILTERS } from "./types";

const groups = groupOpportunities(mockOpportunities);
const now = new Date("2026-10-04T09:00:00-04:00");

describe("opportunities", () => {
  it("groups Fall Campus Cleanup and ACM Cleanup into one card with both sources", () => {
    const g = groups.find((x) => x.members.some((m) => m.id === "7ka9qp"))!;
    expect(g.primary.title).toBe("Fall Campus Cleanup");
    expect(g.sources.map((s) => s.source)).toEqual(["Highlander Hub", "Discord"]);
    expect(groups.length).toBe(mockOpportunities.length - 1);
  });

  it("combines search, category and source filters", () => {
    const r = applyFilters(
      groups,
      { ...DEFAULT_FILTERS, query: "ACM", category: "environmental", source: "Discord" },
      now,
    );
    expect(r.map((g) => g.primary.id)).toEqual(["mb53qf"]);
  });

  it("today filter only keeps events today", () => {
    const r = applyFilters(groups, { ...DEFAULT_FILTERS, date: "today" }, now);
    expect(r.map((g) => g.primary.id)).toEqual(["e3garden"]);
  });

  it("uses the category fallback when no image is provided", () => {
    const o = mockOpportunities.find((m) => m.id === "e3garden")!;
    expect(imageFor(o)).toContain("unsplash");
  });
});
