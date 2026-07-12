"use client";

import { forwardRef, useImperativeHandle, useState, Fragment } from "react";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { MERGE_FIELDS, MERGE_GROUP_LABEL, type MergeFieldDescriptor } from "@/lib/templates/fields";

/**
 * Inline "/" slash menu for inserting merge fields (feature 002, US2, FR-010). Built on
 * `@tiptap/suggestion`; renders an accessible listbox grouped into Recipient / Your details,
 * filterable by typing, navigable by keyboard, dismissed with Escape (Constitution III). On
 * confirm it inserts an atomic {@link MergeFieldNode} chip.
 */

/** Filter the closed vocabulary by label, token, or group name (case-insensitive). */
export function filterMergeFields(query: string): MergeFieldDescriptor[] {
  const q = query.trim().toLowerCase();
  if (!q) return MERGE_FIELDS;
  return MERGE_FIELDS.filter(
    (f) =>
      f.label.toLowerCase().includes(q) ||
      f.token.toLowerCase().includes(q) ||
      MERGE_GROUP_LABEL[f.group].toLowerCase().includes(q),
  );
}

export type SlashMenuAction = { action: "move" | "select" | "close" | "ignore"; index: number };

/** Pure keyboard reducer for the menu, shared by the plugin and tests. */
export function slashMenuKeydown(key: string, index: number, count: number): SlashMenuAction {
  if (key === "Escape") return { action: "close", index };
  if (count === 0) return { action: "ignore", index };
  switch (key) {
    case "ArrowDown":
      return { action: "move", index: (index + 1) % count };
    case "ArrowUp":
      return { action: "move", index: (index - 1 + count) % count };
    case "Enter":
    case "Tab":
      return { action: "select", index };
    default:
      return { action: "ignore", index };
  }
}

/** Controlled, accessible listbox of merge fields grouped by namespace. */
export function SlashMenuList({
  items,
  activeIndex,
  onSelect,
}: {
  items: MergeFieldDescriptor[];
  activeIndex: number;
  onSelect: (token: string) => void;
}) {
  return (
    <ul
      role="listbox"
      aria-label="Merge fields"
      className="sendora-slash-menu"
      aria-activedescendant={items.length ? `merge-opt-${activeIndex}` : undefined}
    >
      {items.map((f, i) => (
        <Fragment key={f.token}>
          {(i === 0 || items[i - 1]!.group !== f.group) && (
            <li role="presentation" className="sendora-slash-group">
              {MERGE_GROUP_LABEL[f.group]}
            </li>
          )}
          <li
            id={`merge-opt-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            className={`sendora-slash-option${i === activeIndex ? " is-active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(f.token)}
          >
            {f.label}
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

type PopupProps = { items: MergeFieldDescriptor[]; command: (item: MergeFieldDescriptor) => void };
type PopupHandle = { onKeyDown: (props: { event: KeyboardEvent }) => boolean; onClose: () => boolean };

/** Stateful wrapper mounted by the suggestion plugin: owns the active index and keyboard. */
const SlashMenuPopup = forwardRef<PopupHandle, PopupProps & { onClose: () => void }>(
  function SlashMenuPopup({ items, command, onClose }, ref) {
    const [activeIndex, setActiveIndex] = useState(0);
    // When the filtered list changes (the user typed), reset the highlight to the first item.
    // Adjusting state during render on a prop change is the sanctioned React pattern (no effect).
    const [prevItems, setPrevItems] = useState(items);
    if (prevItems !== items) {
      setPrevItems(items);
      setActiveIndex(0);
    }

    useImperativeHandle(ref, () => ({
      onClose: () => {
        onClose();
        return true;
      },
      onKeyDown: ({ event }) => {
        const r = slashMenuKeydown(event.key, activeIndex, items.length);
        if (r.action === "move") {
          setActiveIndex(r.index);
          return true;
        }
        if (r.action === "select") {
          const f = items[r.index];
          if (f) command(f);
          return true;
        }
        if (r.action === "close") {
          onClose();
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;
    return (
      <SlashMenuList
        items={items}
        activeIndex={activeIndex}
        onSelect={(token) => {
          const f = items.find((x) => x.token === token);
          if (f) command(f);
        }}
      />
    );
  },
);

/** The Tiptap extension wiring the "/" suggestion to the merge-field node. */
export const MergeSuggestion = Extension.create({
  name: "mergeSuggestion",

  addProseMirrorPlugins() {
    return [
      Suggestion<MergeFieldDescriptor>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterMergeFields(query),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: "mergeField", attrs: { token: props.token } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let renderer: ReactRenderer<PopupHandle, PopupProps & { onClose: () => void }> | null = null;
          let popup: HTMLElement | null = null;
          let open = true;

          function place(clientRect?: (() => DOMRect | null) | null) {
            if (!popup || !clientRect) return;
            const rect = clientRect();
            if (!rect) return;
            popup.style.left = `${rect.left + window.scrollX}px`;
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
          }

          function cleanup() {
            popup?.remove();
            popup = null;
            renderer?.destroy();
            renderer = null;
          }

          return {
            onStart: (p: any) => {
              open = true;
              renderer = new ReactRenderer(SlashMenuPopup, {
                editor: p.editor,
                props: {
                  items: p.items,
                  command: (item: MergeFieldDescriptor) => p.command({ token: item.token }),
                  onClose: () => {
                    open = false;
                    cleanup();
                  },
                },
              });
              popup = document.createElement("div");
              popup.className = "sendora-slash-popup";
              popup.appendChild(renderer.element);
              document.body.appendChild(popup);
              place(p.clientRect);
            },
            onUpdate: (p: any) => {
              renderer?.updateProps({
                items: p.items,
                command: (item: MergeFieldDescriptor) => p.command({ token: item.token }),
              });
              place(p.clientRect);
            },
            onKeyDown: (p: any) => {
              if (!open) return false;
              return renderer?.ref?.onKeyDown({ event: p.event }) ?? false;
            },
            onExit: () => {
              open = false;
              cleanup();
            },
          };
        },
      }),
    ];
  },
});
