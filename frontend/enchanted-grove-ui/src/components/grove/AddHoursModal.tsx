import { useEffect, useState } from "react";
import type { ActivityType } from "@/lib/grove/config";
import { todayISO } from "@/lib/grove/useGrove";

export interface ActivitySubmission {
  eventName: string;
  description: string;
  hours: number;
  internalExternal: "internal" | "external";
  contactEmail: string;
  orgPersonName: string;
  date: string;
}

interface Props {
  open: boolean;
  contactEmail: string;
  onClose: () => void;
  onSubmit: (activity: ActivitySubmission) => Promise<ActivityType>;
}

export function AddHoursModal({ open, contactEmail, onClose, onSubmit }: Props) {
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("2.5");
  const [internalExternal, setInternalExternal] = useState<"" | "internal" | "external">("");
  const [email, setEmail] = useState(contactEmail);
  const [orgPersonName, setOrgPersonName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setEmail(contactEmail), [contactEmail]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(hours);
    if (!(amount > 0 && amount <= 24)) return setError("Enter between 0.5 and 24 hours.");
    if (!internalExternal) return setError("Choose Internal or External.");
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        eventName: eventName.trim(),
        description: description.trim(),
        hours: Math.round(amount * 10) / 10,
        internalExternal,
        contactEmail: email.trim(),
        orgPersonName: orgPersonName.trim(),
        date: todayISO(),
      });
      setEventName("");
      setDescription("");
      setHours("2.5");
      setInternalExternal("");
      setOrgPersonName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not classify this activity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-4 backdrop-blur-sm animate-fade-in sm:items-center" onClick={submitting ? undefined : onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-strong max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl p-7 animate-scale-in" role="dialog" aria-labelledby="add-title">
        <div className="flex items-start justify-between">
          <h2 id="add-title" className="font-display text-3xl text-foreground">Add Volunteer Hours</h2>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="text-2xl leading-none text-muted-foreground hover:text-foreground disabled:opacity-50">×</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Your activity will be placed in a Grove category.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Event Name</span>
            <input required maxLength={200} value={eventName} onChange={(e) => setEventName(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Description</span>
            <textarea required maxLength={4000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="What did you do?" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Hours Served</span>
              <input required type="number" step="0.5" min="0.5" max="24" value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Internal/External</span>
              <select required value={internalExternal} onChange={(e) => setInternalExternal(e.target.value as "internal" | "external")} className={field}>
                <option value="" disabled>Select one</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Contact Email</span>
            <input required type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Org/Person Name</span>
            <input required maxLength={200} value={orgPersonName} onChange={(e) => setOrgPersonName(e.target.value)} className={field} />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-lime mt-6 w-full rounded-full py-3.5 font-display text-lg tracking-wide disabled:cursor-wait disabled:opacity-60">
          {submitting ? "✨ Classifying…" : "✨ Add to Grove"}
        </button>
      </form>
    </div>
  );
}
