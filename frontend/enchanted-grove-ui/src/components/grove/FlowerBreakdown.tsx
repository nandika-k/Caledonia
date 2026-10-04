import { ACTIVITY_TYPES, FLOWERS } from "@/lib/grove/config";
import type { Volunteer } from "@/lib/grove/types";

export function FlowerBreakdown({
  volunteer,
  compact = false,
}: {
  volunteer: Volunteer;
  compact?: boolean;
}) {
  const total = ACTIVITY_TYPES.reduce((sum, type) => sum + (volunteer.flowers[type] ?? 0), 0);
  return (
    <section aria-label="Service flowers">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase text-lavender">Service flowers</h3>
        <span className="text-xs text-muted-foreground">{total} blooms · 1 per 2h</span>
      </div>
      <ul
        className={
          compact ? "mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" : "mt-3 space-y-2 text-sm"
        }
      >
        {ACTIVITY_TYPES.map((type) => (
          <li
            key={type}
            title={FLOWERS[type].meaning}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 text-foreground/80">
              {FLOWERS[type].name} <span className="text-muted-foreground">· {type}</span>
              {!compact && (
                <span className="block text-xs text-muted-foreground">{FLOWERS[type].meaning}</span>
              )}
            </span>
            <span className="shrink-0 font-display text-lavender">
              {volunteer.flowers[type] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
