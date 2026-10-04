/** The spring sits behind the volunteer trees, off the central sightline. */
export const SPRING_POSITION: [number, number, number] = [6, 0, -12];
export const SPRING_CLEAR_RADIUS = 8.5;

export function isInSpringClearing(x: number, z: number) {
  return Math.hypot(x - SPRING_POSITION[0], z - SPRING_POSITION[2]) < SPRING_CLEAR_RADIUS;
}
