import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";

/**
 * T027 [US2] — smoke test: the editor mounts with the merge-field node and the "/" suggestion
 * plugin wired in, hydrates stored `{{token}}` into a labelled chip, and shows the affordance
 * hint. Guards the browser-only wiring (node view + ReactRenderer) against build regressions.
 */

describe("RichTextEditor with merge fields", () => {
  it("mounts and hydrates a stored token into a labelled chip", async () => {
    render(<RichTextEditor label="Body" value="<p>Hi {{first_name}}</p>" onChange={() => {}} />);
    // Affordance hint replaces the old static merge-field list.
    expect(screen.getByText(/Type \/ to insert a merge field/)).toBeInTheDocument();
    // The stored token renders as a chip labelled by its human name.
    const chip = await screen.findByLabelText("Merge field: First name");
    expect(chip).toHaveClass("sendora-merge-chip");
  });
});
