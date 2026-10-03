import { getMilestones, getTreeLevel } from "./config";
import type { Activity, GroveData, Volunteer } from "./types";

export function computeStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  const d = new Date(today + "T00:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1); // allow streak through yesterday
  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export function deriveVolunteers(data: GroveData, today: string): Volunteer[] {
  const byUser = new Map<string, Activity[]>();
  for (const a of data.activities) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }
  return data.volunteers.map((v) => {
    const acts = byUser.get(v.id) ?? [];
    const hours = Math.round(acts.reduce((s, a) => s + a.hours, 0) * 10) / 10;
    return {
      ...v,
      volunteerHours: hours,
      activityCount: acts.length,
      currentStreak: computeStreak(acts.map((a) => a.date), today),
      milestones: getMilestones(hours).map((m) => m.id),
      treeLevel: getTreeLevel(hours).level,
    };
  });
}

export function groveStats(data: GroveData, today: string) {
  const total = data.activities.reduce((s, a) => s + a.hours, 0);
  const month = today.slice(0, 7);
  const thisMonth = data.activities.filter((a) => a.date.startsWith(month)).reduce((s, a) => s + a.hours, 0);
  const before = total - thisMonth;
  return {
    volunteers: data.volunteers.length,
    totalHours: Math.round(total * 10) / 10,
    activities: data.activities.length,
    growth: before > 0 ? Math.round((thisMonth / before) * 100) : 0,
  };
}
