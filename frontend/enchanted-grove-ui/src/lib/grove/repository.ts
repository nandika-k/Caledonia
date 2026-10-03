import { createMockGrove } from "./mockData";
import type { Activity, GroveData } from "./types";

/** Swap this implementation to connect a real (e.g. Highlander) data source. */
export interface GroveRepository {
  load(): GroveData;
  addActivity(activity: Activity): GroveData;
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
  private save(data: GroveData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
}
