import { describe, expect, it } from "vitest";
import { createDeerHerd, isDeerGroundSafe, isDeerRouteSafe, moveDeer } from "./deerMovement";
import { SPRING_CLEAR_RADIUS, SPRING_POSITION } from "./placement";

describe("deer wandering", () => {
  it("spawns five animals in safe open ground, with about one in three antlered", () => {
    const trees = [{ x: 0, z: 3 }];
    const rocks = [{ x: -8, z: 3 }];
    const herd = createDeerHerd(trees, rocks, { x: 15, z: 3 });
    expect(herd).toHaveLength(5);
    expect(herd.filter((deer) => deer.antlers)).toHaveLength(2);
    expect(herd.every((deer) => isDeerGroundSafe(deer, trees, rocks, { x: 15, z: 3 }))).toBe(true);
  });

  it("rejects routes that cross a trunk, rock, or focused tree", () => {
    expect(isDeerRouteSafe({ x: -5, z: 3 }, { x: 5, z: 3 }, [{ x: 0, z: 3 }], [], null)).toBe(
      false,
    );
    expect(isDeerRouteSafe({ x: -5, z: 3 }, { x: 5, z: 3 }, [], [{ x: 0, z: 3 }], null)).toBe(
      false,
    );
    expect(isDeerRouteSafe({ x: -10, z: 3 }, { x: 10, z: 3 }, [], [], { x: 0, z: 3 })).toBe(false);
  });

  it("lets some deer drink at the spring edge and lower their heads", () => {
    const herd = createDeerHerd([], [], null);
    expect(herd.some((deer) => deer.drinks)).toBe(true);
    expect(herd.some((deer) => !deer.drinks)).toBe(true);
    const drinker = herd.find((deer) => deer.drinks);
    expect(drinker).toBeDefined();
    if (!drinker) return;
    let drank = false;
    for (let i = 0; i < 20000 && !drank; i++) {
      moveDeer(drinker, 0.05, [], [], null);
      drank = drinker.drinking;
    }
    expect(drank).toBe(true);
    expect(
      Math.hypot(drinker.x - SPRING_POSITION[0], drinker.z - SPRING_POSITION[2]),
    ).toBeGreaterThanOrEqual(SPRING_CLEAR_RADIUS + 1);
    for (let i = 0; i < 2000; i++) moveDeer(drinker, 0.05, [], [], null);
    expect(drinker.drinking).toBe(false);
  });

  it("pauses before walking and stays grounded in open clearings", () => {
    const deer = createDeerHerd([], [], null, 1)[0];
    expect(deer).toBeDefined();
    if (!deer) return;
    const start = { x: deer.x, z: deer.z };
    moveDeer(deer, 0.05, [], [], null);
    expect({ x: deer.x, z: deer.z }).toEqual(start);
    for (let i = 0; i < 1000; i++) moveDeer(deer, 0.05, [], [], null);
    expect(isDeerGroundSafe(deer, [], [], null)).toBe(true);
    expect(Math.hypot(deer.x - start.x, deer.z - start.z)).toBeGreaterThan(0);
  });
});
