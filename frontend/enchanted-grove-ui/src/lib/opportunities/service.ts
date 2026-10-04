import type { Opportunity, OpportunityCategory, OpportunitySource } from "./types";

interface ApiOpportunity {
  id: number | string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  org_name?: string | null;
  source?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  organizer_email?: string | null;
  image_url?: string | null;
}

const CATEGORY_KEYWORDS: [OpportunityCategory, string[]][] = [
  ["environmental", ["cleanup", "clean up", "repair", "green", "garden", "environment"]],
  ["tutoring", ["tutor", "mentor", "workshop", "teach"]],
  ["management", ["tabling", "organizer", "committee", "leadership"]],
  ["research", ["research", "lab", "study"]],
];

function categoryFor(event: ApiOpportunity): OpportunityCategory {
  const text = `${event.title ?? ""} ${event.description ?? ""} ${event.org_name ?? ""}`.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return "community service";
}

function sourceFor(source: string | null | undefined): OpportunitySource {
  if (source === "discord") return "Discord";
  if (source === "external") return "External";
  return "Highlander Hub";
}

function normalizeOpportunity(event: ApiOpportunity): Opportunity {
  const id = String(event.id);
  const title = event.title?.trim() || "Volunteer opportunity";
  return {
    id,
    title,
    description:
      event.description?.trim() ||
      [
        event.org_name ? `Hosted by ${event.org_name}.` : "",
        event.location ? `Location: ${event.location}.` : "",
      ]
        .filter(Boolean)
        .join(" ") ||
      "A volunteer opportunity for NJIT students.",
    category: categoryFor(event),
    starts_at: event.starts_at || new Date().toISOString(),
    ends_at: event.ends_at || event.starts_at || new Date().toISOString(),
    location: event.location?.trim() || "Location TBA",
    org_name: event.org_name?.trim() || "NJIT Organization",
    source: sourceFor(event.source),
    source_id: event.source_id || id,
    source_url: event.source_url || "",
    organizer_email: event.organizer_email || "",
    image_url: event.image_url || "",
  };
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const response = await fetch("/api/opportunities", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not load opportunities.");
  const payload = (await response.json()) as { opportunities?: ApiOpportunity[] };
  return (payload.opportunities ?? []).map(normalizeOpportunity);
}
