import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { ACTIVITY_TYPES, getTreeLevel } from "@/lib/grove/config";
import { useGrove } from "@/lib/grove/useGrove";
import type { ActivityType } from "@/lib/grove/config";
import type { Volunteer } from "@/lib/grove/types";
import { AddHoursModal, type ActivitySubmission } from "@/components/grove/AddHoursModal";
import { ProfilePanel } from "@/components/grove/ProfilePanel";

const GroveScene = lazy(() => import("@/components/grove3d/GroveScene"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Enchanted Grove — GirlHacks 2026 Volunteer Forest" },
      { name: "description", content: "An interactive enchanted forest where every tree is a volunteer. Add your hours and watch the Grove grow." },
      { property: "og:title", content: "Enchanted Grove — GirlHacks 2026" },
      { property: "og:description", content: "Every contribution helps the Grove grow. Explore the volunteer forest of NJIT GirlHacks 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { volunteers, stats, addActivity, ensureVolunteer } = useGrove();
  const [auth, setAuth] = useState<{ google_sub: string; email: string; name: string | null; csrf_token: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [card, setCard] = useState<{ v: Volunteer; x: number; y: number } | null>(null);
  const [growingId, setGrowingId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { authenticated: boolean; user: { google_sub: string; email: string; name: string | null }; csrf_token: string };
      })
      .then((data) => {
        if (!alive) return;
        if (data?.authenticated) {
          setAuth({ ...data.user, csrf_token: data.csrf_token });
          ensureVolunteer(data.user.google_sub, data.user.name || data.user.email);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setAuthLoading(false); });
    return () => { alive = false; };
  }, [ensureVolunteer]);

  const userId = auth?.google_sub;
  const me = userId ? volunteers.find((v) => v.id === userId) : undefined;
  const profile = volunteers.find((v) => v.id === profileId) ?? null;
  const cardV = card ? volunteers.find((v) => v.id === card.v.id) ?? card.v : null;

  const handleActivitySubmit = async (activity: ActivitySubmission): Promise<ActivityType> => {
    if (!auth || !userId) throw new Error("Sign in with your NJIT Google account to add hours.");
    const response = await fetch("/api/activities", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": auth.csrf_token,
      },
      body: JSON.stringify({
        event_name: activity.eventName,
        description: activity.description,
        hours: activity.hours,
        internal_external: activity.internalExternal,
        contact_email: activity.contactEmail,
        org_person_name: activity.orgPersonName,
        date: activity.date,
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      activity?: { activityType?: string };
      error?: string;
    };
    if (!response.ok) throw new Error(result.error || "Could not classify this activity. Please try again.");
    const category = result.activity?.activityType;
    if (!category || !ACTIVITY_TYPES.includes(category as ActivityType)) {
      throw new Error("The classifier returned an unknown category. Please try again.");
    }
    const activityType = category as ActivityType;
    ensureVolunteer(userId, auth.name || auth.email);
    const before = getTreeLevel(me?.volunteerHours ?? 0).level;
    addActivity({ ...activity, activityType, userId });
    setAddOpen(false);
    setFocus((f) => ({ id: userId, n: (f?.n ?? 0) + 1 }));
    setGrowingId(null);
    requestAnimationFrame(() => setGrowingId(userId));
    setTimeout(() => setGrowingId(null), 1800);
    const after = getTreeLevel((me?.volunteerHours ?? 0) + activity.hours);
    toast(after.level !== before ? `✨ Your tree grew into ${/^[AEIOU]/.test(after.label) ? "an" : "a"} ${after.label}!` : "✨ Your contribution has helped the Grove grow!", {
      description: `+${activity.hours} hours · ${activityType}`,
    });
    return activityType;
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {mounted ? (
        <Suspense fallback={<GroveLoading />}>
          <GroveScene
            volunteers={volunteers}
            currentUserId={userId ?? null}
            selectedId={card?.v.id ?? null}
            growingId={growingId}
            focusId={focus ? `${focus.id}:${focus.n}` : null}
            onSelect={(v, p) => setCard({ v, x: p.x, y: p.y })}
            onBackground={() => setCard(null)}
          />
        </Suspense>
      ) : (
        <GroveLoading />
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border/60 bg-gradient-to-b from-background/80 to-transparent px-5 py-4 md:px-10">
        <h1 className="font-display-sc text-xl tracking-[0.18em] text-foreground md:text-2xl">🌳 Enchanted Grove</h1>
        <nav className="pointer-events-auto flex items-center gap-2">
          {auth ? (
            <>
              <button onClick={() => setProfileId(auth.google_sub)} className="rounded-full px-4 py-2 text-sm tracking-wide text-foreground/90 hover:text-primary">My Profile</button>
              <button onClick={() => setAddOpen(true)} className="hidden rounded-full border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10 md:block">🌱 Add Hours</button>
            </>
          ) : (
            <a href="/auth/login" className="rounded-full border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10">{authLoading ? "Checking sign-in…" : "Sign in with NJIT Google"}</a>
          )}
        </nav>
      </header>

      <section className="glass absolute left-4 top-20 z-10 hidden rounded-2xl px-5 py-4 md:block md:left-8" aria-label="Grove statistics">
        <h2 className="font-display text-lg text-foreground">Grove Statistics</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <Stat icon="🌱" label="Volunteers" value={stats.volunteers} />
          <Stat icon="🌿" label="Total Hours" value={stats.totalHours} />
          <Stat icon="✨" label="Activities" value={stats.activities} />
          <Stat icon="🌳" label="This month" value={`+${stats.growth}%`} />
        </dl>
      </section>
      <section className="glass absolute inset-x-3 bottom-3 z-10 flex justify-around rounded-2xl px-3 py-2 text-xs md:hidden">
        <span>🌱 {stats.volunteers}</span><span>🌿 {stats.totalHours}h</span><span>✨ {stats.activities}</span><span>🌳 +{stats.growth}%</span>
      </section>

      <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 font-display text-lg italic text-foreground/60 lg:block">
        Every contribution helps the Grove grow.
      </p>

      <button
        onClick={() => { if (auth) setAddOpen(true); else window.location.assign("/auth/login"); }}
        className="btn-lime fab-pulse fixed bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full px-7 py-3.5 font-display text-lg tracking-wide md:bottom-8 md:left-auto md:right-24 md:translate-x-0"
      >
        {auth ? "🌱 Add Hours" : "Sign in to Add Hours"}
      </button>

      {card && cardV && (
        <div
          className="glass-strong fixed z-30 w-60 rounded-2xl p-5 animate-scale-in"
          style={{ left: Math.min(card.x + 12, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260), top: Math.min(card.y + 12, (typeof window !== "undefined" ? window.innerHeight : 800) - 230) }}
        >
          <div className="flex items-start justify-between">
            <div className="font-display text-2xl">🌳 {cardV.name}</div>
            <button onClick={() => setCard(null)} aria-label="Close" className="text-xl leading-none text-muted-foreground">×</button>
          </div>
          <div className="mt-1 text-xs text-primary">{getTreeLevel(cardV.volunteerHours).label}</div>
          <div className="mt-3 space-y-0.5 text-sm">
            <div><span className="font-display text-xl text-lavender">{cardV.volunteerHours}</span> Hours</div>
            <div><span className="font-display text-xl text-lavender">{cardV.activityCount}</span> Activities</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            🌿 Volunteer since {new Date(cardV.joinedAt + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => { setProfileId(cardV.id); setCard(null); }} className="mt-4 w-full rounded-full border border-primary/40 py-2 text-sm text-primary hover:bg-primary/10">
            View Profile
          </button>
        </div>
      )}

      <AddHoursModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleActivitySubmit}
        contactEmail={auth?.email ?? ""}
      />
      <ProfilePanel volunteer={profile} isMe={profileId === userId} onClose={() => setProfileId(null)} />
      <Toaster position="top-center" theme="dark" toastOptions={{ className: "glass-strong !text-foreground" }} />
    </main>
  );
}

function GroveLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <p className="font-display text-xl italic text-muted-foreground animate-pulse">The Grove is awakening…</p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span>{icon}</span>
      <dd className="font-display text-xl text-lavender">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
