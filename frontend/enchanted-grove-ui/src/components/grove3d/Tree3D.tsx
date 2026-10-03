import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { createInstances } from "@react-three/drei";
import * as THREE from "three";
import { getTreeLevel, getTreeScale, type TreeLevel } from "@/lib/grove/config";
import type { Volunteer } from "@/lib/grove/types";
import { toWorld } from "./GroveScene";

type InstanceComponent = ReturnType<typeof createInstances>[1];
type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };
const TREE_HEIGHTS: Record<TreeLevel, number> = {
  seedling: 2.3,
  small: 3.8,
  growing: 4.6,
  mature: 5.2,
  enchanted: 6,
};

function forestRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

// Build one shared airy crown per tier instead of repeating the source kit's solid polygon clumps.
// Each pointed leaf is a folded, double-sided piece of geometry; branches taper into their sprays.
function makeCrown(height: number, tier: TreeLevel): Part[] {
  const random = forestRandom(1701 + height * 101);
  const mature = tier === "mature" || tier === "enchanted";
  const spread = height * (mature ? 0.39 : 0.28);
  const seedling = tier === "seedling";
  const branchCount = seedling ? 4 : tier === "small" ? 7 : mature ? 17 : 12;
  const leafPositions: number[] = [];
  const leafColors: number[] = [];
  const branchGeometries: THREE.BufferGeometry[] = [];
  const dark = new THREE.Color(tier === "enchanted" ? "#275d4c" : "#285c38");
  const mid = new THREE.Color(tier === "enchanted" ? "#54896c" : "#639159");
  const light = new THREE.Color(tier === "enchanted" ? "#a2bf90" : "#b0bd70");

  function addLeaf(center: THREE.Vector3, direction: THREE.Vector3, length: number, width: number) {
    const tip = center.clone().addScaledVector(direction, length);
    const side = new THREE.Vector3(-direction.z, 0.25 + random() * 0.3, direction.x).normalize();
    const ridge = center.clone().addScaledVector(direction, length * 0.53).add(new THREE.Vector3(0, width * 0.13, 0));
    const left = ridge.clone().addScaledVector(side, width);
    const right = ridge.clone().addScaledVector(side, -width);
    const base = center.clone().addScaledVector(direction, -length * 0.12);
    for (const v of [base, left, ridge, left, tip, ridge, base, ridge, right, ridge, tip, right]) {
      leafPositions.push(v.x, v.y, v.z);
      const tone = random();
      const color = tone > 0.78 ? light : tone > 0.25 ? mid : dark;
      leafColors.push(color.r, color.g, color.b);
    }
  }

  for (let b = 0; b < branchCount; b++) {
    const angle = b * 2.39996 + random() * 0.45;
    const elevation = b / branchCount;
    const start = new THREE.Vector3(Math.sin(angle) * height * 0.045, height * (0.33 + elevation * 0.47), Math.cos(angle) * height * 0.045);
    const reach = spread * (0.65 + random() * 0.45) * (1 - elevation * 0.33);
    const end = new THREE.Vector3(Math.sin(angle) * reach, Math.min(height * 0.98, start.y + height * (0.14 + random() * 0.15)), Math.cos(angle) * reach);
    const midPoint = start.clone().lerp(end, 0.58).add(new THREE.Vector3(0, height * 0.025, 0));
    const curve = new THREE.CatmullRomCurve3([start, midPoint, end]);
    branchGeometries.push(new THREE.TubeGeometry(curve, 5, height * (mature ? 0.027 : 0.018), 5, false));
    const twigs = seedling ? 3 : mature ? 8 : 6;
    for (let t = 0; t < twigs; t++) {
      const along = 0.42 + (t / twigs) * 0.52;
      const sideAngle = angle + (t % 2 ? 0.65 : -0.65) + (random() - 0.5) * 0.4;
      const twigStart = curve.getPoint(along);
      const twigEnd = twigStart.clone().add(new THREE.Vector3(Math.sin(sideAngle) * height * 0.18, height * (0.045 + random() * 0.07), Math.cos(sideAngle) * height * 0.18));
      const twigDirection = twigEnd.clone().sub(twigStart);
      branchGeometries.push(new THREE.CylinderGeometry(height * 0.002, height * 0.008, twigDirection.length(), 4).translate(0, twigDirection.length() / 2, 0).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), twigDirection.clone().normalize()))).translate(twigStart.x, twigStart.y, twigStart.z));
      const leaves = seedling || tier === "small" ? 4 : 7;
      for (let l = 0; l < leaves; l++) {
        const fraction = 0.32 + (l / leaves) * 0.75;
        const center = twigStart.clone().lerp(twigEnd, fraction);
        const bearing = sideAngle + (l % 2 ? 0.85 : -0.85);
        const direction = new THREE.Vector3(Math.sin(bearing), 0.15 + random() * 0.4, Math.cos(bearing)).normalize();
        addLeaf(center, direction, height * (0.085 + random() * 0.035), height * (0.026 + random() * 0.012));
      }
    }
  }
  // Leafy top cap: covers the bare branch hub so the crown reads full from above.
  const capLeaves = seedling ? 24 : tier === "small" ? 60 : mature ? 200 : 120;
  for (let i = 0; i < capLeaves; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * spread * 0.75;
    const y = height * (0.78 + random() * 0.2) - (r / spread) * height * 0.12;
    const center = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
    const bearing = random() * Math.PI * 2;
    const direction = new THREE.Vector3(Math.sin(bearing), 0.1 + random() * 0.3, Math.cos(bearing)).normalize();
    addLeaf(center, direction, height * (0.09 + random() * 0.04), height * (0.03 + random() * 0.012));
  }
  const branches = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  for (const geo of branchGeometries) {
    const attr = geo.getAttribute("position");
    const offset = positions.length / 3;
    for (let i = 0; i < attr.count; i++) positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
    if (geo.index) for (let i = 0; i < geo.index.count; i++) indices.push(offset + geo.index.getX(i));
    geo.dispose();
  }
  branches.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  branches.setIndex(indices);
  branches.computeVertexNormals();
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute("position", new THREE.Float32BufferAttribute(leafPositions, 3));
  leaves.setAttribute("color", new THREE.Float32BufferAttribute(leafColors, 3));
  leaves.computeVertexNormals();
  return [
    { geometry: branches, material: new THREE.MeshStandardMaterial({ color: "#6b5d48", roughness: 1, side: THREE.DoubleSide }) },
    { geometry: leaves, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: tier === "enchanted" ? "#15595a" : "#000000", emissiveIntensity: 0.25 }) },
  ];
}

function makeTreeParts(height: number, level: TreeLevel): Part[] {
  const trunkHeight = height * 0.68;
  const trunk = new THREE.CylinderGeometry(height * 0.025, height * 0.055, trunkHeight, 7);
  trunk.translate(0, trunkHeight / 2, 0);

  return [
    {
      geometry: trunk,
      material: new THREE.MeshStandardMaterial({
        color: "#70553f",
        roughness: 0.92,
        flatShading: true,
      }),
    },
    ...makeCrown(height, level),
  ];
}

interface TreeProps {
  volunteer: Volunteer;
  Instances: InstanceComponent[];
  selected: boolean;
  isMe: boolean;
  growing: boolean;
  onHover: (v: Volunteer | null, e?: ThreeEvent<PointerEvent>) => void;
  onClick: (v: Volunteer, e: ThreeEvent<MouseEvent>) => void;
}

export function Tree3D({ volunteer, Instances, selected, isMe, growing, onHover, onClick }: TreeProps) {
  const group = useRef<THREE.Group>(null);
  const orbs = useRef<THREE.Group>(null);
  const level = getTreeLevel(volunteer.volunteerHours).level;
  const target = getTreeScale(volunteer.volunteerHours) * 1.15;
  const seed = useMemo(() => [...volunteer.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 7), [volunteer.id]);
  const angle = (seed % 628) / 100;

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, target, growing ? 3 : 6, dt));
    if (orbs.current) orbs.current.rotation.y += dt * 0.8;
    if (growing) group.current.rotation.y = angle + Math.sin(state.clock.elapsedTime * 12) * 0.03;
  });

  return (
    <group position={toWorld(volunteer)}>
      {(selected || isMe) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.035} scale={target * 0.9}>
          <ringGeometry args={[1.1, 1.25, 40]} />
          <meshBasicMaterial color="#b6f04a" transparent opacity={selected ? 0.85 : 0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={group} rotation-y={angle} scale={0.01}>
        {Instances.map((Instance, index) => (
          <Instance
            key={index}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(volunteer, e); }}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(volunteer, e); }}
            onPointerOut={() => onHover(null)}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(volunteer, e); }}
          />
        ))}
        {level === "enchanted" && (
          <group ref={orbs} position-y={3}>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[Math.cos(i * 1.26) * 1.9, Math.sin(i * 2.1) * 0.6, Math.sin(i * 1.26) * 1.9]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshBasicMaterial color="#ffd77a" />
              </mesh>
            ))}
            <pointLight color="#b48cff" intensity={4} distance={6} />
          </group>
        )}
      </group>
    </group>
  );
}

type ForestProps = Pick<TreeProps, "onHover" | "onClick"> & { volunteers: Volunteer[]; selectedId: string | null; growingId: string | null; currentUserId: string | null };

function Tier({ level, volunteers, selectedId, growingId, currentUserId, onHover, onClick }: ForestProps & { level: TreeLevel }) {
  const height = TREE_HEIGHTS[level];
  const parts = useMemo(() => makeTreeParts(height, level), [height, level]);
  const pairs = useMemo(() => parts.map(() => createInstances()), [parts]);
  // Nested providers give each material group a separate shared instanced mesh.
  const renderTrees = () => volunteers.map((volunteer) => (
    <Tree3D key={volunteer.id} volunteer={volunteer} Instances={pairs.map((pair) => pair[1])}
      selected={selectedId === volunteer.id} isMe={volunteer.id === currentUserId} growing={growingId === volunteer.id}
      onHover={onHover} onClick={onClick} />
  ));
  const renderParts = (index: number): React.ReactNode => {
    const part = parts[index];
    if (!part) return renderTrees();
    const pair = pairs[index];
    if (!pair) return renderTrees();
    const [Instances] = pair;
    return <Instances key={index} geometry={part.geometry} material={part.material} limit={Math.max(volunteers.length + 32, 128)} castShadow receiveShadow>
      {renderParts(index + 1)}
    </Instances>;
  };
  return <>{renderParts(0)}</>;
}

export function ForestTrees(props: ForestProps) {
  const byLevel = useMemo(() => {
    const groups = {} as Record<TreeLevel, Volunteer[]>;
    for (const level of Object.keys(TREE_HEIGHTS) as TreeLevel[]) groups[level] = props.volunteers.filter((v) => getTreeLevel(v.volunteerHours).level === level);
    return groups;
  }, [props.volunteers]);
  return <>{(Object.keys(TREE_HEIGHTS) as TreeLevel[]).map((level) => <Tier key={level} level={level} {...props} volunteers={byLevel[level]} />)}</>;
}
