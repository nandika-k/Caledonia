import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import {
  createDeerHerd,
  isDeerGroundSafe,
  moveDeer,
  type GroundPoint,
} from "@/lib/grove/deerMovement";

// Build the faceted parts once. Every animal shares the geometry and materials.
function piece(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  geometry.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);
  return geometry;
}

function combine(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}

const G = {
  body: combine([
    piece(new THREE.BoxGeometry(0.55, 0.52, 1.05), 0, 1.17, -0.12),
    piece(new THREE.ConeGeometry(0.18, 0.42, 4), 0, 1.09, -0.81, Math.PI / 2),
    piece(new THREE.BoxGeometry(0.29, 0.5, 0.32), 0, 1.47, 0.34, -0.27),
  ]),
  belly: piece(new THREE.BoxGeometry(0.47, 0.075, 0.78), 0, 0.88, -0.06),
  spots: combine(
    Array.from({ length: 6 }, (_, i) =>
      piece(
        new THREE.BoxGeometry(0.095, 0.018, 0.12),
        i % 2 ? 0.18 : -0.18,
        1.442,
        -0.49 + Math.floor(i / 2) * 0.29,
      ),
    ),
  ),
  head: combine([
    piece(new THREE.BoxGeometry(0.36, 0.32, 0.42), 0, 0, 0.13),
    piece(new THREE.ConeGeometry(0.11, 0.25, 4), -0.24, 0.11, 0.08, 0, 0, -0.7),
    piece(new THREE.ConeGeometry(0.11, 0.25, 4), 0.24, 0.11, 0.08, 0, 0, 0.7),
  ]),
  muzzle: piece(new THREE.BoxGeometry(0.24, 0.12, 0.27), 0, -0.11, 0.39),
  leg: piece(new THREE.BoxGeometry(0.115, 0.72, 0.14), 0, -0.36, 0),
  hoof: piece(new THREE.BoxGeometry(0.14, 0.11, 0.19), 0, -0.7, 0.025),
  antlers: combine(
    [-1, 1].flatMap((side) => [
      piece(new THREE.ConeGeometry(0.045, 0.5, 4), side * 0.14, 0.4, 0.04, 0, 0, -side * 0.22),
      piece(new THREE.ConeGeometry(0.035, 0.25, 4), side * 0.26, 0.55, 0.12, 0.55, 0, -side * 0.65),
    ]),
  ),
};

const M = {
  fur: new THREE.MeshStandardMaterial({
    color: "#947862",
    roughness: 1,
    flatShading: true,
    emissive: "#625345",
    emissiveIntensity: 0.42,
  }),
  light: new THREE.MeshStandardMaterial({
    color: "#c2ad94",
    roughness: 1,
    flatShading: true,
    emissive: "#776b5a",
    emissiveIntensity: 0.12,
  }),
  spots: new THREE.MeshStandardMaterial({ color: "#d3c4a7", roughness: 1, flatShading: true }),
  hoof: new THREE.MeshStandardMaterial({ color: "#453d36", roughness: 1, flatShading: true }),
  rim: new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying float vRim;
      void main() {
        vec3 normalView = normalize(normalMatrix * normal);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vRim = pow(1.0 - abs(dot(normalView, normalize(-viewPosition.xyz))), 3.0);
        gl_Position = projectionMatrix * viewPosition;
      }`,
    fragmentShader: `varying float vRim;
      void main() { gl_FragColor = vec4(0.32, 0.26, 0.17, vRim * 0.2); }`,
  }),
};

function Deer({
  state,
  motion,
}: {
  state: ReturnType<typeof createDeerHerd>[number];
  motion: React.RefObject<boolean>;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const grazeTime = useRef(0);

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (!root.current || !head.current) return;
    root.current.position.set(state.x, 0, state.z);
    root.current.rotation.y = state.heading;
    if (motion.current) {
      head.current.rotation.x = 0;
      for (const leg of legs.current) if (leg) leg.rotation.x = 0;
      return;
    }
    const near = camera.position.distanceToSquared(root.current.position) < 30 * 30;
    for (let i = 0; i < 4; i++) {
      const leg = legs.current[i];
      if (leg)
        leg.rotation.x =
          near && state.walking
            ? Math.sin(state.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.28
            : 0;
    }
    grazeTime.current += dt;
    const grazing =
      !state.walking && state.pause > 0.9 && Math.sin(grazeTime.current * 0.7 + state.seed) > 0.3;
    // Drinking dips the head deeper toward the water than grazing.
    const dip = state.drinking ? 0.78 : grazing ? 0.4 : 0;
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, dip, 2, dt);
  });

  return (
    <group ref={root} position={[state.x, 0, state.z]} rotation-y={state.heading} scale={1.45}>
      <mesh geometry={G.body} material={M.fur} castShadow />
      <mesh geometry={G.body} material={M.rim} scale={1.025} />
      <mesh geometry={G.belly} material={M.light} />
      <mesh geometry={G.spots} material={M.spots} />
      <group ref={head} position={[0, 1.76, 0.46]}>
        <mesh geometry={G.head} material={M.fur} castShadow />
        <mesh geometry={G.head} material={M.rim} scale={1.025} />
        <mesh geometry={G.muzzle} material={M.light} />
        {state.antlers && <mesh geometry={G.antlers} material={M.light} />}
      </group>
      {([-1, 1] as const).flatMap((side) =>
        [-0.46, 0.28].map((z, index) => {
          const i = (side === -1 ? 0 : 2) + index;
          return (
            <group
              key={i}
              ref={(node) => {
                legs.current[i] = node;
              }}
              position={[side * 0.19, 0.84, z]}
            >
              <mesh geometry={G.leg} material={M.fur} castShadow />
              <mesh geometry={G.hoof} material={M.hoof} />
            </group>
          );
        }),
      )}
    </group>
  );
}

export function DeerHerd({
  trees,
  rocks,
  focus,
}: {
  trees: GroundPoint[];
  rocks: GroundPoint[];
  focus: GroundPoint | null;
}) {
  // The scene is client-only; listen for preference changes while it is open.
  const motion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      motion.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const herd = useMemo(() => createDeerHerd(trees, rocks, null), [trees, rocks]);
  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    for (let i = 0; i < herd.length; i++) {
      const deer = herd[i];
      if (!deer) continue;
      if (!isDeerGroundSafe(deer, trees, rocks, focus)) {
        // A newly focused tree might be close to a deer: move that deer to a free glade.
        const replacement = createDeerHerd(trees, rocks, focus, i + 1)[i];
        if (replacement) {
          deer.x = replacement.x;
          deer.z = replacement.z;
          deer.target = null;
          deer.pause = 3;
        }
        continue;
      }
      if (motion.current) continue;
      if (Math.hypot(deer.x - camera.position.x, deer.z - camera.position.z) < 7) continue;
      moveDeer(deer, dt, trees, rocks, focus);
    }
  });
  return (
    <group>
      {herd.map((deer, i) => (
        <Deer key={i} state={deer} motion={motion} />
      ))}
    </group>
  );
}
