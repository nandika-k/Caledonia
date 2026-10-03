import type { ActivityType } from "./config";

/** Stored identity. Replace the data source with NJIT Highlander data later. */
export interface VolunteerRecord {
  id: string;
  name: string;
  /** Position in the Grove world (0–1 normalized). */
  x: number;
  y: number;
  joinedAt: string; // ISO date
}

export interface Activity {
  id: string;
  userId: string;
  hours: number;
  activityType: ActivityType;
  date: string; // YYYY-MM-DD
  description?: string | undefined;
}

/** Derived view used by the UI. */
export interface Volunteer extends VolunteerRecord {
  volunteerHours: number;
  activityCount: number;
  currentStreak: number;
  milestones: string[];
  treeLevel: string;
}

export interface GroveData {
  volunteers: VolunteerRecord[];
  activities: Activity[];
}
