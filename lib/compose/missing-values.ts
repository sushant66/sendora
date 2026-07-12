import { extractTokens, SENDER_TOKENS, type SenderContext } from "@/lib/templates/merge";
import { senderContextFromProfile } from "@/lib/profile/context";
import type { SenderProfile } from "@/lib/profile/types";

/**
 * Pre-send missing-value computation (feature 002, US3, FR-016). Over a selection, work out
 * which used recipient tokens resolve empty per contact and which used sender tokens resolve
 * empty (they appear in every email). Identity tokens (first/last/full name) fall back to a
 * greeting word, so they are never "missing". Pure and client-safe: compose already has the
 * contacts and the profile, so the gate needs no extra round trip.
 */

export type MissingValueContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
};

/** Recipient tokens that drop with a warning when empty (identity tokens never do). */
const RECIPIENT_WARNABLE = new Set(["company", "role"]);

const SENDER_FIELD: Record<string, keyof SenderContext> = {
  my_name: "displayName",
  my_title: "title",
  my_pitch: "pitch",
  my_skills: "skills",
  my_link: "link",
  my_location: "location",
  my_work_preference: "workPreference",
};

export type MissingValueReport = {
  usedTokens: string[];
  /** Warnable recipient tokens actually used (subset of company/role). */
  recipientTokens: string[];
  /** Used sender tokens that have no value in the profile (affect every recipient). */
  senderMissing: string[];
  /** Recipients missing at least one used recipient token. */
  affected: { contactId: string; name: string; email: string; missing: string[] }[];
  /** Count of recipients whose email is affected (by a recipient or a sender gap). */
  affectedCount: number;
  /** First affected recipient, used for the "how it actually reads" sample. */
  representativeContactId: string | null;
  hasMissing: boolean;
};

function isBlank(v: string | null | undefined): boolean {
  return !(typeof v === "string" && v.trim().length > 0);
}

export function computeMissingValues(input: {
  subject: string;
  bodyHtml: string;
  contacts: MissingValueContact[];
  profile: SenderProfile | null;
  /** The account name used as the {{my_name}} fallback, so the gate matches what actually
   *  sends (the render falls the display name back to this before flagging it empty, FR-001). */
  accountName?: string | null;
}): MissingValueReport {
  const used = [...new Set([...extractTokens(input.subject), ...extractTokens(input.bodyHtml)])];
  const recipientTokens = used.filter((t) => RECIPIENT_WARNABLE.has(t));
  const usedSender = used.filter((t) => (SENDER_TOKENS as readonly string[]).includes(t));

  // Evaluate sender emptiness against the SAME resolved context the send/preview use, so a
  // field that resolves via a fallback (my_name → account name) is never falsely flagged.
  const sender = senderContextFromProfile(input.profile, input.accountName ?? null);
  const senderMissing = usedSender.filter((t) => isBlank(sender[SENDER_FIELD[t]!] as string | null));

  const affected = input.contacts
    .map((c) => ({
      contactId: c.id,
      name: c.name,
      email: c.email,
      missing: recipientTokens.filter((t) => isBlank(t === "company" ? c.company : c.role)),
    }))
    .filter((a) => a.missing.length > 0);

  // Sender fields appear in every email, so a sender gap affects the whole selection.
  const senderAffectsAll = senderMissing.length > 0 && input.contacts.length > 0;
  const affectedCount = senderAffectsAll ? input.contacts.length : affected.length;

  let representativeContactId: string | null = null;
  if (affected.length > 0) representativeContactId = affected[0]!.contactId;
  else if (senderAffectsAll) representativeContactId = input.contacts[0]!.id;

  return {
    usedTokens: used,
    recipientTokens,
    senderMissing,
    affected,
    affectedCount,
    representativeContactId,
    hasMissing: affectedCount > 0,
  };
}
