import { Node, mergeAttributes } from "@tiptap/core";
import { MERGE_FIELD_BY_TOKEN } from "@/lib/templates/fields";

/**
 * Atomic merge-field chip (feature 002, US2, FR-013/SC-003). An inline, atomic ProseMirror
 * node that carries the token in an attribute and DISPLAYS the human label (via a node view),
 * but SERIALIZES back to the exact `{{token}}` text so the stored contract, sanitizer, and
 * merge engine are unchanged (research §3). Because it is `atom`, it inserts and deletes as a
 * single unit and can never be edited into a malformed token.
 */

export const MERGE_CHIP_CLASS = "sendora-merge-chip";

/** Only these tokens hydrate into chips; unknown `{{...}}` stays literal text. */
const HYDRATE_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * Convert stored `{{token}}` text into chip markup the editor can parse on load (US2, T026).
 * Known tokens become `<span data-merge-token="...">{{token}}</span>`; unknown tokens are left
 * as plain text (they are outside the vocabulary and should never have been saved).
 */
export function hydrateMergeTokens(html: string): string {
  return html.replace(HYDRATE_RE, (full, token: string) =>
    MERGE_FIELD_BY_TOKEN[token] ? `<span data-merge-token="${token}">${full}</span>` : full,
  );
}

export const MergeFieldNode = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-merge-token"),
        renderHTML: (attrs) => (attrs.token ? { "data-merge-token": attrs.token as string } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-token]" }];
  },

  // Serialization form (getHTML / clipboard): the exact `{{token}}` text, wrapped in a span
  // the server sanitizer discards while keeping its text content.
  renderHTML({ node, HTMLAttributes }) {
    const token = (node.attrs.token as string) ?? "";
    return ["span", mergeAttributes(HTMLAttributes, { class: MERGE_CHIP_CLASS }), `{{${token}}}`];
  },

  // Plain-text serialization (getText) also round-trips to the token.
  renderText({ node }) {
    return `{{${node.attrs.token as string}}}`;
  },

  // In-editor display: a friendly, non-editable chip labelled by the field's human name.
  addNodeView() {
    return ({ node }) => {
      const token = (node.attrs.token as string) ?? "";
      const label = MERGE_FIELD_BY_TOKEN[token]?.label ?? token;
      const dom = document.createElement("span");
      dom.className = MERGE_CHIP_CLASS;
      dom.textContent = label;
      dom.setAttribute("data-merge-token", token);
      dom.setAttribute("contenteditable", "false");
      dom.setAttribute("role", "img");
      dom.setAttribute("aria-label", `Merge field: ${label}`);
      return { dom };
    };
  },
});
