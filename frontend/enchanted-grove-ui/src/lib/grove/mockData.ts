import { ACTIVITY_TYPES } from "./config";
import type { Activity, GroveData, VolunteerRecord } from "./types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED: [string, number][] = [
  ["Saanvi", 24.5], ["Alex", 8], ["Priya", 42], ["Maya", 15], ["Daniel", 3],
  ["Sarah", 31], ["Jordan", 12], ["Aisha", 52], ["Leah", 0], ["Nina", 19],
  ["Omar", 6], ["Grace", 27], ["Ivy", 2], ["Zara", 36], ["Ethan", 9],
  ["Mei", 22], ["Rosa", 4], ["Kiara", 14], ["Noah", 0], ["Fatima", 45],
  ["Lily", 11], ["Sofia", 17], ["Hannah", 1.5], ["Ananya", 33], ["Chloe", 7],
  ["Ruby", 26], ["Jasmine", 5], ["Elena", 60],
];

export function createMockGrove(): GroveData {
  const rand = mulberry32(2026);
  const volunteers: VolunteerRecord[] = [];
  const activities: Activity[] = [];
  const placed: { x: number; y: number }[] = [];

  SEED.forEach(([name, hours], i) => {
    // Poisson-ish placement so trees don't overlap.
    let x = 0, y = 0;
    for (let tries = 0; tries < 60; tries++) {
      x = 0.08 + rand() * 0.84;
      y = 0.18 + rand() * 0.72;
      if (placed.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.5) > 0.11)) break;
    }
    if (name === "Saanvi") { x = 0.5; y = 0.55; }
    placed.push({ x, y });
    const id = name.toLowerCase();
    const joinMonth = 6 + Math.floor(rand() * 3); // Jul–Sep
    volunteers.push({ id, name, x, y, joinedAt: `2026-${String(joinMonth + 1).padStart(2, "0")}-0${1 + (i % 9)}` });

    let remaining = hours;
    let n = 0;
    while (remaining > 0) {
      const chunk = Math.min(remaining, Math.round((1 + rand() * 5) * 2) / 2);
      remaining = Math.round((remaining - chunk) * 10) / 10;
      const day = new Date(Date.UTC(2026, 6, 1) + Math.floor(rand() * 90) * 86400000);
      if (id === "saanvi" && n < 3) day.setTime(Date.UTC(2026, 9, 3 - n));
      activities.push({
        id: `${id}-${n}`,
        userId: id,
        hours: chunk,
        activityType: ACTIVITY_TYPES[Math.floor(rand() * ACTIVITY_TYPES.length)]!,
        date: day.toISOString().slice(0, 10),
      });
      n++;
    }
  });

  return { volunteers, activities };
}
