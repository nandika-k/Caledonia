export const NEWARK_CAUSES = ["Environment", "Community support"] as const;
export type NewarkCause = (typeof NEWARK_CAUSES)[number];

export interface NewarkProgram {
  id: string;
  organization: string;
  title: string;
  description: string;
  location: string;
  cause: NewarkCause;
  url: string;
}

// Curated from the organizations' official volunteer pages on October 4, 2026.
// These are interest/application pages, not dated events or guaranteed openings.
export const NEWARK_PROGRAMS: NewarkProgram[] = [
  {
    id: "greater-newark-conservancy",
    organization: "Greater Newark Conservancy",
    title: "Grow gardens and support food access",
    description:
      "Help with garden workdays, produce packing, community events, or environmental education. Individual and group applications are available.",
    location: "32 Prince Street, Newark, NJ",
    cause: "Environment",
    url: "https://greaternewark.org/volunteer/",
  },
  {
    id: "united-community-corporation",
    organization: "United Community Corporation",
    title: "Support Newark neighbors",
    description:
      "Apply to volunteer with an organization serving Newark through shelter, senior support, and youth programs. Ask the team which roles are currently available.",
    location: "Newark, NJ — placement confirmed by organizer",
    cause: "Community support",
    url: "https://uccnewark.org/volunteer/",
  },
  {
    id: "united-way-greater-newark",
    organization: "United Way of Greater Newark",
    title: "Connect with community service projects",
    description:
      "Submit a volunteer interest form for community resilience opportunities. Request a Newark placement; the organization also serves Essex and Hudson counties.",
    location: "Greater Newark area — request Newark, NJ",
    cause: "Community support",
    url: "https://uwnewark.org/get-involved/",
  },
];

export function findNewarkPrograms(query: string, cause: NewarkCause | "all") {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return NEWARK_PROGRAMS.filter((program) => {
    const text = [
      program.title,
      program.organization,
      program.description,
      program.location,
      program.cause,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (cause === "all" || program.cause === cause) && words.every((word) => text.includes(word))
    );
  });
}
