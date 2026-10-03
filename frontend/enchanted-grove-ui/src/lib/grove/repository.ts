import { createMockGrove } from "./mockData";
import type { Activity, GroveData, VolunteerRecord } from "./types";

/** Swap this implementation to connect a real (e.g. Highlander) data source. */
export interface GroveRepository {
  load(): GroveData;
  addActivity(activity: Activity): GroveData;
  addVolunteer(volunteer: VolunteerRecord): GroveData;
}

const KEY = "enchanted-grove:v1";

export class LocalGroveRepository implements GroveRepository {
  load(): GroveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as GroveData;
    } catch {
      /* ignore */
    }
    const data = createMockGrove();
    this.save(data);
    return data;
  }
  addActivity(activity: Activity): GroveData {
    const data = this.load();
    const next = { ...data, activities: [...data.activities, activity] };
    this.save(next);
    return next;
  }
  addVolunteer(volunteer: VolunteerRecord): GroveData {
    const data = this.load();
    if (data.volunteers.some((existing) => existing.id === volunteer.id)) return data;
    const next = { ...data, volunteers: [...data.volunteers, volunteer] };
    this.save(next);
    return next;
  }
  private save(data: GroveData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
}
