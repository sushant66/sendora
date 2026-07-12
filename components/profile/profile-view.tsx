"use client";

import { useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Divider } from "@astryxdesign/core/Divider";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { SenderProfile } from "@/lib/profile/types";

type FieldName = keyof SenderProfile;
type FormState = Record<FieldName, string>;

const WORK_PREFERENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
  { value: "open", label: "Open to anything" },
];

function toForm(p: SenderProfile): FormState {
  return {
    displayName: p.displayName ?? "",
    title: p.title ?? "",
    pitch: p.pitch ?? "",
    skills: p.skills ?? "",
    link: p.link ?? "",
    location: p.location ?? "",
    workPreference: p.workPreference ?? "",
  };
}

export function ProfileView({
  initialProfile,
  accountName,
}: {
  initialProfile: SenderProfile;
  accountName: string | null;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initialProfile));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const set = (field: FieldName) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  async function save() {
    setIsSaving(true);
    setErrors({});
    try {
      const result = await apiRequest<SenderProfile>("/api/profile", { method: "PUT", json: form });
      setForm(toForm(result));
      // Toast, not an inline banner: the Save button sits at the bottom of a long form, so
      // feedback must reach the user wherever they are, not only if they scroll back up.
      toast({ body: "Profile saved. Your details will fill your outreach from now on." });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.body.fields) {
        setErrors(err.body.fields as Partial<Record<FieldName, string>>);
        toast({ body: "Please fix the highlighted fields and save again.", type: "error" });
      } else {
        toast({ body: "Couldn't save your profile. Please try again.", type: "error" });
      }
    } finally {
      setIsSaving(false);
    }
  }

  const displayNameHint =
    accountName && !form.displayName.trim()
      ? `Defaults to your account name, ${accountName}, if left blank.`
      : "Shown to recruiters, and fills the Your name merge field.";

  return (
    // A focused single-column measure: a settings form reads better at ~600px than stretched
    // across the full content width, and stays centered rather than clinging to one edge.
    <VStack gap={6} style={{ width: "100%", maxWidth: 600, marginInline: "auto" }}>
      <VStack gap={1}>
        <Heading level={1}>Your profile</Heading>
        <Text color="secondary">
          These details fill the &ldquo;Your details&rdquo; merge fields in your templates, so your
          outreach sounds like you. Everything here is optional and never blocks a send.
        </Text>
      </VStack>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card padding={5}>
          <VStack gap={5}>
            <VStack gap={4}>
              <TextInput
                label="Display name"
                value={form.displayName}
                onChange={set("displayName")}
                isOptional
                description={displayNameHint}
                status={errors.displayName ? { type: "error", message: errors.displayName } : undefined}
              />
              <TextInput
                label="Title"
                value={form.title}
                onChange={set("title")}
                isOptional
                placeholder="Senior Frontend Engineer"
                description="Your current or target job title."
                status={errors.title ? { type: "error", message: errors.title } : undefined}
              />
              <TextArea
                label="Pitch"
                value={form.pitch}
                onChange={set("pitch")}
                isOptional
                rows={3}
                maxLength={1000}
                placeholder="One or two lines on what you do and what you're looking for."
                description="A short positioning statement recruiters can read at a glance."
                status={errors.pitch ? { type: "error", message: errors.pitch } : undefined}
              />
            </VStack>

            <Divider variant="subtle" />

            <VStack gap={4}>
              <TextInput
                label="Skills"
                value={form.skills}
                onChange={set("skills")}
                isOptional
                placeholder="React, TypeScript, design systems"
                description="A short, comma-separated list."
                status={errors.skills ? { type: "error", message: errors.skills } : undefined}
              />
              <TextInput
                label="Link"
                value={form.link}
                onChange={set("link")}
                isOptional
                placeholder="https://your-portfolio.com"
                description="Portfolio, LinkedIn, or resume. Must start with http or https."
                status={errors.link ? { type: "error", message: errors.link } : undefined}
              />
              <TextInput
                label="Location"
                value={form.location}
                onChange={set("location")}
                isOptional
                placeholder="Remote (UK)"
                status={errors.location ? { type: "error", message: errors.location } : undefined}
              />
              <Selector
                label="Work preference"
                options={WORK_PREFERENCE_OPTIONS}
                value={form.workPreference || null}
                onChange={(v) => set("workPreference")(v ?? "")}
                hasClear
                isOptional
                placeholder="Choose one"
                status={errors.workPreference ? { type: "error", message: errors.workPreference } : undefined}
              />
            </VStack>

            <HStack justify="end">
              <Button label="Save profile" variant="primary" type="submit" isLoading={isSaving} />
            </HStack>
          </VStack>
        </Card>
      </form>
    </VStack>
  );
}
