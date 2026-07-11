"use client";

import { useState } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { BoldGlyph, ItalicGlyph, BulletListGlyph, OrderedListGlyph, LinkGlyph } from "./glyphs";

/**
 * Constrained rich-text editor (User Story 3, FR-009a) shared by compose and the template
 * library. Only bold, italic, ordered/unordered lists, and links — nothing else. The
 * toolbar is an accessible Astryx Toolbar of ToggleButtons (roving tabindex, aria-pressed,
 * labelled); the editable region exposes role=textbox with an accessible name so it meets
 * WCAG 2.1 AA (Constitution Principle III).
 */

export function RichTextEditor({
  label,
  value,
  onChange,
  ariaDescribedBy,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  ariaDescribedBy?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        class: "sendora-rte-content",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Subscribe to selection/content so the toolbar reflects the current marks.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      link: editor?.isActive("link") ?? false,
    }),
  }) ?? { bold: false, italic: false, bulletList: false, orderedList: false, link: false };

  if (!editor) return null;

  function openLink() {
    setLinkUrl((editor!.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  }
  function applyLink() {
    const href = linkUrl.trim();
    if (href) editor!.chain().focus().extendMarkRange("link").setLink({ href }).run();
    else editor!.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <VStack gap={2} align="stretch">
      <EditorStyles />
      <Text as="label" size="sm" weight="medium">{label}</Text>
      <VStack gap={0} align="stretch" className="sendora-rte">
        <VStack align="stretch" className="sendora-rte-toolbar">
          <Toolbar
            label={`${label} formatting`}
            startContent={
              <HStack gap={1}>
                <ToggleButton label="Bold" isIconOnly icon={<BoldGlyph />} size="sm" isPressed={state.bold} onPressedChange={() => editor.chain().focus().toggleBold().run()} />
                <ToggleButton label="Italic" isIconOnly icon={<ItalicGlyph />} size="sm" isPressed={state.italic} onPressedChange={() => editor.chain().focus().toggleItalic().run()} />
                <ToggleButton label="Bulleted list" isIconOnly icon={<BulletListGlyph />} size="sm" isPressed={state.bulletList} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} />
                <ToggleButton label="Numbered list" isIconOnly icon={<OrderedListGlyph />} size="sm" isPressed={state.orderedList} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} />
                <ToggleButton label="Link" isIconOnly icon={<LinkGlyph />} size="sm" isPressed={state.link} onPressedChange={openLink} />
              </HStack>
            }
          />
        </VStack>
        {linkOpen && (
          <HStack gap={2} align="end" className="sendora-rte-linkbar">
            <TextInput
              label="Link URL"
              type="text"
              size="sm"
              hasAutoFocus
              placeholder="https://example.com"
              value={linkUrl}
              onChange={setLinkUrl}
            />
            <Button label="Apply" variant="secondary" size="sm" onClick={applyLink} />
            <Button label="Cancel" variant="ghost" size="sm" onClick={() => setLinkOpen(false)} />
          </HStack>
        )}
        <EditorContent editor={editor} />
      </VStack>
    </VStack>
  );
}

/** Token-based styling for the ProseMirror surface (no design-system primitive for it). */
function EditorStyles() {
  return (
    <style>{`
      .sendora-rte {
        border: var(--border-width) solid var(--color-border-emphasized);
        border-radius: var(--radius-element);
        background: var(--color-background-surface);
        overflow: hidden;
      }
      .sendora-rte:focus-within { box-shadow: var(--shadow-inset-selected); }
      /* Astryx Toolbar is Section-based and bleeds via a negative block margin, meant to sit
         inside a padded Section. Here it lives in a zero-padding, overflow-hidden box, so that
         bleed clips the buttons at the top edge. Neutralize the bleed and give the toolbar its
         own padded, bordered row so the controls read as a proper formatting toolbar. */
      .sendora-rte-toolbar { padding: var(--spacing-1) var(--spacing-2); background: var(--color-background-muted); border-bottom: var(--border-width) solid var(--color-border); }
      .sendora-rte-toolbar > * { margin: 0 !important; }
      .sendora-rte-linkbar { padding: var(--spacing-2) var(--spacing-3); border-bottom: var(--border-width) solid var(--color-border); }
      .sendora-rte-content { padding: var(--spacing-3) var(--spacing-4); min-height: calc(var(--spacing-12) * 4); outline: none; color: var(--color-text-primary); font-size: var(--font-size-base); line-height: 1.6; }
      .sendora-rte-content p { margin: 0 0 var(--spacing-2); }
      .sendora-rte-content ul, .sendora-rte-content ol { margin: 0 0 var(--spacing-2); padding-inline-start: var(--spacing-6); }
      .sendora-rte-content a { color: var(--color-text-accent); text-decoration: underline; }
      .sendora-rte-content:focus { outline: none; }
    `}</style>
  );
}
