import { useState } from "react";
import { VineFrame } from "@/components/VinesBackground";
import { CATEGORY_META } from "@/lib/opportunities/logic";
import { NEWARK_CAUSES, findNewarkPrograms, type NewarkCause } from "@/lib/opportunities/newark";

const CAUSE_META = {
  Environment: CATEGORY_META.environmental,
  "Community support": CATEGORY_META["community service"],
  "STEM education": CATEGORY_META.tutoring,
  "Youth mentoring": CATEGORY_META.tutoring,
};

function ProgramImage({ cause }: { cause: NewarkCause }) {
  const [failed, setFailed] = useState(false);
  const meta = CAUSE_META[cause];
  return failed ? (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-secondary via-muted to-background">
      <span className="text-5xl opacity-80" aria-hidden>
        {meta.icon}
      </span>
    </div>
  ) : (
    <img
      src={meta.image}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition duration-200 group-hover:brightness-110"
    />
  );
}

export function NewarkOpportunities() {
  const [query, setQuery] = useState("");
  const [cause, setCause] = useState<NewarkCause | "all">("all");
  const programs = findNewarkPrograms(query, cause);

  return (
    <section aria-labelledby="newark-heading">
      <h2 id="newark-heading" className="mt-6 font-display text-3xl">
        Volunteer in Newark, NJ
      </h2>
      <p className="mt-2 text-muted-foreground">
        Find local volunteer programs and apply directly with the organization. These are ongoing
        programs; confirm current openings, dates, eligibility, and service hours with the
        organizer.
      </p>
      <div className="glass mt-4 grid gap-3 rounded-2xl p-4 md:p-5 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-sm">
          Search Newark programs
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try gardens, youth, or community…"
            className="w-full rounded-full border border-border bg-input px-5 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs uppercase tracking-widest text-muted-foreground">
          Cause
          <select
            value={cause}
            onChange={(event) => setCause(event.target.value as NewarkCause | "all")}
            className="w-full min-w-0 rounded-full border border-border bg-input px-4 py-3 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">All causes</option>
            {NEWARK_CAUSES.map((item) => (
              <option key={item} value={item} className="bg-popover">
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-8" aria-live="polite">
        <p className="mb-3 text-sm text-muted-foreground">
          {programs.length} local {programs.length === 1 ? "program" : "programs"}
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <article
              key={program.id}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 transition duration-200 hover:-translate-y-1 hover:border-canopy/60 hover:shadow-[0_18px_40px_-18px] hover:shadow-canopy/40"
            >
              <VineFrame />
              <div className="aspect-[16/9] overflow-hidden">
                <ProgramImage cause={program.cause} />
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5 pb-8">
                <span className="inline-flex self-start items-center gap-1 rounded-full border border-border bg-secondary/70 px-3 py-0.5 text-xs">
                  {CAUSE_META[program.cause].icon} {program.cause}
                </span>
                <h3 className="font-display text-2xl leading-tight break-words">{program.title}</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>📅 Ongoing program · Confirm schedule</li>
                  <li className="break-words">📍 {program.location}</li>
                  <li className="break-words">🏢 {program.organization}</li>
                </ul>
                <p className="text-sm text-muted-foreground">{program.description}</p>
                <span className="self-start rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] tracking-wide text-primary">
                  External
                </span>
                <a
                  href={program.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Explore volunteering with ${program.organization} (opens in a new tab)`}
                  className="btn-lime mt-auto self-start rounded-full px-5 py-2.5 text-sm font-medium"
                >
                  Explore & apply ↗
                </a>
              </div>
            </article>
          ))}
        </div>
        {programs.length === 0 && (
          <div className="glass mx-auto max-w-md rounded-2xl px-6 py-10 text-center">
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
