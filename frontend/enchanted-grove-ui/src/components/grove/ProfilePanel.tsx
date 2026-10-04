import { MILESTONES, getTreeLevel } from "@/lib/grove/config";
import type { Volunteer } from "@/lib/grove/types";
import { FlowerBreakdown } from "./FlowerBreakdown";
import { TreeShape } from "./TreeShape";

export function ProfilePanel({
  volunteer,
  isMe,
  onClose,
  onLogout,
  loggingOut = false,
}: {
  volunteer: Volunteer | null;
  isMe: boolean;
  onClose: () => void;
  onLogout?: () => void;
  loggingOut?: boolean;
}) {
  if (!volunteer) return null;
  const level = getTreeLevel(volunteer.volunteerHours);
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-overlay/40 animate-fade-in"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="glass-strong m-3 flex w-full max-w-sm flex-col overflow-y-auto rounded-3xl p-7 animate-slide-in-right"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-lavender">
            {isMe ? "My Grove Card" : "Grove Card"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex justify-center rounded-2xl bg-card/60 py-4">
          <svg viewBox="-110 -230 220 250" className="h-44 w-44">
            <defs>
              <radialGradient id="enchantGlow">
                <stop offset="0%" stopColor="var(--lavender)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--lavender)" stopOpacity={0} />
              </radialGradient>
            </defs>
            <g transform={`scale(${Math.min(1.25, level.scale)})`}>
              <TreeShape level={level.level} />
            </g>
          </svg>
        </div>
        <h2 className="mt-4 text-center font-display text-4xl text-foreground">{volunteer.name}</h2>
        <p className="text-center text-sm text-primary">{level.label}</p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            ["Hours", volunteer.volunteerHours],
            ["Activities", volunteer.activityCount],
            ["Streak", `${volunteer.currentStreak}d`],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl border border-border bg-card/50 py-3">
              <div className="font-display text-3xl text-lavender">{v}</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-7">
          <FlowerBreakdown volunteer={volunteer} />
        </div>
        <h3 className="mt-7 text-xs uppercase tracking-[0.3em] text-lavender">Milestones</h3>
        <ul className="mt-3 space-y-2">
          {MILESTONES.map((m) => {
            const got = volunteer.milestones.includes(m.id);
            return (
              <li
                key={m.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${got ? "bg-primary/10 text-foreground" : "text-muted-foreground opacity-50"}`}
              >
                <span className="text-lg">{m.icon}</span>
                <span className="flex-1">{m.label}</span>
                {got && <span className="text-xs text-primary">earned</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Volunteer since{" "}
          {new Date(volunteer.joinedAt + "T00:00:00").toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
        {isMe && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="mt-6 shrink-0 rounded-full border border-border px-4 py-3 text-sm text-foreground hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        )}
      </aside>
    </div>
  );
}
