/**
 * Merge-field vocabulary + renderer (User Story 2, FR-012, SC-004).
 *
 * A fixed, closed vocabulary of `{{snake_case}}` tokens (research §7). Rendering is
 * TOTAL: it never leaves a literal `{{token}}` in the output. Missing optional values
 * are dropped and surfaced as a warning so the compose preview can flag them; required
 * identity tokens fall back to a safe greeting word.
 */

export const MERGE_TOKENS = ["first_name", "last_name", "full_name", "company", "role"] as const;
export type MergeToken = (typeof MERGE_TOKENS)[number];

const TOKEN_SET = new Set<string>(MERGE_TOKENS);
const TOKEN_RE = /\{\{\s*([^}\s]+)\s*\}\}/g;

/** The contact fields a template can merge from. */
export type MergeContact = {
  name: string;
  company?: string | null;
  role?: string | null;
};

export type RenderWarning = { field: string; message: string };
export type RenderResult = { text: string; warnings: RenderWarning[] };

/** Escape a merge value for safe interpolation into an HTML context (prevents stored XSS
 *  via contact fields — the template body is sanitized, but merged values are not). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolve(token: MergeToken, contact: MergeContact): { value: string; warning?: RenderWarning } {
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
      return v ? { value: v } : { value: "", warning: { field: "company", message: "No company on this contact — the {{company}} field was left blank." } };
    }
    case "role": {
      const v = contact.role?.trim() ?? "";
      return v ? { value: v } : { value: "", warning: { field: "role", message: "No role on this contact — the {{role}} field was left blank." } };
    }
  }
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
 * Render one string against a contact. Every `{{token}}` is replaced; unsupported tokens
 * are removed with a warning (they should never reach here — templates validate at save).
 * `escapeValue` transforms each resolved value before substitution — pass {@link escapeHtml}
 * when rendering into an HTML context so contact fields can't inject markup (stored XSS).
 */
export function renderString(
  input: string,
  contact: MergeContact,
  escapeValue: (value: string) => string = (v) => v,
): RenderResult {
  const warnings = new Map<string, RenderWarning>();
  const text = input.replace(TOKEN_RE, (_full, rawToken: string) => {
    if (!TOKEN_SET.has(rawToken)) {
      warnings.set(`unknown:${rawToken}`, { field: rawToken, message: `Unknown merge field {{${rawToken}}} was removed.` });
      return "";
    }
    const { value, warning } = resolve(rawToken as MergeToken, contact);
    if (warning) warnings.set(warning.field, warning);
    return escapeValue(value);
  });
  return { text, warnings: [...warnings.values()] };
}

/** Render a full template (subject + both body parts) for a contact. The HTML body escapes
 *  merged values; the subject and plain-text parts don't (they're not HTML contexts). */
export function renderTemplate(
  template: { subject: string; bodyHtml: string; bodyText: string },
  contact: MergeContact,
): { subject: string; bodyHtml: string; bodyText: string; warnings: RenderWarning[] } {
  const subject = renderString(template.subject, contact);
  const bodyHtml = renderString(template.bodyHtml, contact, escapeHtml);
  const bodyText = renderString(template.bodyText, contact);
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
