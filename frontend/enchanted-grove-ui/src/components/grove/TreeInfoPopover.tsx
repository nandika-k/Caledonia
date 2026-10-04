import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Keep the measured card inside the visible viewport, including mobile keyboards. */
export function TreeInfoPopover({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 240, maxHeight: 0 });

  useLayoutEffect(() => {
    const update = () => {
      const card = ref.current;
      if (!card) return;
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const cardWidth = Math.min(240, Math.max(0, width - 24));
      const maxHeight = Math.max(0, height - 24);
      const cardHeight = Math.min(card.offsetHeight, maxHeight);
      setPosition({
        left: Math.max(left + 12, Math.min(x + 12, left + width - cardWidth - 12)),
        top: Math.max(top + 12, Math.min(y + 12, top + height - cardHeight - 12)),
        width: cardWidth,
        maxHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="glass-strong fixed z-30 overflow-y-auto overscroll-contain break-words rounded-2xl p-5"
      style={{ ...position, visibility: position.maxHeight ? "visible" : "hidden" }}
    >
      {children}
    </div>
  );
}
