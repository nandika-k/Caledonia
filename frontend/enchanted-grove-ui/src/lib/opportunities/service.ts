import { mockOpportunities } from "./mockOpportunities";
import type { Opportunity } from "./types";

/**
 * Single entry point for opportunity data. Swap the body for a real API call
 * (normalizing each source into Opportunity) without touching the UI.
 */
export async function getOpportunities(): Promise<Opportunity[]> {
  await new Promise((r) => setTimeout(r, 450));
  return mockOpportunities;
}
