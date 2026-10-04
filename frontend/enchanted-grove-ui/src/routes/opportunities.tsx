import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VineFrame, VinesBackground } from "@/components/VinesBackground";
import { getOpportunities } from "@/lib/opportunities/service";
import { NewarkOpportunities } from "@/components/NewarkOpportunities";
import {
  applyFilters,
  CATEGORY_META,
  formatWhen,
  groupOpportunities,
  imageFor,
} from "@/lib/opportunities/logic";
import {
  DEFAULT_FILTERS,
  OPPORTUNITY_CATEGORIES,
  type Opportunity,
  type OpportunityFilters,
  type OpportunityGroup,
  type OpportunitySource,
} from "@/lib/opportunities/types";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Volunteer Opportunities — Caledonia" },
      {
        name: "description",
        content:
          "Discover NJIT volunteer opportunities from Highlander Hub, Discord, and beyond — and help the Grove grow.",
      },
      { property: "og:title", content: "Volunteer Opportunities — Caledonia" },
      {
        property: "og:description",
        content: "A magical volunteer opportunity discovery board for NJIT students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpportunitiesPage,
});

const SOURCES: OpportunitySource[] = ["Highlander Hub", "Discord", "External"];
const SOURCE_STYLE: Record<OpportunitySource, string> = {
  "Highlander Hub": "border-gold/40 bg-gold/10 text-gold",
  Discord: "border-lavender/40 bg-lavender/10 text-lavender",
  External: "border-primary/40 bg-primary/10 text-primary",
};

function useOpportunities() {
  const [state, setState] = useState<{
    status: "loading" | "error" | "ready";
    data: Opportunity[];
  }>({ status: "loading", data: [] });
  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading" }));
    getOpportunities()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error", data: [] }));
  }, []);
  useEffect(load, [load]);
  return { ...state, retry: load };
}

function OpportunitiesPage() {
  const { status, data, retry } = useOpportunities();
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);
  const [open, setOpen] = useState<OpportunityGroup | null>(null);
  const groups = useMemo(() => groupOpportunities(data), [data]);
  const visible = useMemo(() => applyFilters(groups, filters), [groups, filters]);
  const set = <K extends keyof OpportunityFilters>(k: K, v: OpportunityFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
      <VinesBackground />
      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:px-10 md:py-4">
        <Link
          to="/"
          className="font-display-sc min-w-0 truncate text-lg tracking-[0.05em] md:text-2xl md:tracking-[0.18em]"
        >
          🌳 Caledonia
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-full px-3 py-2.5 text-foreground/90 hover:text-primary md:px-4"
          >
            The Grove
          </Link>
          <span className="rounded-full border border-primary/40 px-3 py-2.5 text-primary md:px-4">
            Opportunities
          </span>
        </nav>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8">
        <section className="text-center">
          <p className="text-lg tracking-[0.6em] text-lime/80" aria-hidden>
            ❦ ✿ ❦
          </p>
          <h1 className="font-display-sc mt-2 text-4xl tracking-[0.12em] md:text-5xl">
            Volunteer Opportunities
          </h1>
          <p className="mt-3 font-display text-xl italic text-muted-foreground">
            Discover your next opportunity to make an impact.
          </p>
        </section>

        <NewarkOpportunities />

        <h2 className="mt-10 font-display text-3xl">Campus & event opportunities</h2>
        <section className="glass mt-4 rounded-2xl p-4 md:p-5" aria-label="Search and filters">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search opportunities, organizations, or keywords..."
            aria-label="Search opportunities"
            className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <FilterSelect
              label="Category"
              value={filters.category}
              onChange={(v) => set("category", v as OpportunityFilters["category"])}
              options={[
                ["all", "All Categories"],
                ...OPPORTUNITY_CATEGORIES.map(
                  (c) => [c, CATEGORY_META[c].label] as [string, string],
                ),
              ]}
            />
            <FilterSelect
              label="Source"
              value={filters.source}
              onChange={(v) => set("source", v as OpportunityFilters["source"])}
              options={[["all", "All Sources"], ...SOURCES.map((s) => [s, s] as [string, string])]}
            />
            <FilterSelect
              label="Date"
              value={filters.date}
              onChange={(v) => set("date", v as OpportunityFilters["date"])}
              options={[
                ["any", "Any Date"],
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
              ]}
            />
            <FilterSelect
              label="Sort"
              value={filters.sort}
              onChange={(v) => set("sort", v as OpportunityFilters["sort"])}
              options={[
                ["soonest", "Soonest"],
                ["latest", "Latest"],
                ["relevant", "Most Relevant"],
              ]}
            />
          </div>
        </section>

        <section className="mt-8" aria-live="polite">
          {status === "loading" && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
          {status === "error" && (
            <StateBox
              icon="🍂"
              title="We couldn't load opportunities right now."
              text="Please try again in a moment."
              action="Try Again"
              onAction={retry}
            />
          )}
          {status === "ready" && visible.length === 0 && (
            <StateBox
              icon="🌱"
              title="No opportunities found"
              text="Try changing your filters or searching for something else."
              action="Clear Filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
            />
          )}
          {status === "ready" && visible.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((g) => (
                <OpportunityCard key={g.key} group={g} onOpen={() => setOpen(g)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <OpportunityModal group={open} onClose={() => setOpen(null)} />
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-full border border-border bg-input px-4 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-popover">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function OppImage({ o, className }: { o: Opportunity; className: string }) {
  const [step, setStep] = useState(0);
  const meta = CATEGORY_META[o.category];
  const src = step === 0 ? imageFor(o) : meta.image;
  if (step >= 2) return <ImageFallback o={o} className={className} />;
  return (
    <img
      src={src}
      alt={`Photo for ${o.title}`}
      loading="lazy"
      className={className}
      onError={() => setStep((s) => (s === 0 && imageFor(o) !== meta.image ? 1 : 2))}
    />
  );
}

function ImageFallback({ o, className }: { o: Opportunity; className: string }) {
  return (
    <div
      className={`${className} grid place-items-center bg-gradient-to-br from-secondary via-muted to-background`}
    >
      <span className="text-5xl opacity-80" aria-hidden>
        {CATEGORY_META[o.category].icon}
      </span>
    </div>
  );
}

function CategoryBadge({ o }: { o: Opportunity }) {
  const m = CATEGORY_META[o.category];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-3 py-0.5 text-xs">
      {m.icon} {m.label}
    </span>
  );
}

function SourceBadges({ g }: { g: OpportunityGroup }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {g.sources.length > 1 && <span className="text-xs text-muted-foreground">Sources:</span>}
      {g.sources.map((s) =>
        s.url ? (
          <a
            key={s.source}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide transition hover:-translate-y-0.5 hover:brightness-125 ${SOURCE_STYLE[s.source]}`}
            aria-label={`Open ${s.source} source for ${g.primary.title}`}
          >
            {s.source} ↗
          </a>
        ) : (
          <span
            key={s.source}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide ${SOURCE_STYLE[s.source]}`}
          >
            {s.source}
          </span>
        ),
      )}
    </div>
  );
}

function OpportunityCard({ group, onOpen }: { group: OpportunityGroup; onOpen: () => void }) {
  const o = group.primary;
  const when = formatWhen(o);
  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 transition duration-200 hover:-translate-y-1 hover:border-canopy/60 hover:shadow-[0_18px_40px_-18px] hover:shadow-canopy/40">
      <VineFrame />
      <div className="aspect-[16/9] overflow-hidden">
        <OppImage
          o={o}
          className="h-full w-full object-cover transition duration-200 group-hover:brightness-110"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryBadge o={o} />
        </div>
        <h2 className="font-display text-2xl leading-tight break-words">{o.title}</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="break-words">
            📅 {when.date} · {when.time}
          </li>
          <li className="break-words">📍 {o.location}</li>
          <li className="break-words">🏢 {o.org_name}</li>
        </ul>
        <SourceBadges g={group} />
        <button
          onClick={onOpen}
          className="btn-lime mt-auto self-start rounded-full px-5 py-2.5 text-sm font-medium"
        >
          View Opportunity →
        </button>
      </div>
    </article>
  );
}

function OpportunityModal({
  group,
  onClose,
}: {
  group: OpportunityGroup | null;
  onClose: () => void;
}) {
  const o = group?.primary;
  const when = o ? formatWhen(o) : null;
  return (
    <Dialog open={!!group} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-border bg-popover p-0">
        {group && o && when && (
          <>
            <div className="aspect-[16/8] overflow-hidden">
              <OppImage o={o} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-4 p-6">
              <CategoryBadge o={o} />
              <DialogTitle className="font-display text-3xl leading-tight">{o.title}</DialogTitle>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Organization" value={`🏢 ${o.org_name}`} />
                <Info label="Location" value={`📍 ${o.location}`} />
                <Info label="Date" value={`📅 ${when.date}`} />
                <Info label="Time" value={`🕕 ${when.time}`} />
              </dl>
              <DialogDescription className="text-base leading-relaxed text-foreground/85">
                {o.description}
              </DialogDescription>
              <SourceBadges g={group} />
              <div className="flex flex-wrap gap-2 pt-2">
                {group.sources
                  .filter((s) => s.url)
                  .map((s) => (
                    <a
                      key={s.source}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-lime rounded-full px-5 py-2.5 text-sm font-medium"
                    >
                      Open Original Opportunity{group.sources.length > 1 ? ` · ${s.source}` : ""} ↗
                    </a>
                  ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-secondary/40 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="aspect-[16/9] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-9 w-40 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function StateBox({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="glass mx-auto max-w-md rounded-2xl px-6 py-10 text-center">
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <h2 className="mt-3 font-display text-2xl">{title}</h2>
      <p className="mt-1 text-muted-foreground">{text}</p>
      <button
        onClick={onAction}
        className="btn-lime mt-5 rounded-full px-6 py-2 text-sm font-medium"
      >
        {action}
      </button>
    </div>
  );
}
