"use client";

import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Banner } from "@astryxdesign/core/Banner";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Template } from "@/lib/templates/types";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";

const MERGE_HINT = "Merge fields: {{first_name}}, {{last_name}}, {{full_name}}, {{company}}, {{role}}";

export function TemplateEditorDialog({
  isOpen,
  onOpenChange,
  template,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  onSaved: (template: Template, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(template?.id);
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={640} maxHeight="85vh">
      <DialogHeader title={isEdit ? "Edit template" : "New template"} subtitle={MERGE_HINT} />
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
  template?: Template;
  onCancel: () => void;
  onSaved: (template: Template, mode: "created" | "updated") => void;
}) {
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
        ? await apiRequest<Template>(`/api/templates/${template!.id}`, { method: "PATCH", json: payload })
        : await apiRequest<Template>("/api/templates", { method: "POST", json: payload });
      onSaved(saved, isEdit ? "updated" : "created");
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "unsupported_merge_fields") {
        const fields = Array.isArray(err.body.fields) ? (err.body.fields as string[]).join(", ") : "";
        setFormError(`Unsupported merge fields: ${fields}. Use only the supported fields listed above.`);
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
        <TextInput
          label="Subject"
          value={subject}
          onChange={setSubject}
          isRequired
          description="You can use merge fields here too."
          status={subjectError ? { type: "error", message: subjectError } : undefined}
        />
        <RichTextEditor label="Body" value={bodyHtml} onChange={setBodyHtml} />
        {formError && <Banner status="error" container="card" title="Couldn't save template" description={formError} />}
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isSaving} />
          <Button label={isEdit ? "Save changes" : "Create template"} variant="primary" type="submit" isLoading={isSaving} />
        </HStack>
      </VStack>
    </form>
  );
}
