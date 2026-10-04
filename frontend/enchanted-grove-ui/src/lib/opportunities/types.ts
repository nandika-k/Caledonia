/** Normalized opportunity record — every source (Highlander Hub, Discord, external) maps to this shape. */
export type OpportunitySource = "Highlander Hub" | "Discord" | "External";

export const OPPORTUNITY_CATEGORIES = [
  "research",
  "tutoring",
  "environmental",
  "community service",
  "management",
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  starts_at: string;
  ends_at: string;
  location: string;
  org_name: string;
  source: OpportunitySource;
  source_id: string;
  source_url: string;
  organizer_email: string;
  image_url: string;
}

/** One card: one or more records believed to be the same event. */
export interface OpportunityGroup {
  key: string;
  primary: Opportunity;
  members: Opportunity[];
  sources: { source: OpportunitySource; url: string }[];
}

export type DateFilter = "any" | "today" | "week" | "month";
export type SortOrder = "soonest" | "latest" | "relevant";

export interface OpportunityFilters {
  query: string;
  category: OpportunityCategory | "all";
  source: OpportunitySource | "all";
  date: DateFilter;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: OpportunityFilters = {
  query: "",
  category: "all",
  source: "all",
  date: "any",
  sort: "soonest",
};
