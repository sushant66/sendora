"use client";

import type { RefObject } from "react";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { MERGE_FIELD_GROUPS } from "@/lib/templates/fields";

/**
 * Lightweight "Insert field" affordance for the plain-text subject (feature 002, US2,
 * FR-011). The subject is not a rich-text surface, so instead of chips this inserts a raw
 * `{{token}}` at the caret (research §4). Grouped into Recipient / Your details, matching the
 * body slash menu. `containerRef` wraps the subject input so we can read the caret position.
 */
export function InsertFieldMenu({
  value,
  onChange,
  containerRef,
}: {
  value: string;
  onChange: (next: string) => void;
  containerRef: RefObject<HTMLElement | null>;
}) {
  function insert(token: string) {
    const marker = `{{${token}}}`;
    const input = containerRef.current?.querySelector("input") as HTMLInputElement | null;
    if (!input) {
      onChange(value ? `${value} ${marker}` : marker);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = value.slice(0, start) + marker + value.slice(end);
    onChange(next);
    // Restore the caret just after the inserted token, once React has re-rendered.
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + marker.length;
      try {
        input.setSelectionRange(pos, pos);
      } catch {
        /* input may not support selection ranges */
      }
    });
  }

  const items = MERGE_FIELD_GROUPS.map((g) => ({
    type: "section" as const,
    title: g.label,
    items: g.fields.map((f) => ({ label: f.label, onClick: () => insert(f.token) })),
  }));

  return <DropdownMenu button={{ label: "Insert field", variant: "ghost", size: "sm" }} items={items} menuWidth={220} />;
}
