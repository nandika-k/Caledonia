// Tunable rules for how volunteer hours map to trees and milestones.
// Edit these arrays to change thresholds; nothing else hard-codes them.

export type TreeLevel = "seedling" | "small" | "growing" | "mature" | "enchanted";

export interface TreeLevelRule {
  level: TreeLevel;
  label: string;
  /** Minimum hours (inclusive) to reach this level. */
  minHours: number;
  /** Visual scale multiplier in the Grove. */
  scale: number;
}

export const TREE_LEVELS: TreeLevelRule[] = [
  { level: "seedling", label: "Seedling", minHours: 0, scale: 0.35 },
  { level: "small", label: "Small Tree", minHours: 0.01, scale: 0.6 },
  { level: "growing", label: "Growing Tree", minHours: 6, scale: 0.85 },
  { level: "mature", label: "Mature Tree", minHours: 16, scale: 1.1 },
  { level: "enchanted", label: "Enchanted Tree", minHours: 31, scale: 1.4 },
];

export function getTreeLevel(hours: number): TreeLevelRule {
  let result = TREE_LEVELS[0]!;
  for (const rule of TREE_LEVELS) if (hours >= rule.minHours) result = rule;
  return result;
}

/** Continuous size so trees within a level still differ a little. */
export function getTreeScale(hours: number): number {
  const base = getTreeLevel(hours).scale;
  return base + Math.min(hours, 80) * 0.004;
}

export interface MilestoneRule {
  id: string;
  icon: string;
  label: string;
  minHours: number;
}

export const MILESTONES: MilestoneRule[] = [
  { id: "first", icon: "🌱", label: "First Contribution", minHours: 0.01 },
  { id: "h10", icon: "🌿", label: "10 Hours", minHours: 10 },
  { id: "h25", icon: "🌳", label: "25 Hours", minHours: 25 },
  { id: "h50", icon: "✨", label: "50 Hours", minHours: 50 },
];

export function getMilestones(hours: number): MilestoneRule[] {
  return MILESTONES.filter((m) => hours >= m.minHours);
}

export const ACTIVITY_TYPES = [
  "research",
  "tutoring",
  "environmental",
  "community service",
  "management",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type LegacyActivityType =
  "GirlHacks" | "Event Support" | "Mentoring" | "Community Service" | "Workshop" | "Other";
export type StoredActivityType = ActivityType | LegacyActivityType;

export const FLOWER_HOURS = 2;
export const FLOWERS: Record<ActivityType, { name: string; meaning: string }> = {
  research: { name: "Daisy", meaning: "Discovery and curiosity" },
  tutoring: { name: "Sunflower", meaning: "Helping others learn" },
  environmental: { name: "Lavender", meaning: "Caring for nature" },
  "community service": { name: "Tulip", meaning: "Strengthening the community" },
  management: { name: "Rose", meaning: "Leading and coordinating service" },
};

export function flowerCategory(type: StoredActivityType): ActivityType | null {
  if (type === "Mentoring") return "tutoring";
  if (type === "Community Service") return "community service";
  return (ACTIVITY_TYPES as readonly string[]).includes(type) ? (type as ActivityType) : null;
}
