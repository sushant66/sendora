/**
 * Merge-field vocabulary + renderer (FR-007, FR-012, SC-002/SC-004).
 *
 * Two namespaces share one closed vocabulary and one render path (research §1):
 *   - Recipient tokens (`first_name`, ...) resolve from the contact.
 *   - Sender tokens (`my_*`) resolve from the job seeker's profile.
 *
 * Rendering is TOTAL: it never leaves a literal `{{token}}` in the output for either
 * namespace (SC-002). Missing optional values are dropped and surfaced as a warning so the
 * compose preview and the pre-send gate can flag them; required identity tokens fall back to
 * a safe greeting word.
 */

/** Recipient namespace — resolves from a {@link MergeContact}. */
export const MERGE_TOKENS = ["first_name", "last_name", "full_name", "company", "role"] as const;
export type RecipientToken = (typeof MERGE_TOKENS)[number];

/** Sender namespace ("Your details") — resolves from a {@link SenderContext}. */
export const SENDER_TOKENS = [
  "my_name",
  "my_title",
  "my_pitch",
  "my_skills",
  "my_link",
  "my_location",
  "my_work_preference",
] as const;
export type SenderToken = (typeof SENDER_TOKENS)[number];

export type MergeToken = RecipientToken | SenderToken;

const TOKEN_SET = new Set<string>([...MERGE_TOKENS, ...SENDER_TOKENS]);
const SENDER_SET = new Set<string>(SENDER_TOKENS);
const TOKEN_RE = /\{\{\s*([^}\s]+)\s*\}\}/g;

/** The contact fields a template can merge from (recipient namespace). */
export type MergeContact = {
  name: string;
  company?: string | null;
  role?: string | null;
};

/** The profile fields the sender namespace merges from. `displayName` is expected to already
 *  carry the FR-001 fallback (profile name, else the account name) when the caller builds it. */
export type SenderContext = {
  displayName?: string | null;
  title?: string | null;
  pitch?: string | null;
  skills?: string | null;
  link?: string | null;
  location?: string | null;
  workPreference?: string | null;
};

/** Everything one render pass needs: the recipient and (optionally) the sender. */
export type MergeContext = {
  contact: MergeContact;
  sender?: SenderContext;
};

export type RenderWarning = { field: string; message: string };
export type RenderResult = { text: string; warnings: RenderWarning[] };

/** Escape a merge value for safe interpolation into an HTML context (prevents stored XSS
 *  via merged fields — the template body is sanitized, but merged values are not). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveRecipient(token: RecipientToken, contact: MergeContact): { value: string; warning?: RenderWarning } {
  const name = contact.name.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  switch (token) {
    case "full_name":
      return { value: name || "there" };
    case "first_name":
      return { value: parts[0] ?? "there" };
    case "last_name":
      return { value: parts.slice(1).join(" ") };
    case "company": {
      const v = contact.company?.trim() ?? "";
      return v ? { value: v } : { value: "", warning: { field: "company", message: "No company on this contact, so the {{company}} field was left blank." } };
    }
    case "role": {
      const v = contact.role?.trim() ?? "";
      return v ? { value: v } : { value: "", warning: { field: "role", message: "No role on this contact, so the {{role}} field was left blank." } };
    }
  }
}

/** Human label per sender token, used in the empty-value warning message. */
const SENDER_LABEL: Record<SenderToken, string> = {
  my_name: "name",
  my_title: "title",
  my_pitch: "pitch",
  my_skills: "skills",
  my_link: "link",
  my_location: "location",
  my_work_preference: "work preference",
};

function senderValue(token: SenderToken, sender: SenderContext | undefined): string | null | undefined {
  switch (token) {
    case "my_name":
      return sender?.displayName;
    case "my_title":
      return sender?.title;
    case "my_pitch":
      return sender?.pitch;
    case "my_skills":
      return sender?.skills;
    case "my_link":
      return sender?.link;
    case "my_location":
      return sender?.location;
    case "my_work_preference":
      return sender?.workPreference;
  }
}

function resolveSender(token: SenderToken, sender: SenderContext | undefined): { value: string; warning?: RenderWarning } {
  const v = senderValue(token, sender)?.trim() ?? "";
  if (v) return { value: v };
  return {
    value: "",
    warning: { field: token, message: `No ${SENDER_LABEL[token]} in your profile, so the {{${token}}} field was left blank.` },
  };
}

/** Return the distinct tokens referenced in a string (both supported and not). */
export function extractTokens(input: string): string[] {
  const found = new Set<string>();
  for (const m of input.matchAll(TOKEN_RE)) found.add(m[1]!);
  return [...found];
}

/** Distinct `{{tokens}}` that are NOT part of the supported vocabulary (for save-time validation). */
export function findUnsupportedTokens(input: string): string[] {
  return extractTokens(input).filter((t) => !TOKEN_SET.has(t));
}

/**
 * Render one string against a merge context. Every `{{token}}` is replaced; unsupported
 * tokens are removed with a warning (they should never reach here — templates validate at
 * save). `escapeValue` transforms each resolved value before substitution — pass
 * {@link escapeHtml} when rendering into an HTML context so merged fields can't inject markup.
 */
export function renderString(
  input: string,
  ctx: MergeContext,
  escapeValue: (value: string) => string = (v) => v,
): RenderResult {
  const warnings = new Map<string, RenderWarning>();
  const text = input.replace(TOKEN_RE, (_full, rawToken: string) => {
    if (!TOKEN_SET.has(rawToken)) {
      warnings.set(`unknown:${rawToken}`, { field: rawToken, message: `Unknown merge field {{${rawToken}}} was removed.` });
      return "";
    }
    const { value, warning } = SENDER_SET.has(rawToken)
      ? resolveSender(rawToken as SenderToken, ctx.sender)
      : resolveRecipient(rawToken as RecipientToken, ctx.contact);
    if (warning) warnings.set(warning.field, warning);
    return escapeValue(value);
  });
  return { text, warnings: [...warnings.values()] };
}

/** Render a full template (subject + both body parts) for a merge context. The HTML body
 *  escapes merged values; the subject and plain-text parts don't (they're not HTML contexts). */
export function renderTemplate(
  template: { subject: string; bodyHtml: string; bodyText: string },
  ctx: MergeContext,
): { subject: string; bodyHtml: string; bodyText: string; warnings: RenderWarning[] } {
  const subject = renderString(template.subject, ctx);
  const bodyHtml = renderString(template.bodyHtml, ctx, escapeHtml);
  const bodyText = renderString(template.bodyText, ctx);
  const warnings = new Map<string, RenderWarning>();
  for (const w of [...subject.warnings, ...bodyHtml.warnings, ...bodyText.warnings]) {
    warnings.set(`${w.field}:${w.message}`, w);
  }
  return {
    subject: subject.text,
    bodyHtml: bodyHtml.text,
    bodyText: bodyText.text,
    warnings: [...warnings.values()],
  };
}
