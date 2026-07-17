"use client";

import { useRef, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Banner } from "@astryxdesign/core/Banner";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Template } from "@/lib/templates/types";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";
import { InsertFieldMenu } from "@/components/rich-text-editor/insert-field-menu";

export function TemplateEditorDialog({
  isOpen,
  onOpenChange,
  template,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Partial<Template>;
  onSaved: (template: Template, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(template?.id);
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={640} maxHeight="85vh">
      <DialogHeader
        title={isEdit ? "Edit template" : "New template"}
        subtitle="Use the Insert field menu or type / in the body to add merge fields."
      />
      <TemplateForm
        key={`${isOpen ? "open" : "closed"}:${template?.id ?? "new"}`}
        template={template}
        onCancel={() => onOpenChange(false)}
        onSaved={(t, mode) => {
          onSaved(t, mode);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

function TemplateForm({
  template,
  onCancel,
  onSaved,
}: {
  template?: Partial<Template>;
  onCancel: () => void;
  onSaved: (template: Template, mode: "created" | "updated") => void;
}) {
  const subjectRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? "");
  const [nameError, setNameError] = useState<string>();
  const [subjectError, setSubjectError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(template?.id);

  async function save() {
    setIsSaving(true);
    setNameError(undefined);
    setSubjectError(undefined);
    setFormError(undefined);
    try {
      const payload = { name, subject, bodyHtml };
      const saved = isEdit
        ? await apiRequest<Template>(`/api/templates/${template!.id}`, {
            method: "PATCH",
            json: payload,
          })
        : await apiRequest<Template>("/api/templates", { method: "POST", json: payload });
      onSaved(saved, isEdit ? "updated" : "created");
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "unsupported_merge_fields") {
        const fields = Array.isArray(err.body.fields)
          ? (err.body.fields as string[]).join(", ")
          : "";
        setFormError(
          `Unsupported merge fields: ${fields}. Use only the fields from the Insert field menu.`,
        );
      } else if (err instanceof ApiError && err.status === 422 && err.body.fields) {
        const f = err.body.fields as Record<string, string>;
        setNameError(f.name);
        setSubjectError(f.subject);
        if (f.bodyHtml) setFormError(f.bodyHtml);
      } else {
        setFormError("Couldn't save the template. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <VStack gap={4}>
        <TextInput
          label="Template name"
          value={name}
          onChange={setName}
          isRequired
          hasAutoFocus
          status={nameError ? { type: "error", message: nameError } : undefined}
        />
        <VStack gap={1} align="stretch">
          <HStack justify="between" align="center">
            <Text size="sm" weight="medium">
              Subject
            </Text>
            <InsertFieldMenu value={subject} onChange={setSubject} containerRef={subjectRef} />
          </HStack>
          {/* display:contents wrapper hosts a DOM ref so InsertFieldMenu can read the caret,
              without introducing any layout box. */}
          <span ref={subjectRef} style={{ display: "contents" }}>
            <TextInput
              label="Subject"
              isLabelHidden
              value={subject}
              onChange={setSubject}
              isRequired
              status={subjectError ? { type: "error", message: subjectError } : undefined}
            />
          </span>
        </VStack>
        <RichTextEditor label="Body" value={bodyHtml} onChange={setBodyHtml} />
        {formError && (
          <Banner
            status="error"
            container="card"
            title="Couldn't save template"
            description={formError}
          />
        )}
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isSaving} />
          <Button
            label={isEdit ? "Save changes" : "Create template"}
            variant="primary"
            type="submit"
            isLoading={isSaving}
          />
        </HStack>
      </VStack>
    </form>
  );
}
