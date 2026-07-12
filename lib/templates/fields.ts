import { MERGE_TOKENS, SENDER_TOKENS, type MergeToken } from "./merge";

/**
 * Shared, typed descriptor list for the merge vocabulary (feature 002, US2). The slash menu,
 * the subject "insert field" affordance, and the missing-value gate all read this one list so
 * labels and grouping never drift from the render engine. Client-safe (no server imports).
 */

export type MergeFieldGroup = "recipient" | "sender";

export type MergeFieldDescriptor = {
  token: MergeToken;
  /** Human label shown in the picker and used as the chip's accessible name. */
  label: string;
  group: MergeFieldGroup;
};

/** Human title for each group, shown as the picker section heading. */
export const MERGE_GROUP_LABEL: Record<MergeFieldGroup, string> = {
  recipient: "Recipient",
  sender: "Your details",
};

const RECIPIENT_LABELS: Record<(typeof MERGE_TOKENS)[number], string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  company: "Company",
  role: "Role",
};

const SENDER_LABELS: Record<(typeof SENDER_TOKENS)[number], string> = {
  my_name: "Your name",
  my_title: "Your title",
  my_pitch: "Your pitch",
  my_skills: "Your skills",
  my_link: "Your link",
  my_location: "Your location",
  my_work_preference: "Your work preference",
};

export const MERGE_FIELDS: MergeFieldDescriptor[] = [
  ...MERGE_TOKENS.map((token) => ({ token, label: RECIPIENT_LABELS[token], group: "recipient" as const })),
  ...SENDER_TOKENS.map((token) => ({ token, label: SENDER_LABELS[token], group: "sender" as const })),
];

/** Fast lookup from a token to its label (e.g. to render a stored chip). */
export const MERGE_FIELD_BY_TOKEN: Record<string, MergeFieldDescriptor> = Object.fromEntries(
  MERGE_FIELDS.map((f) => [f.token, f]),
);

/** The picker's two grouped sections, in display order. */
export const MERGE_FIELD_GROUPS: { group: MergeFieldGroup; label: string; fields: MergeFieldDescriptor[] }[] = (
  ["recipient", "sender"] as const
).map((group) => ({
  group,
  label: MERGE_GROUP_LABEL[group],
  fields: MERGE_FIELDS.filter((f) => f.group === group),
}));
