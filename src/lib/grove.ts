/** Form-ready data and deterministic layout for an enchanted grove.
 * One person produces one plant; hours map linearly to height and are capped
 * at the configured maximum. Keep this module independent of the form vendor
 * and rendering library.
 */
export interface GrovePerson {
  /** Stable person identifier from the form or its adapter. */
  id: string;
  /** Submitted hours. Invalid, negative, or non-finite values are rejected. */
  hours: number;
  /** Optional display name; never used as the identity key. */
  name?: string;
}

export interface GroveScale {
  minHeight: number;
  maxHeight: number;
  /** Hours at which a plant reaches maxHeight. */
  hoursAtMaxHeight: number;
}

export interface GrovePlant extends GrovePerson {
  height: number;
  position: [number, number, number];
}

export function plantHeight(hours: number, scale: GroveScale): number {
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError('hours must be a finite, non-negative number');
  }
  if (!Number.isFinite(scale.minHeight) || !Number.isFinite(scale.maxHeight) ||
      scale.maxHeight < scale.minHeight || !Number.isFinite(scale.hoursAtMaxHeight) ||
      scale.hoursAtMaxHeight <= 0) {
    throw new RangeError('scale requires finite heights and hoursAtMaxHeight > 0');
  }
  const progress = Math.min(hours / scale.hoursAtMaxHeight, 1);
  return scale.minHeight + progress * (scale.maxHeight - scale.minHeight);
}

function hashId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Build one stable plant per person. Duplicate IDs collapse to the last form
 * record, allowing updated hours to change that person's existing plant.
 * Coordinates are deterministic for an ID so refreshes preserve placement.
 */
export function buildGrove(people: readonly GrovePerson[], scale: GroveScale): GrovePlant[] {
  const unique = new Map<string, GrovePerson>();
  for (const person of people) {
    if (!person.id.trim()) throw new Error('each person needs a stable, non-empty id');
    unique.set(person.id, person);
  }

  return [...unique.values()].map((person) => {
    const hash = hashId(person.id);
    const angle = (hash / 0x1_0000_0000) * Math.PI * 2;
    // Spread IDs across a disk; deterministic per person, independent of list order.
    const radius = 3 + Math.sqrt((hashId(`${person.id}:radius`) / 0x1_0000_0000)) * 30;
    return {
      ...person,
      height: plantHeight(person.hours, scale),
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
    };
  });
}
