import type {
  Opportunity,
  OpportunityCategory,
  OpportunityFilters,
  OpportunityGroup,
} from "./types";

export const CATEGORY_META: Record<
  OpportunityCategory,
  { label: string; icon: string; image: string }
> = {
  research: {
    label: "Research",
    icon: "🔬",
    image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=70",
  },
  tutoring: {
    label: "Tutoring",
    icon: "📚",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=70",
  },
  environmental: {
    label: "Environmental",
    icon: "🌿",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=70",
  },
  "community service": {
    label: "Community Service",
    icon: "🤝",
    image: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=70",
  },
  management: {
    label: "Management",
    icon: "🧭",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=70",
  },
};

/** Backend image if present, otherwise the category fallback. */
export function imageFor(o: Opportunity): string {
  return o.image_url?.trim() ? o.image_url : CATEGORY_META[o.category].image;
}

const STOP = new Set(["the", "a", "an", "of", "for", "and", "to", "at", "night", "team"]);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t)),
  );
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a),
    tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => tb.has(t) && shared++);
  return shared / Math.min(ta.size, tb.size);
}

function sameOrg(a: string, b: string): boolean {
  if (norm(a) === norm(b)) return true;
  const initials = (s: string) =>
    s
      .split(/\s+/)
      .filter((w) => !STOP.has(w.toLowerCase()))
      .map((w) => w[0])
      .join("")
      .toLowerCase();
  return initials(a) === norm(b) || initials(b) === norm(a);
}

/** Two records describe the same event when they start within an hour and share place, org, or title. */
export function isSameEvent(a: Opportunity, b: Opportunity): boolean {
  const diff = Math.abs(new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  if (diff > 60 * 60 * 1000) return false;
  let signals = 0;
  if (norm(a.location) === norm(b.location)) signals++;
  if (sameOrg(a.org_name, b.org_name)) signals++;
  if (titleSimilarity(a.title, b.title) >= 0.5) signals++;
  return signals >= 2;
}

const SOURCE_RANK = { "Highlander Hub": 0, External: 1, Discord: 2 } as const;

export function groupOpportunities(list: Opportunity[]): OpportunityGroup[] {
  const groups: Opportunity[][] = [];
  for (const o of list) {
    const g = groups.find((members) => members.some((m) => isSameEvent(m, o)));
    if (g) g.push(o);
    else groups.push([o]);
  }
  return groups.map((members) => {
    const sorted = [...members].sort(
      (a, b) =>
        SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
        b.description.length - a.description.length,
    );
    const primary = sorted[0]!;
    const seen = new Set<string>();
    const sources = sorted
      .filter((m) => !seen.has(m.source) && seen.add(m.source))
      .map((m) => ({ source: m.source, url: m.source_url }));
    return { key: sorted.map((m) => m.id).join("+"), primary, members: sorted, sources };
  });
}

function relevance(g: OpportunityGroup, q: string): number {
  if (!q) return 0;
  let score = 0;
  for (const m of g.members) {
    if (m.title.toLowerCase().includes(q)) score += 3;
    if (m.org_name.toLowerCase().includes(q)) score += 2;
    if (CATEGORY_META[m.category].label.toLowerCase().includes(q)) score += 2;
    if (m.description.toLowerCase().includes(q)) score += 1;
  }
  return score;
}

function inDateRange(iso: string, range: OpportunityFilters["date"], now: Date): boolean {
  if (range === "any") return true;
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") return d >= start && d < new Date(start.getTime() + 864e5);
  if (range === "week") return d >= start && d < new Date(start.getTime() + 7 * 864e5);
  return d >= start && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function applyFilters(
  groups: OpportunityGroup[],
  f: OpportunityFilters,
  now = new Date(),
): OpportunityGroup[] {
  const q = f.query.trim().toLowerCase();
  const result = groups.filter((g) => {
    if (f.category !== "all" && g.primary.category !== f.category) return false;
    if (f.source !== "all" && !g.sources.some((s) => s.source === f.source)) return false;
    if (!inDateRange(g.primary.starts_at, f.date, now)) return false;
    return !q || relevance(g, q) > 0;
  });
  const time = (g: OpportunityGroup) => new Date(g.primary.starts_at).getTime();
  return result.sort((a, b) => {
    if (f.sort === "latest") return time(b) - time(a);
    if (f.sort === "relevant") return relevance(b, q) - relevance(a, q) || time(a) - time(b);
    return time(a) - time(b);
  });
}

export function formatWhen(o: Opportunity): { date: string; time: string } {
  const s = new Date(o.starts_at),
    e = new Date(o.ends_at);
  const date = s.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  return { date, time: `${t(s)} – ${t(e)}` };
}
