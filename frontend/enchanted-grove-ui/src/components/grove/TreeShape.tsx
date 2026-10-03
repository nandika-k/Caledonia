import type { TreeLevel } from "@/lib/grove/config";

/** Draws a tree with its base at (0,0), roughly 160 units tall at scale 1. */
export function TreeShape({ level, seed = 0, highlight = false }: { level: TreeLevel; seed?: number; highlight?: boolean }) {
  const tilt = ((seed % 7) - 3) * 1.5;
  if (level === "seedling") {
    return (
      <g>
        <ellipse cx={0} cy={2} rx={18} ry={5} fill="var(--grove-shadow)" />
        <path d="M0 0 C 0 -20, 2 -34, 0 -48" stroke="var(--lime)" strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M0 -30 C -18 -36, -26 -52, -22 -58 C -10 -56, -2 -44, 0 -30Z" fill="var(--lime)" />
        <path d="M0 -40 C 16 -46, 24 -62, 20 -68 C 8 -64, 2 -54, 0 -40Z" fill="var(--canopy-light)" />
      </g>
    );
  }
  const enchanted = level === "enchanted";
  const blobs: [number, number, number][] = [
    [-34, -96, 38], [34, -98, 36], [0, -128, 44], [-18, -150, 30], [22, -152, 28], [0, -80, 36],
  ];
  return (
    <g transform={`rotate(${tilt})`}>
      <ellipse cx={0} cy={4} rx={60} ry={12} fill="var(--grove-shadow)" />
      {enchanted && <circle cx={0} cy={-110} r={110} fill="url(#enchantGlow)" />}
      <path d="M-10 0 C -8 -30, -6 -60, -4 -80 L 4 -80 C 6 -60, 8 -30, 12 0 Z" fill="var(--bark)" />
      <path d="M-2 -60 C -14 -72, -24 -76, -32 -88" stroke="var(--bark)" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M2 -66 C 14 -78, 22 -82, 30 -94" stroke="var(--bark)" strokeWidth={5} fill="none" strokeLinecap="round" />
      {blobs.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "var(--canopy-dark)" : "var(--canopy)"} />
      ))}
      {blobs.slice(0, 4).map(([x, y, r], i) => (
        <circle key={`h${i}`} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.45} fill="var(--canopy-light)" opacity={0.55} />
      ))}
      {(level === "mature" || enchanted) &&
        [[-40, -110], [30, -130], [-8, -160], [44, -92], [-20, -84]].map(([x, y], i) => (
          <circle key={`f${i}`} cx={x} cy={y} r={4} fill={i % 2 ? "var(--lavender)" : "var(--blossom)"} />
        ))}
      {enchanted &&
        [0, 1, 2, 3].map((i) => (
          <circle key={`o${i}`} r={3.2} fill="var(--gold)" className="firefly-orbit" style={{ animationDelay: `${i * -1.5}s`, offsetPath: "path('M -80 -110 a 80 60 0 1 0 160 0 a 80 60 0 1 0 -160 0')" }} />
        ))}
      {highlight && <circle cx={0} cy={-110} r={86} fill="none" stroke="var(--lime)" strokeWidth={3} strokeDasharray="6 8" opacity={0.8} />}
    </g>
  );
}
