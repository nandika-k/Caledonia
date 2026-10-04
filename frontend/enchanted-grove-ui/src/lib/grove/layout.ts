import type { VolunteerRecord } from "./types";
import { isInSpringClearing } from "./placement";

/** Minimum center-to-center tree spacing in normalized grove coordinates. */
export const MIN_TREE_SPACING = 0.2;

const X_BOUNDS = [0.04, 0.96] as const;
const Y_BOUNDS = [0.14, 0.92] as const;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const WORLD_SIZE_X = 64;
const WORLD_SIZE_Z = 44;

function distance(a: Pick<VolunteerRecord, "x" | "y">, b: Pick<VolunteerRecord, "x" | "y">) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 1.5);
}

function isInside(x: number, y: number) {
  return x >= X_BOUNDS[0] && x <= X_BOUNDS[1] && y >= Y_BOUNDS[0] && y <= Y_BOUNDS[1];
}

function clearsSpring(x: number, y: number) {
  const worldX = (x - 0.5) * WORLD_SIZE_X;
  const worldZ = (y - 0.5) * WORLD_SIZE_Z;
  return !isInSpringClearing(worldX, worldZ);
}

/** Preserve stored positions where possible and move colliding trees to nearby open ground. */
export function spaceVolunteers<T extends VolunteerRecord>(volunteers: T[]): T[] {
  const placed: VolunteerRecord[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  const ordered = [...volunteers].sort(
    (a, b) => Number(b.id === "saanvi") - Number(a.id === "saanvi"),
  );

  for (const volunteer of ordered) {
    const origin = {
      x: Math.min(X_BOUNDS[1], Math.max(X_BOUNDS[0], volunteer.x)),
      y: Math.min(Y_BOUNDS[1], Math.max(Y_BOUNDS[0], volunteer.y)),
    };
    let position = origin;
    const hasRoom = (candidate: { x: number; y: number }) =>
      isInside(candidate.x, candidate.y) &&
      clearsSpring(candidate.x, candidate.y) &&
      placed.every((other) => distance(candidate, other) >= MIN_TREE_SPACING);

    if (!hasRoom(position)) {
      const idSeed = [...volunteer.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      let found = false;
      for (let attempt = 1; attempt <= 2400; attempt++) {
        const radius = 0.008 + 0.006 * Math.sqrt(attempt);
        const angle = idSeed + attempt * GOLDEN_ANGLE;
        const candidate = {
          x: origin.x + Math.cos(angle) * radius,
          y: origin.y + (Math.sin(angle) * radius) / 1.5,
        };
        if (hasRoom(candidate)) {
          position = candidate;
          found = true;
          break;
        }
      }

      if (!found) {
        let bestDistance = -1;
        for (let x = X_BOUNDS[0]; x <= X_BOUNDS[1]; x += 0.02) {
          for (let y = Y_BOUNDS[0]; y <= Y_BOUNDS[1]; y += 0.02) {
            const candidate = { x, y };
            if (!clearsSpring(candidate.x, candidate.y)) continue;
            const nearest = placed.length
              ? Math.min(...placed.map((other) => distance(candidate, other)))
              : Infinity;
            if (nearest > bestDistance) {
              bestDistance = nearest;
              position = candidate;
            }
          }
        }
      }
    }

    placed.push({ ...volunteer, ...position });
    positions.set(volunteer.id, position);
  }

  return volunteers.map((volunteer) => ({ ...volunteer, ...positions.get(volunteer.id)! }));
}
