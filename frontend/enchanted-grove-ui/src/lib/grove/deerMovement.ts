/** Lightweight, deterministic ground navigation for the decorative herd. */
import { SPRING_CLEAR_RADIUS, SPRING_POSITION } from "./placement";

export type GroundPoint = { x: number; z: number };
export type DeerState = GroundPoint & {
  heading: number;
  target: GroundPoint | null;
  pause: number;
  stride: number;
  walking: boolean;
  antlers: boolean;
  seed: number;
  drinks: boolean;
  drinking: boolean;
};

const LIMIT_X = 29;
const LIMIT_Z = 19;
const SPRING_RADIUS = SPRING_CLEAR_RADIUS + 1;
const TREE_RADIUS = 2.5;
const ROCK_RADIUS = 1.3;
const FOCUS_RADIUS = 7;

function distance(a: GroundPoint, b: GroundPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function randomStep(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function next(deer: DeerState) {
  deer.seed = randomStep(deer.seed);
  return deer.seed / 4294967296;
}

export function isDeerGroundSafe(
  point: GroundPoint,
  trees: GroundPoint[],
  rocks: GroundPoint[],
  focus: GroundPoint | null,
) {
  if (Math.abs(point.x) > LIMIT_X || Math.abs(point.z) > LIMIT_Z) return false;
  if (Math.hypot(point.x - SPRING_POSITION[0], point.z - SPRING_POSITION[2]) < SPRING_RADIUS)
    return false;
  if (focus && distance(point, focus) < FOCUS_RADIUS) return false;
  if (trees.some((tree) => distance(point, tree) < TREE_RADIUS)) return false;
  if (rocks.some((rock) => distance(point, rock) < ROCK_RADIUS)) return false;
  return true;
}

export function isDeerRouteSafe(
  from: GroundPoint,
  to: GroundPoint,
  trees: GroundPoint[],
  rocks: GroundPoint[],
  focus: GroundPoint | null,
) {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.7));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (
      !isDeerGroundSafe(
        { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t },
        trees,
        rocks,
        focus,
      )
    )
      return false;
  }
  return true;
}

export function createDeerHerd(
  trees: GroundPoint[],
  rocks: GroundPoint[],
  focus: GroundPoint | null,
  count = 5,
): DeerState[] {
  const herd: DeerState[] = [];
  for (let i = 0; i < count; i++) {
    const deer: DeerState = {
      x: 0,
      z: 0,
      heading: 0,
      target: null,
      pause: 2 + i * 0.4,
      stride: 0,
      walking: false,
      antlers: i % 3 === 0,
      seed: 2026 + i * 4831,
      drinks: i % 2 === 0,
      drinking: false,
    };
    for (let attempt = 0; attempt < 600; attempt++) {
      const candidate = {
        x: (next(deer) * 2 - 1) * (LIMIT_X - 2),
        z: (next(deer) * 2 - 1) * (LIMIT_Z - 2),
      };
      if (
        isDeerGroundSafe(candidate, trees, rocks, focus) &&
        herd.every((other) => distance(other, candidate) > 5)
      ) {
        deer.x = candidate.x;
        deer.z = candidate.z;
        deer.heading = next(deer) * Math.PI * 2;
        herd.push(deer);
        break;
      }
    }
  }
  return herd;
}

export function moveDeer(
  deer: DeerState,
  dt: number,
  trees: GroundPoint[],
  rocks: GroundPoint[],
  focus: GroundPoint | null,
) {
  const delta = Math.min(dt, 0.05);
  if (!isDeerGroundSafe(deer, trees, rocks, focus)) {
    deer.target = null;
    deer.walking = false;
    deer.drinking = false;
    return;
  }
  if (deer.pause > 0) {
    deer.pause = Math.max(0, deer.pause - delta);
    deer.walking = false;
    if (deer.pause === 0) deer.drinking = false;
    return;
  }
  if (!deer.target) {
    if (deer.drinks && next(deer) < 0.3) {
      const angle = next(deer) * Math.PI * 2;
      const radius = SPRING_RADIUS + 0.7 + next(deer) * 0.6;
      const target = {
        x: SPRING_POSITION[0] + Math.cos(angle) * radius,
        z: SPRING_POSITION[2] + Math.sin(angle) * radius,
      };
      if (isDeerRouteSafe(deer, target, trees, rocks, focus)) deer.target = target;
    }
    if (!deer.target) {
      for (let attempt = 0; attempt < 32; attempt++) {
        const angle = next(deer) * Math.PI * 2;
        const length = 2 + next(deer) * 5;
        const target = {
          x: deer.x + Math.cos(angle) * length,
          z: deer.z + Math.sin(angle) * length,
        };
        if (isDeerRouteSafe(deer, target, trees, rocks, focus)) {
          deer.target = target;
          break;
        }
      }
    }
    if (!deer.target) {
      deer.pause = 2 + next(deer) * 3;
      return;
    }
  }
  const dx = deer.target.x - deer.x;
  const dz = deer.target.z - deer.z;
  const remaining = Math.hypot(dx, dz);
  if (remaining < 0.18) {
    const atSpring =
      deer.drinks &&
      Math.hypot(deer.x - SPRING_POSITION[0], deer.z - SPRING_POSITION[2]) < SPRING_RADIUS + 2;
    deer.target = null;
    deer.pause = atSpring ? 4 + next(deer) * 3 : 2 + next(deer) * 3;
    deer.drinking = atSpring;
    deer.walking = false;
    if (atSpring)
      deer.heading = Math.atan2(SPRING_POSITION[0] - deer.x, SPRING_POSITION[2] - deer.z);
    return;
  }
  const desired = Math.atan2(dx, dz);
  const turn = Math.atan2(Math.sin(desired - deer.heading), Math.cos(desired - deer.heading));
  deer.heading += Math.max(-1.8 * delta, Math.min(1.8 * delta, turn));
  if (Math.abs(turn) < 0.35) {
    const step = Math.min(remaining, delta * 0.85);
    deer.x += (dx / remaining) * step;
    deer.z += (dz / remaining) * step;
    deer.stride += step * 5.5;
    deer.walking = true;
  } else deer.walking = false;
}
