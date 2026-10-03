import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/grove/config";

// A fixed set of painted, transparent 2D blooms. Sprites face the camera but stay
// anchored to twig endpoints in 3D space, and share one texture/material per kind.
function paintFlower(type: ActivityType): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint a flower");
  const palette = {
    research: { petal: "#fff9e9", highlight: "#ffffff", glow: "255,243,189", center: "#f4c75b" },
    tutoring: { petal: "#efb838", highlight: "#ffe875", glow: "255,204,85", center: "#755026" },
    environmental: {
      petal: "#ae89e4",
      highlight: "#dfc5ff",
      glow: "185,143,255",
      center: "#ded1ff",
    },
    "community service": {
      petal: "#ee859b",
      highlight: "#ffc3c6",
      glow: "255,146,174",
      center: "#ffde9f",
    },
    management: { petal: "#cc648b", highlight: "#ffc0d2", glow: "255,125,170", center: "#ffe2a1" },
  }[type];

  const glow = ctx.createRadialGradient(64, 59, 5, 64, 59, 59);
  glow.addColorStop(0, `rgba(${palette.glow},0.65)`);
  glow.addColorStop(0.34, `rgba(${palette.glow},0.28)`);
  glow.addColorStop(1, `rgba(${palette.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);

  const petal = (
    x: number,
    y: number,
    width: number,
    length: number,
    angle: number,
    color: string,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const fill = ctx.createLinearGradient(0, 0, 0, -length);
    fill.addColorStop(0, palette.petal);
    fill.addColorStop(0.7, color);
    fill.addColorStop(1, palette.highlight);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(-width, -length * 0.35, -width * 0.75, -length, 0, -length);
    ctx.bezierCurveTo(width * 0.75, -length, width, -length * 0.35, 0, 1);
    ctx.fill();
    ctx.restore();
  };
  const dot = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (type === "environmental") {
    // A slender lavender spike of individual florets, not one purple circle.
    for (let row = 0; row < 7; row++) {
      const y = 82 - row * 8;
      const reach = 11 - row * 0.8;
      for (const side of [-1, 1]) {
        petal(64 + side * 3, y, 6, reach, side * 0.95, row % 2 ? palette.highlight : palette.petal);
      }
      dot(64, y - 2, 3, palette.highlight);
    }
  } else if (type === "community service") {
    // Three overlapping, upright tulip petals form an open cup.
    petal(64, 75, 17, 37, -0.4, palette.highlight);
    petal(64, 75, 17, 37, 0.4, palette.highlight);
    petal(64, 77, 18, 32, 0, palette.petal);
    dot(64, 65, 3, palette.center);
  } else if (type === "management") {
    // A layered rose with curled inner petals.
    for (let ring = 0; ring < 3; ring++) {
      const count = 8 - ring * 2;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ring * 0.4;
        petal(
          64 + Math.sin(a) * ring * 3,
          62 - Math.cos(a) * ring * 3,
          12 - ring * 2,
          25 - ring * 5,
          a,
          ring === 0 ? palette.highlight : palette.petal,
        );
      }
    }
    dot(64, 62, 6, palette.highlight);
  } else {
    const sunflower = type === "tutoring";
    const count = sunflower ? 13 : 10;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      petal(
        64,
        62,
        sunflower ? 8 : 9,
        sunflower ? 33 : 29,
        a,
        i % 2 ? palette.petal : palette.highlight,
      );
    }
    dot(64, 62, sunflower ? 15 : 12, palette.center);
    if (sunflower) {
      for (let i = 0; i < 12; i++) {
        const a = i * 2.399;
        const r = 4 + (i % 3) * 3;
        dot(64 + Math.sin(a) * r, 62 + Math.cos(a) * r, 1.4, "#e0ae53");
      }
    } else dot(61, 59, 3, "#fff1ac");
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function useFlowerMaterials(): Record<ActivityType, THREE.SpriteMaterial> {
  const materials = useMemo(
    () =>
      Object.fromEntries(
        ACTIVITY_TYPES.map((type) => [
          type,
          new THREE.SpriteMaterial({
            map: paintFlower(type),
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        ]),
      ) as Record<ActivityType, THREE.SpriteMaterial>,
    [],
  );
  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    },
    [materials],
  );
  return materials;
}
