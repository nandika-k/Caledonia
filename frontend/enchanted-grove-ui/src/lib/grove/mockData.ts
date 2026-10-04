import { ACTIVITY_TYPES } from "./config";
import { MIN_TREE_SPACING } from "./layout";
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
  ["Saanvi", 24.5], ["Jen", 8], ["Hannah", 42], ["Prajwal", 15], ["Tyler", 3],
  ["Assaf", 31], ["Simon", 12], ["Cela", 52], ["Nidhi", 1], ["Patchi", 19],
  ["Andrew Gykobo", 10], ["Yash Shah", 27], ["Mengjia Xu", 2], ["Lei Zhang", 36], ["Keita Ohshiro", 9],
  ["Matt Toegel", 22], ["Jaini Bhavsar", 4], ["Shuai Zhang", 14], ["Sheshananda  Kandula", 0], ["Mahendar Mangalasri", 45],
  ["Wen He", 11], ["Adam Spryszynski", 17], ["Rosemina Vohra", 1.5], ["Bharat Lohiya", 33], ["Omar Woodruff", 27],
  ["Alice Woodruff", 27], ["Pantelis Monogioudis", 12], ["Thomas Licciardello", 32], ["Pradeep Vontisubramanyam", 24],
  ["Kamlesh Naik", 30], ["DJ Kehoe", 28], ["Jennifer Farley", 23], ["Keith Williams", 28]
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
      if (placed.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.5) >= MIN_TREE_SPACING)) break;
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
