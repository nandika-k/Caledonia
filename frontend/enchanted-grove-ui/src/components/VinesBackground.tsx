/**
 * Decorative curling vines inspired by the GirlHacks 2026 logo border —
 * teal curling tendrils with spiral curls and small leaves, rendered as a
 * subtle fixed background layer. Purely decorative (aria-hidden).
 */

function Vine({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        {/* main curling stem */}
        <path d="M-10 410 C 40 330, 30 260, 90 210 C 150 160, 150 110, 120 80 C 95 55, 60 60, 55 90 C 51 115, 75 130, 92 118" />
        {/* spiral curl */}
        <path d="M92 118 C 105 108, 105 90, 92 84 C 80 79, 70 88, 74 99" />
        {/* upper tendril */}
        <path d="M120 80 C 160 50, 210 55, 240 30 C 262 12, 260 -10, 258 -20" />
        {/* side tendril with curl */}
        <path d="M90 210 C 140 200, 180 220, 205 200 C 225 184, 218 158, 198 158 C 182 158, 176 174, 186 184" />
        {/* lower small curl */}
        <path d="M40 330 C 80 330, 110 350, 118 380 C 122 396, 112 408, 100 402 C 90 397, 92 384, 102 382" />
      </g>
      {/* leaves */}
      <g fill="currentColor">
        <path d="M128 96 C 150 70, 185 68, 200 80 C 185 100, 150 108, 128 96 Z" />
        <path d="M200 196 C 228 180, 262 186, 274 202 C 256 220, 222 216, 200 196 Z" />
        <path d="M52 322 C 78 306, 112 310, 124 326 C 106 344, 72 342, 52 322 Z" />
        <path d="M236 34 C 262 22, 292 30, 300 48 C 282 62, 250 54, 236 34 Z" />
        <path d="M96 396 C 118 388, 142 396, 148 412 L 96 412 Z" />
      </g>
    </svg>
  );
}

/** Ivy leaf, drawn around its stem point at (0,0), tip pointing up. */
const IVY_LEAF = "M0 0 C -7 -1 -11 -8 -8 -15 C -5 -22 5 -22 8 -15 C 11 -8 7 -1 0 0 Z";

function Leaf({
  x,
  y,
  r,
  s = 1,
  fill,
  glow = false,
}: {
  x: number;
  y: number;
  r: number;
  s?: number;
  fill: string;
  glow?: boolean;
}) {
  return (
    <path
      d={IVY_LEAF}
      fill={fill}
      className={glow ? "vine-leaf vine-leaf-glow" : "vine-leaf"}
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
    />
  );
}

/**
 * Leafy corner vine: a twisting muted-brown branch with deep-teal ivy leaves
 * and curly tendrils, growing from the top-left corner a short way along the
 * top and left edges. Rotate 180° for the bottom-right corner.
 */
function CornerVine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 110" fill="none" aria-hidden className={className}>
      {/* twisting branches */}
      <g stroke="var(--bark)" strokeLinecap="round">
        <path d="M-2 66 C 18 60, 26 44, 30 26 C 33 12, 44 4, 66 -2" strokeWidth="3.5" />
        <path d="M-2 42 C 12 40, 20 30, 22 16" strokeWidth="2" />
        <path d="M30 26 C 40 22, 52 22, 62 14" strokeWidth="2" />
      </g>
      {/* curly tendrils */}
      <g stroke="var(--canopy)" strokeWidth="1.4" strokeLinecap="round">
        <path d="M44 30 C 56 28, 62 36, 56 42 C 51 46, 45 42, 48 37" />
        <path d="M72 8 C 82 10, 86 18, 80 22 C 75 25, 71 20, 75 16" />
        <path d="M14 52 C 24 54, 28 62, 22 66 C 17 69, 13 64, 17 60" />
        <path d="M62 14 C 70 12, 74 6, 72 2" />
      </g>
      {/* ivy leaves */}
      <Leaf x={26} y={50} r={-30} fill="var(--canopy-dark)" />
      <Leaf x={34} y={30} r={15} fill="var(--canopy)" />
      <Leaf x={14} y={64} r={-55} s={0.85} fill="var(--canopy)" />
      <Leaf x={48} y={16} r={40} fill="var(--canopy-dark)" />
      <Leaf x={66} y={6} r={65} s={0.8} fill="var(--canopy)" />
      <Leaf x={8} y={40} r={-75} s={0.75} fill="var(--canopy-light)" />
      <Leaf x={38} y={44} r={-10} s={0.7} fill="var(--canopy-light)" glow />
      <Leaf x={56} y={26} r={55} s={0.65} fill="var(--canopy-light)" glow />
    </svg>
  );
}

/**
 * Leafy vine frame for a card: twisting vines with ivy leaves on the top-left
 * and bottom-right corners, over a subtle border. Decorative only; the parent
 * needs `relative` and the `group` class (hover makes leaves sway).
 */
export function VineFrame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <CornerVine className="absolute -left-1 -top-1 h-20 w-20 md:h-24 md:w-24" />
      <CornerVine className="absolute -bottom-1 -right-1 h-20 w-20 rotate-180 md:h-24 md:w-24" />
    </div>
  );
}

export function VinesBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* deep teal base vines, very subtle */}
      <Vine className="absolute -left-16 -top-16 h-[420px] w-[420px] text-vine/25 md:h-[560px] md:w-[560px]" />
      <Vine
        flip
        className="absolute -right-16 -top-16 h-[420px] w-[420px] text-vine/25 md:h-[560px] md:w-[560px]"
      />
      <Vine className="absolute -bottom-20 -left-16 h-[420px] w-[420px] rotate-180 text-vine/20 md:h-[560px] md:w-[560px]" />
      <Vine
        flip
        className="absolute -bottom-20 -right-16 h-[420px] w-[420px] rotate-180 text-vine/20 md:h-[560px] md:w-[560px]"
      />
      {/* faint lime accent vine, mid-left edge */}
      <Vine className="absolute -left-24 top-1/3 h-[380px] w-[380px] -scale-y-100 text-lime/10" />
      <Vine
        flip
        className="absolute -right-24 top-1/3 h-[380px] w-[380px] -scale-y-100 text-lime/10"
      />
    </div>
  );
}
