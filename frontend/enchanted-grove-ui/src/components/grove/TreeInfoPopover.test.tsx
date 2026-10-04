import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TreeInfoPopover } from "./TreeInfoPopover";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Tree info viewport placement", () => {
  it("keeps a tall card within a short screen and updates on resize", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(520);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(410);
    const height = vi.spyOn(window, "innerHeight", "get").mockReturnValue(514);
    const { container } = render(<TreeInfoPopover x={400} y={500}>Tree details</TreeInfoPopover>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.left).toBe("158px");
    expect(card.style.top).toBe("12px");
    expect(card.style.maxHeight).toBe("490px");
    height.mockReturnValue(300);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(card.style.maxHeight).toBe("276px");
    expect(card.style.top).toBe("12px");
  });

  it("shrinks on narrow screens and clamps negative click coordinates", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(220);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(400);
    const { container } = render(<TreeInfoPopover x={-100} y={-100}>Tree details</TreeInfoPopover>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.width).toBe("196px");
    expect(card.style.left).toBe("12px");
    expect(card.style.top).toBe("12px");
  });
});
