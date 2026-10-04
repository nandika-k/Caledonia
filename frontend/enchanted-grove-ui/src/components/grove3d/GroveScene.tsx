import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Volunteer } from "@/lib/grove/types";
import { getTreeLevel, getTreeScale } from "@/lib/grove/config";
import { SPRING_POSITION } from "@/lib/grove/placement";
import { ForestTrees } from "./Tree3D";
import { Waterfall } from "./Waterfall3D";
import { DeerHerd } from "./Deer3D";
import { RotateCcw, RotateCw } from "lucide-react";

const SIZE_X = 64;
const SIZE_Z = 44;
export const toWorld = (v: { x: number; y: number }): [number, number, number] => [
  (v.x - 0.5) * SIZE_X,
  0,
  (v.y - 0.5) * SIZE_Z,
];

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** Instanced decoration: one draw call per kind, no matter how many. */
function Instanced({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: { p: [number, number, number]; s: number; r: number }[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    items.forEach((it, i) => {
      m.position.set(...it.p);
      m.rotation.set(0, it.r, 0);
      m.scale.setScalar(it.s);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow />
  );
}

function Environment({
  volunteers,
  focus,
}: {
  volunteers: Volunteer[];
  focus: THREE.Vector3 | null;
}) {
  const scene = useMemo(() => {
    const r = rng(7);
    const scatter = (n: number, s0: number, s1: number, y = 0) =>
      Array.from({ length: n }, () => ({
        p: [(r() - 0.5) * SIZE_X * 1.3, y, (r() - 0.5) * SIZE_Z * 1.3] as [number, number, number],
        s: s0 + r() * (s1 - s0),
        r: r() * 6.28,
      }));
    const ring = Array.from({ length: 90 }, (_, i) => {
      const a = (i / 90) * Math.PI * 2;
      const rad = 46 + r() * 14;
      return {
        p: [Math.cos(a) * rad * 1.15, 0, Math.sin(a) * rad * 0.85] as [number, number, number],
        s: 2.2 + r() * 2.2,
        r: r() * 6,
      };
    });
    return {
      rocks: scatter(40, 0.3, 0.9),
      mushStems: scatter(36, 0.6, 1.2),
      flowers: scatter(220, 0.6, 1.3, 0.12),
      grass: scatter(500, 0.6, 1.4),
      ring,
      lanterns: [
        [-14, -4],
        [2, -9],
        [16, 2],
        [-6, 10],
        [10, 13],
        [-24, 7],
        [24, -10],
      ] as [number, number][],
    };
  }, []);

  const g = useMemo(
    () => ({
      rock: new THREE.DodecahedronGeometry(1, 0),
      stem: new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6).translate(0, 0.2, 0),
      cap: new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(
        0,
        0.38,
        0,
      ),
      flower: new THREE.IcosahedronGeometry(0.1, 0),
      grass: new THREE.ConeGeometry(0.05, 0.5, 3).translate(0, 0.25, 0),
      pine: new THREE.ConeGeometry(1.1, 3.5, 7).translate(0, 2.6, 0),
    }),
    [],
  );
  const m = useMemo(
    () => ({
      rock: new THREE.MeshStandardMaterial({ color: "#3b4448", roughness: 1, flatShading: true }),
      stem: new THREE.MeshStandardMaterial({ color: "#e8dcc0" }),
      cap: new THREE.MeshStandardMaterial({
        color: "#a77bff",
        emissive: "#7a4fe0",
        emissiveIntensity: 0.9,
      }),
      flower: new THREE.MeshStandardMaterial({
        color: "#c9a6ff",
        emissive: "#8f66ff",
        emissiveIntensity: 1.4,
      }),
      grass: new THREE.MeshStandardMaterial({ color: "#1f5a3a", flatShading: true }),
      pine: new THREE.MeshStandardMaterial({ color: "#173d31", flatShading: true, roughness: 1 }),
    }),
    [],
  );
  const treePoints = useMemo(
    () =>
      volunteers.map((volunteer) => {
        const [x, , z] = toWorld(volunteer);
        return { x, z };
      }),
    [volunteers],
  );
  const rockPoints = useMemo(() => scene.rocks.map(({ p }) => ({ x: p[0], z: p[2] })), [scene]);
  const focusPoint = focus ? { x: focus.x, z: focus.z } : null;

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color="#24432e" roughness={1} />
      </mesh>
      <Instanced geometry={g.rock} material={m.rock} items={scene.rocks} />
      <Instanced geometry={g.stem} material={m.stem} items={scene.mushStems} />
      <Instanced geometry={g.cap} material={m.cap} items={scene.mushStems} />
      <Instanced geometry={g.flower} material={m.flower} items={scene.flowers} />
      <Instanced geometry={g.grass} material={m.grass} items={scene.grass} />
      <Instanced geometry={g.pine} material={m.pine} items={scene.ring} />
      <DeerHerd trees={treePoints} rocks={rockPoints} focus={focusPoint} />
      {scene.lanterns.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={0.9} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 1.8, 6]} />
            <meshStandardMaterial color="#3a2a1e" />
          </mesh>
          <mesh position-y={1.95}>
            <boxGeometry args={[0.35, 0.4, 0.35]} />
            <meshStandardMaterial color="#ffd27a" emissive="#ffb84a" emissiveIntensity={2.2} />
          </mesh>
          <pointLight position-y={2} color="#ffbe6a" intensity={6} distance={9} decay={1.6} />
        </group>
      ))}
      {/* moon */}
      <mesh position={[30, 38, -70]}>
        <sphereGeometry args={[4, 32, 32]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
      <Stars radius={120} depth={30} count={1500} factor={3} fade speed={0.4} />
      <Sparkles
        count={160}
        scale={[SIZE_X, 8, SIZE_Z]}
        position-y={3}
        size={4}
        speed={0.35}
        color="#ffd77a"
      />
      <Sparkles
        count={60}
        scale={[SIZE_X, 4, SIZE_Z]}
        position-y={1.5}
        size={3}
        speed={0.2}
        color="#b48cff"
      />
    </>
  );
}

function CameraRig({
  controls,
  focus,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
  focus: THREE.Vector3 | null;
}) {
  const goal = useRef<{ t: THREE.Vector3; c: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!focus) return;
    const treeHeight = Math.max(2, focus.y * 2);
    const distance = treeHeight * 1.5 + 2;
    goal.current = {
      t: focus.clone(),
      c: focus.clone().add(new THREE.Vector3(0, distance * 0.42, distance)),
    };
  }, [focus]);
  useFrame((state, dt) => {
    const c = controls.current;
    if (!goal.current || !c) return;
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.05));
    c.target.lerp(goal.current.t, k);
    state.camera.position.lerp(goal.current.c, k);
    if (state.camera.position.distanceTo(goal.current.c) < 0.1) goal.current = null;
  });
  return null;
}

interface Props {
  volunteers: Volunteer[];
  currentUserId: string | null;
  growingId: string | null;
  focusId: string | null;
  selectedId: string | null;
  waterPlaying: boolean;
  waterSpeed: number;
  onSelect: (v: Volunteer, pt: { x: number; y: number }) => void;
  onBackground: () => void;
}

export default function GroveScene({
  volunteers,
  currentUserId,
  growingId,
  focusId,
  selectedId,
  waterPlaying,
  waterSpeed,
  onSelect,
  onBackground,
}: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const [hover, setHover] = useState<{ v: Volunteer; x: number; y: number } | null>(null);
  const focus = useMemo(() => {
    if (!focusId) return null;
    const v = volunteers.find((x) => x.id === focusId.split(":")[0]);
    if (!v) return null;
    const level = getTreeLevel(v.volunteerHours).level;
    const nominalHeight = { seedling: 2.3, small: 3.8, growing: 4.6, mature: 5.2, enchanted: 6 }[
      level
    ];
    const height = nominalHeight * getTreeScale(v.volunteerHours) * 1.15;
    const [x, , z] = toWorld(v);
    return new THREE.Vector3(x, height * 0.52, z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  const rotateView = (direction: -1 | 1) => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() - (direction * Math.PI) / 4);
    orbit.update();
  };

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 34, 52], fov: 45, near: 0.5, far: 300 }}
        onPointerMissed={() => onBackground()}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={["#070f12"]} />
        <fog attach="fog" args={["#0b1a1f", 38, 105]} />
        <hemisphereLight args={["#b6d4bd", "#28533b", 1.15]} />
        <ambientLight intensity={0.35} color="#a5c7ae" />
        <directionalLight
          position={[25, 40, -20]}
          intensity={1.65}
          color="#cce5ce"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-bias={-0.0005}
        />
        <Environment volunteers={volunteers} focus={focus} />
        <Waterfall position={SPRING_POSITION} playing={waterPlaying} speed={waterSpeed} />
        <Suspense fallback={null}>
          <ForestTrees
            volunteers={volunteers}
            currentUserId={currentUserId}
            onHover={(vol, e) =>
              setHover(
                vol && e ? { v: vol, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } : null,
              )
            }
            onClick={(vol, e) =>
              onSelect(vol, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
            }
            selectedId={selectedId}
            growingId={growingId}
          />
        </Suspense>
        {growingId &&
          (() => {
            const v = volunteers.find((x) => x.id === growingId);
            return v ? (
              <Sparkles
                key={`burst-${growingId}`}
                count={70}
                scale={[4, 7, 4]}
                position={[toWorld(v)[0], 3.5, toWorld(v)[2]]}
                size={9}
                speed={2.5}
                color="#b6f04a"
              />
            ) : null;
          })()}
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={85}
          maxPolarAngle={Math.PI / 2.15}
          minPolarAngle={0.2}
          screenSpacePanning={false}
          target={[0, 0, 0]}
          onStart={() => setHover(null)}
        />
        <CameraRig controls={controls} focus={focus} />
      </Canvas>
      <div className="fog pointer-events-none absolute inset-0" />
      <div
        className="glass pointer-events-auto absolute bottom-6 right-6 z-10 flex items-center gap-2 rounded-full p-1.5"
        aria-label="Rotate grove view"
      >
        <button
          type="button"
          onClick={() => rotateView(-1)}
          aria-label="Rotate view left"
          title="Rotate view left"
          className="rounded-full p-2.5 text-foreground hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="px-1 text-xs text-muted-foreground">Orbit</span>
        <button
          type="button"
          onClick={() => rotateView(1)}
          aria-label="Rotate view right"
          title="Rotate view right"
          className="rounded-full p-2.5 text-foreground hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
      {hover && (
        <div
          className="glass pointer-events-none fixed z-30 rounded-xl px-4 py-3 text-sm"
          style={{ left: hover.x + 16, top: hover.y + 16 }}
        >
          <div className="font-display text-lg text-foreground">🌳 {hover.v.name}</div>
          <div className="text-lavender">{hover.v.volunteerHours} volunteer hours</div>
          <div className="text-muted-foreground">{hover.v.activityCount} activities</div>
        </div>
      )}
      <div className="glass pointer-events-none absolute bottom-6 left-8 z-10 hidden rounded-xl px-3 py-2 text-[11px] text-muted-foreground md:block">
        Drag to orbit · Use Orbit buttons to turn · Scroll to zoom
      </div>
    </div>
  );
}
