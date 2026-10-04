import { useEffect, useRef, useState } from "react";
import { Droplets, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FountainControlsProps {
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function FountainControls({
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
}: FountainControlsProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className="absolute right-3 top-[8.5rem] z-20 flex flex-col items-end gap-2 md:right-8"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Spring controls"
        aria-expanded={open}
        aria-controls="waterfall-controls"
        title="Spring controls"
        onClick={() => setOpen((value) => !value)}
        className="glass size-11 rounded-full border-border/70 text-foreground hover:bg-secondary hover:text-primary"
      >
        <Droplets aria-hidden="true" />
      </Button>
      {open && (
        <div
          id="waterfall-controls"
          className="glass-strong absolute right-14 top-0 w-48 rounded-lg p-3 text-foreground shadow-lg md:right-0 md:top-14 md:w-56 md:p-4"
          role="group"
          aria-label="Spring settings"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Spring</h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close spring controls"
              title="Close"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? "Pause spring" : "Resume spring"}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {playing ? "Pause water" : "Resume water"}
          </Button>
          <label htmlFor="waterfall-speed" className="mt-5 flex justify-between text-sm">
            <span>Ripple speed</span>
            <span className="tabular-nums text-primary">{speed.toFixed(1)}×</span>
          </label>
          <input
            id="waterfall-speed"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            className="mt-3 w-full cursor-pointer accent-primary"
            aria-valuetext={`${speed.toFixed(1)} times speed`}
          />
        </div>
      )}
    </div>
  );
}
