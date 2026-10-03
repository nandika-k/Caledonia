import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createMockGrove } from "./mockData";
import { LocalGroveRepository } from "./repository";
import { deriveVolunteers, groveStats } from "./stats";
import type { Activity, GroveData } from "./types";

const repo = new LocalGroveRepository();
const serverSnapshot = createMockGrove();
let state: GroveData | null = null;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (!state) state = repo.load();
  return state;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function useGrove() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const today = todayISO();
  const volunteers = useMemo(() => deriveVolunteers(data, today), [data, today]);
  const stats = useMemo(() => groveStats(data, today), [data, today]);
  const addActivity = useCallback((a: Omit<Activity, "id">) => {
    state = repo.addActivity({ ...a, id: `${a.userId}-${Date.now()}` });
    listeners.forEach((l) => l());
  }, []);
  const ensureVolunteer = useCallback((id: string, name: string) => {
    const hash = [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const x = 0.08 + (hash % 8400) / 10000;
    const y = 0.18 + ((Math.imul(hash, 2654435761) >>> 0) % 7200) / 10000;
    state = repo.addVolunteer({ id, name, x, y, joinedAt: todayISO() });
    listeners.forEach((l) => l());
  }, []);
  return { volunteers, stats, addActivity, ensureVolunteer };
}
