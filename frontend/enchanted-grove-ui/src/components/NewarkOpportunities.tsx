import { useState } from "react";
import { NEWARK_CAUSES, findNewarkPrograms, type NewarkCause } from "@/lib/opportunities/newark";

export function NewarkOpportunities() {
  const [query, setQuery] = useState("");
  const [cause, setCause] = useState<NewarkCause | "all">("all");
  const programs = findNewarkPrograms(query, cause);

  return (
    <section className="glass mt-8 rounded-2xl p-5 md:p-6" aria-labelledby="newark-heading">
      <p className="text-xs uppercase tracking-widest text-primary">
        Beyond campus · External opportunities
      </p>
      <h2 id="newark-heading" className="mt-2 font-display text-3xl">
        Volunteer in Newark, NJ
      </h2>
      <p className="mt-2 text-muted-foreground">
        Find local volunteer programs and apply directly with the organization. These are ongoing
        programs; confirm current openings, dates, eligibility, and service hours with the
        organizer.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-sm">
          Search Newark programs
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try gardens, youth, or community…"
            className="rounded-xl border border-border bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cause
          <select
            value={cause}
            onChange={(event) => setCause(event.target.value as NewarkCause | "all")}
            className="rounded-xl border border-border bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All causes</option>
            {NEWARK_CAUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4" aria-live="polite">
        <p className="mb-3 text-sm text-muted-foreground">
          {programs.length} local {programs.length === 1 ? "program" : "programs"}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {programs.map((program) => (
            <article
              key={program.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-5"
            >
              <span className="text-xs text-primary">{program.cause} · Ongoing program</span>
              <h3 className="font-display text-2xl">{program.title}</h3>
              <p className="text-sm font-medium">{program.organization}</p>
              <p className="text-sm text-muted-foreground">{program.location}</p>
              <p className="text-sm text-muted-foreground">{program.description}</p>
              <a
                href={program.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Explore volunteering with ${program.organization} (opens in a new tab)`}
                className="btn-lime mt-auto self-start rounded-full px-4 py-2.5 text-sm font-medium"
              >
                Explore & apply ↗
              </a>
            </article>
          ))}
        </div>
        {programs.length === 0 && (
          <div className="rounded-xl border border-border p-6 text-center">
            <p>No local programs match. Try another keyword or cause.</p>
            <button
              className="btn-lime mt-3 rounded-full px-4 py-2"
              onClick={() => {
                setQuery("");
                setCause("all");
              }}
            >
              Clear local filters
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Curated from official organization pages · Checked October 4, 2026
      </p>
    </section>
  );
}
