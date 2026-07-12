import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { MergeFieldNode, hydrateMergeTokens } from "@/components/rich-text-editor/merge-field-node";

/**
 * T021 [US2] — the merge chip is an atomic inline node that serializes back to `{{token}}`
 * (research §3, SC-003), and stored `{{token}}` text hydrates into chips when loaded.
 */

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ heading: false }), MergeFieldNode],
    content,
  });
}

describe("hydrateMergeTokens", () => {
  it("wraps known tokens (both namespaces) in a chip span, leaving surrounding text", () => {
    const out = hydrateMergeTokens("<p>Hi {{first_name}}, I'm {{my_name}}.</p>");
    expect(out).toContain('data-merge-token="first_name"');
    expect(out).toContain('data-merge-token="my_name"');
  });

  it("leaves unknown tokens as plain text (they are not part of the vocabulary)", () => {
    const out = hydrateMergeTokens("<p>{{salary}}</p>");
    expect(out).not.toContain("data-merge-token");
    expect(out).toContain("{{salary}}");
  });
});

describe("merge chip node", () => {
  it("is an atomic inline node", () => {
    expect(MergeFieldNode.config.inline).toBe(true);
    expect(MergeFieldNode.config.atom).toBe(true);
  });

  it("serializes a chip back to exactly {{token}} in getHTML (stored contract)", () => {
    const editor = makeEditor(hydrateMergeTokens("<p>Hi {{first_name}} at {{company}}</p>"));
    const html = editor.getHTML();
    expect(html).toContain("{{first_name}}");
    expect(html).toContain("{{company}}");
    // The parsed document carries the tokens as atomic nodes, not raw text.
    let mergeNodes = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "mergeField") mergeNodes++;
    });
    expect(mergeNodes).toBe(2);
    editor.destroy();
  });

  it("deletes as a single unit (removing the node removes the whole token)", () => {
    const editor = makeEditor(hydrateMergeTokens("<p>{{first_name}}</p>"));
    // Select the whole doc content and delete: the chip goes entirely, no stray braces.
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(editor.getHTML()).not.toContain("{{");
    editor.destroy();
  });
});
