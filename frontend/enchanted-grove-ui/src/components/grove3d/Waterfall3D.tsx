import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Ripple = { x: number; z: number; started: number };

const LOTUS_TINTS = ["#e6b8ff", "#f5c7f2", "#bfe7ff"];

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Small glowing lotus that sits on a lily pad. */
function Lotus({ position, tint }: { position: [number, number, number]; tint: string }) {
  const petals = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ angle: (i / 6) * Math.PI * 2 })),
    [],
  );
  const glow = useMemo(() => makeGlowTexture(), []);
  return (
    <group position={position}>
      <sprite scale={[0.55, 0.55, 0.55]}>
        <spriteMaterial
          map={glow}
          color={tint}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {petals.map((p, i) => (
        <mesh
          key={i}
          position={[Math.cos(p.angle) * 0.075, 0.05, Math.sin(p.angle) * 0.075]}
          rotation={[0.85, p.angle, 0]}
        >
          <coneGeometry args={[0.05, 0.13, 8]} />
          <meshStandardMaterial
            color={tint}
            emissive={tint}
            emissiveIntensity={0.7}
            roughness={0.8}
            flatShading
          />
        </mesh>
      ))}
      <mesh position-y={0.05}>
        <icosahedronGeometry args={[0.045, 0]} />
        <meshStandardMaterial
          color="#ffe6a8"
          emissive="#ffe6a8"
          emissiveIntensity={1.6}
          roughness={0.6}
          flatShading
        />
      </mesh>
    </group>
  );
}

/** A low, magical spring in the Grove. Water and click ripples share one surface. */
export function Waterfall({
  position = [0, 0, 0],
  playing = true,
  speed = 1,
}: {
  position?: [number, number, number];
  playing?: boolean;
  speed?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const elapsed = useRef(0);
  const magicTime = useRef(0);
  const clickTime = useRef(-100);
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uRippleTime: { value: -10 },
      uRippleCenter: { value: new THREE.Vector2(0, 0) },
      uDeep: { value: new THREE.Color("#1d6f68") },
      uShallow: { value: new THREE.Color("#74e0c6") },
    }),
    [],
  );

  // Firefly seeds stay fixed; the vertex shader drifts them.
  const fireflies = useMemo(() => {
    const count = 34;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 5;
      positions.set([Math.cos(a) * r, 0.4 + Math.random() * 1.5, Math.sin(a) * r * 0.8], i * 3);
      seeds.set([Math.random(), Math.random(), Math.random()], i * 3);
    }
    return { positions, seeds };
  }, []);
  const fireflyUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // Irregular rock ring with a few clumps and anchor stones.
  const rocks = useMemo(() => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2 + rnd() * 0.3;
      const radius = 5.35 + rnd() * 1.15;
      return {
        position: [
          Math.cos(angle) * radius,
          0.1 + rnd() * 0.12,
          Math.sin(angle) * radius * 0.76,
        ] as [number, number, number],
        scale: [0.5 + rnd() * 0.5, 0.26 + rnd() * 0.3, 0.5 + rnd() * 0.5] as [
          number,
          number,
          number,
        ],
        rotation: rnd() * Math.PI,
        moss: rnd() > 0.55,
      };
    });
  }, []);
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3a5148", roughness: 1, flatShading: true }),
    [],
  );
  const darkStone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2c403c", roughness: 1, flatShading: true }),
    [],
  );
  const moss = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3f6b58", roughness: 1, flatShading: true }),
    [],
  );

  // Lily pads with a couple of glowing lotus blooms.
  const pads = useMemo(
    () => [
      {
        position: [-3.4, 0.18, -1.6] as [number, number, number],
        scale: 0.8,
        rotation: 0.5,
        lotus: 0,
      },
      {
        position: [2.7, 0.18, -2.7] as [number, number, number],
        scale: 0.68,
        rotation: 2.1,
        lotus: 1,
      },
      {
        position: [-1.1, 0.18, 3.1] as [number, number, number],
        scale: 0.95,
        rotation: 4.0,
        lotus: -1,
      },
      {
        position: [3.9, 0.18, 1.4] as [number, number, number],
        scale: 0.62,
        rotation: 1.2,
        lotus: -1,
      },
      {
        position: [-4.6, 0.18, 0.8] as [number, number, number],
        scale: 0.72,
        rotation: 5.4,
        lotus: 2,
      },
      {
        position: [0.6, 0.18, -4.4] as [number, number, number],
        scale: 0.58,
        rotation: 2.8,
        lotus: -1,
      },
    ],
    [],
  );

  // Soft mist drifts around the rim; it keeps breathing even when the water rests.
  const mists = useMemo(() => {
    let seed = 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 5 }, (_, i) => ({
      angle: (i / 5) * Math.PI * 2 + rnd() * 0.6,
      radius: 5.2 + rnd() * 1.4,
      height: 0.35 + rnd() * 0.5,
      scale: 3.2 + rnd() * 2.4,
      phase: rnd() * Math.PI * 2,
      drift: 0.04 + rnd() * 0.05,
    }));
  }, []);
  const mistRefs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    elapsed.current += dt;
    magicTime.current += dt;
    if (playing) uniforms.uTime.value += dt * speed;
    fireflyUniforms.uTime.value = magicTime.current;
    uniforms.uHover.value += (Number(hovered) - uniforms.uHover.value) * (1 - Math.exp(-5 * dt));
    uniforms.uRippleTime.value = (elapsed.current - clickTime.current) * (playing ? speed : 1);
    mists.forEach((m, i) => {
      const sprite = mistRefs.current[i];
      if (!sprite) return;
      const a = m.angle + magicTime.current * m.drift;
      sprite.position.set(
        Math.cos(a) * m.radius,
        m.height + Math.sin(magicTime.current * 0.3 + m.phase) * 0.15,
        Math.sin(a) * m.radius * 0.76,
      );
      sprite.material.opacity = 0.14 + 0.07 * Math.sin(magicTime.current * 0.5 + m.phase);
    });
  });

  return (
    <group position={position}>
      {/* The dark shelf is nearly flush with the ground; no tall cliff or light cone. */}
      <mesh position-y={0.045} scale={[1, 1, 0.72]} receiveShadow>
        <cylinderGeometry args={[5.4, 5.65, 0.18, 20]} />
        <meshStandardMaterial color="#243e3b" roughness={1} flatShading />
      </mesh>
      <mesh
        position-y={0.16}
        rotation-x={-Math.PI / 2}
        scale={[5.25, 3.65, 1]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(event) => {
          event.stopPropagation();
          clickTime.current = elapsed.current;
          uniforms.uRippleCenter.value.set(
            (event.point.x - position[0]) / 5.25,
            (position[2] - event.point.z) / 3.65,
          );
        }}
      >
        <circleGeometry args={[1, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          side={THREE.DoubleSide}
          vertexShader={`
            varying vec2 vP;
            void main() {
              vP = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vP;
            uniform float uTime;
            uniform float uHover;
            uniform float uRippleTime;
            uniform vec2 uRippleCenter;
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            void main() {
              float edge = length(vP);
              float distanceFromCenter = length(vP * vec2(1.0, 0.85));

              // Soft rolling waves plus a fine caustic shimmer.
              float softWave = sin(distanceFromCenter * 31.0 - uTime * 1.45 + sin(vP.x * 5.0) * 0.8);
              float secondWave = sin(length((vP - vec2(-0.45, 0.18)) * vec2(1.0, 0.85)) * 24.0 - uTime * 0.95);
              float fine = sin(vP.x * 21.0 + uTime * 1.1) * sin(vP.y * 18.0 - uTime * 0.85);
              float shimmer = 0.5 + 0.2 * softWave + 0.2 * secondWave + 0.12 * fine;

              // The spring bubbles up near the middle: a warm glowing source.
              float source = exp(-length(vP) * 3.4) * (0.55 + 0.18 * sin(uTime * 2.1));

              // Moonlight glints in a slow drifting band.
              float glint = pow(max(0.0, sin(vP.x * 2.1 - uTime * 0.55 + vP.y * 1.3)), 6.0) * 0.5 * smoothstep(0.95, 0.15, edge);

              // Click ripples.
              float distanceFromClick = length((vP - uRippleCenter) * vec2(1.0, 0.7));
              float waveRadius = uRippleTime * 0.35;
              float clickWave = exp(-pow((distanceFromClick - waveRadius) * 32.0, 2.0));
              clickWave *= (1.0 - smoothstep(1.5, 2.7, uRippleTime)) * step(0.0, uRippleTime);

              float light = 0.42 + shimmer * 0.28 + source * 0.3 + glint * 0.3 + clickWave * 0.2 + uHover * 0.08;
              light += (1.0 - smoothstep(0.76, 1.0, edge)) * 0.06;
              light = clamp(light, 0.0, 1.0);
              vec3 color = mix(uDeep, uShallow, light);
              // A gentle teal glow over the whole pool.
              color += uShallow * 0.1 * (1.0 - edge * 0.4);
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      {rocks.map((rock, i) => (
        <mesh
          key={`r${i}`}
          position={rock.position}
          scale={rock.scale}
          rotation-y={rock.rotation}
          castShadow
          receiveShadow
          material={rock.moss ? moss : i % 4 === 0 ? darkStone : stone}
        >
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {pads.map((pad, i) => (
        <group key={`pad${i}`} position={pad.position} rotation-y={pad.rotation}>
          <mesh rotation-x={-Math.PI / 2} scale={[pad.scale, pad.scale * 0.78, 1]}>
            <circleGeometry args={[1, 24, 0, 5.85]} />
            <meshStandardMaterial
              color="#47806c"
              roughness={0.9}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
          {pad.lotus >= 0 && (
            <Lotus
              position={[pad.scale * 0.25, 0, pad.scale * 0.15]}
              tint={LOTUS_TINTS[pad.lotus] ?? "#e6b8ff"}
            />
          )}
        </group>
      ))}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fireflies.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[fireflies.seeds, 3]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={fireflyUniforms}
          vertexShader={`
            attribute vec3 aSeed;
            uniform float uTime;
            varying float vTwinkle;
            void main() {
              float t = uTime * 0.35 + aSeed.x * 6.2831;
              vec3 p = position;
              p.x += sin(t + aSeed.y * 4.0) * 0.8;
              p.z += cos(t * 0.8 + aSeed.z * 4.0) * 0.8;
              p.y += sin(t * 1.3 + aSeed.x * 5.0) * 0.35;
              vTwinkle = 0.55 + 0.45 * sin(t * 2.0 + aSeed.z * 9.0);
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = 110.0 / -mv.z * (0.5 + 0.5 * aSeed.y);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            varying float vTwinkle;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              float a = smoothstep(0.5, 0.05, d) * vTwinkle;
              gl_FragColor = vec4(vec3(1.0, 0.85, 0.5) * a, a);
            }
          `}
        />
      </points>
      {mists.map((_, i) => (
        <sprite
          key={`m${i}`}
          ref={(ref) => {
            mistRefs.current[i] = ref;
          }}
        >
          <spriteMaterial map={glowTexture} color="#7fd8c8" transparent depthWrite={false} />
        </sprite>
      ))}
      <pointLight position={[0, 0.8, 0]} color="#50c6b0" intensity={2.5} distance={10} decay={2} />
      <pointLight position={[0, 1.6, 0]} color="#c9a4ff" intensity={1.1} distance={7} decay={2} />
    </group>
  );
}
