import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  filterMergeFields,
  slashMenuKeydown,
  SlashMenuList,
} from "@/components/rich-text-editor/merge-suggestion";

/**
 * T022 [US2] — the slash menu filters the closed vocabulary, groups recipient vs sender,
 * navigates by keyboard, and confirms/dismisses (research §3, Constitution III).
 */

describe("filterMergeFields", () => {
  it("returns all fields for an empty query", () => {
    expect(filterMergeFields("").length).toBeGreaterThanOrEqual(12);
  });

  it("matches on label and token, case-insensitively", () => {
    const byLabel = filterMergeFields("company").map((f) => f.token);
    expect(byLabel).toContain("company");
    const bySender = filterMergeFields("my_title").map((f) => f.token);
    expect(bySender).toContain("my_title");
    const byWord = filterMergeFields("Your").map((f) => f.group);
    expect(byWord.every((g) => g === "sender")).toBe(true);
  });

  it("returns nothing for a query that matches no field", () => {
    expect(filterMergeFields("zzz-nope")).toEqual([]);
  });
});

describe("slashMenuKeydown (pure keyboard logic)", () => {
  it("moves down and wraps", () => {
    expect(slashMenuKeydown("ArrowDown", 0, 3)).toEqual({ action: "move", index: 1 });
    expect(slashMenuKeydown("ArrowDown", 2, 3)).toEqual({ action: "move", index: 0 });
  });
  it("moves up and wraps", () => {
    expect(slashMenuKeydown("ArrowUp", 0, 3)).toEqual({ action: "move", index: 2 });
  });
  it("selects on Enter and closes on Escape", () => {
    expect(slashMenuKeydown("Enter", 1, 3)).toEqual({ action: "select", index: 1 });
    expect(slashMenuKeydown("Escape", 1, 3)).toEqual({ action: "close", index: 1 });
  });
  it("ignores other keys", () => {
    expect(slashMenuKeydown("a", 1, 3)).toEqual({ action: "ignore", index: 1 });
  });
});

describe("SlashMenuList", () => {
  const items = filterMergeFields("");

  it("renders a labelled listbox grouped into Recipient and Your details", () => {
    render(<SlashMenuList items={items} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Recipient")).toBeInTheDocument();
    expect(screen.getByText("Your details")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBe(items.length);
  });

  it("calls onSelect with the token when an option is clicked", () => {
    const onSelect = vi.fn();
    render(<SlashMenuList items={items} activeIndex={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("First name"));
    expect(onSelect).toHaveBeenCalledWith("first_name");
  });

  it("marks the active option via aria-activedescendant", () => {
    render(<SlashMenuList items={items} activeIndex={1} onSelect={() => {}} />);
    const listbox = screen.getByRole("listbox");
    const active = listbox.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveAttribute("aria-selected", "true");
  });
});
