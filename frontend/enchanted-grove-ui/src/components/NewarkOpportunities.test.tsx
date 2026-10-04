import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NewarkOpportunities } from "./NewarkOpportunities";

afterEach(cleanup);

describe("Newark volunteer discovery", () => {
  it("combines keyword and cause filters and resets an empty result", () => {
    render(<NewarkOpportunities />);
    const search = screen.getByRole("searchbox", { name: "Search Newark programs" });
    fireEvent.change(search, { target: { value: "gardens" } });
    expect(screen.getByText("Greater Newark Conservancy")).toBeInTheDocument();
    expect(screen.queryByText("United Community Corporation")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Cause" }), {
      target: { value: "Community support" },
    });
    expect(screen.getByText(/No local programs match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear local filters" }));
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(search).toHaveValue("");
  });

  it("links to official applications without inventing event dates", () => {
    render(<NewarkOpportunities />);
    const link = screen.getByRole("link", {
      name: /Explore volunteering with Greater Newark Conservancy/,
    });
    expect(link).toHaveAttribute("href", "https://greaternewark.org/volunteer/");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByText(/Ongoing program/)).toHaveLength(3);
  });
});
