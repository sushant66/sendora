"use client";

import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Contact } from "@/lib/contacts/types";

type FieldName = "name" | "email" | "company" | "role";
type FormState = Record<FieldName, string>;

export function ContactFormDialog({
  isOpen,
  onOpenChange,
  contact,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit; absent → create. */
  contact?: Contact;
  onSaved: (contact: Contact, mode: "created" | "updated") => void;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader title={contact ? "Edit contact" : "Add contact"} />
      {/* Keyed so opening the dialog (or switching target) remounts with fresh state —
          no setState-in-effect reset. */}
      <ContactForm
        key={`${isOpen ? "open" : "closed"}:${contact?.id ?? "new"}`}
        contact={contact}
        onCancel={() => onOpenChange(false)}
        onSaved={(saved, mode) => {
          onSaved(saved, mode);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

function ContactForm({
  contact,
  onCancel,
  onSaved,
}: {
  contact?: Contact;
  onCancel: () => void;
  onSaved: (contact: Contact, mode: "created" | "updated") => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    company: contact?.company ?? "",
    role: contact?.role ?? "",
  }));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: FieldName) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  async function save() {
    setIsSaving(true);
    setErrors({});
    const payload = {
      name: form.name,
      email: form.email,
      company: form.company || undefined,
      role: form.role || undefined,
    };
    try {
      const saved = contact
        ? await apiRequest<Contact>(`/api/contacts/${contact.id}`, { method: "PATCH", json: payload })
        : await apiRequest<Contact>("/api/contacts", { method: "POST", json: payload });
      onSaved(saved, contact ? "updated" : "created");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.body.fields) {
        setErrors(err.body.fields as Partial<Record<FieldName, string>>);
      } else if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: "A contact with this email already exists." });
      } else {
        setErrors({ email: "Something went wrong. Please try again." });
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
          label="Name"
          value={form.name}
          onChange={set("name")}
          isRequired
          hasAutoFocus
          status={errors.name ? { type: "error", message: errors.name } : undefined}
        />
        <TextInput
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          isRequired
          status={errors.email ? { type: "error", message: errors.email } : undefined}
        />
        <TextInput
          label="Company"
          value={form.company}
          onChange={set("company")}
          isOptional
          status={errors.company ? { type: "error", message: errors.company } : undefined}
        />
        <TextInput
          label="Role"
          value={form.role}
          onChange={set("role")}
          isOptional
          status={errors.role ? { type: "error", message: errors.role } : undefined}
        />
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isSaving} />
          <Button label={contact ? "Save changes" : "Add contact"} variant="primary" type="submit" isLoading={isSaving} />
        </HStack>
      </VStack>
    </form>
  );
}
