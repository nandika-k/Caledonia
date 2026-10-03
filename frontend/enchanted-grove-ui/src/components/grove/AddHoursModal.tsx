import { useState } from "react";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/grove/config";
import { todayISO } from "@/lib/grove/useGrove";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (a: { hours: number; activityType: ActivityType; date: string; description?: string | undefined }) => void;
}

export function AddHoursModal({ open, onClose, onSubmit }: Props) {
  const [hours, setHours] = useState("2.5");
  const [type, setType] = useState<ActivityType | "">("");
  const [date, setDate] = useState(todayISO());
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hours);
    if (!(h > 0 && h <= 24)) return setError("Enter between 0.5 and 24 hours.");
    if (!type) return setError("Pick an activity.");
    onSubmit({ hours: Math.round(h * 10) / 10, activityType: type, date, description: desc.trim() || undefined });
    setType("");
    setDesc("");
    setError("");
  };

  const field = "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-4 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-strong w-full max-w-md rounded-3xl p-7 animate-scale-in" role="dialog" aria-labelledby="add-title">
        <div className="flex items-start justify-between">
          <h2 id="add-title" className="font-display text-3xl text-foreground">Add Volunteer Hours</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Every contribution helps the Grove grow.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Hours</span>
            <input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Volunteer Activity</span>
            <select value={type} onChange={(e) => setType(e.target.value as ActivityType)} className={field}>
              <option value="" disabled>Select activity</option>
              {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Date</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className={`${field} [color-scheme:dark]`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-lavender">Description <span className="normal-case tracking-normal text-muted-foreground">(optional)</span></span>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className={field} placeholder="What did you help with?" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button type="submit" className="btn-lime mt-6 w-full rounded-full py-3.5 font-display text-lg tracking-wide">✨ Add to Grove</button>
      </form>
    </div>
  );
}
