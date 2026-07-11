import { z } from "zod";
import { findUnsupportedTokens } from "@/lib/templates/merge";

/**
 * Zod contracts for templates (User Story 2 preview + User Story 3 CRUD). Merge tokens are
 * validated against the supported vocabulary at save time (FR-011); unsupported tokens
 * block the save with an actionable error.
 */

/** Custom template create/edit (US3, FR-009). Structural validation only; merge-token
 *  validation (FR-011) is a distinct check so it maps to the `unsupported_merge_fields`
 *  contract error rather than the generic 422 shape. */
export const TemplateInputSchema = z.object({
  name: z.string().trim().min(1, "a template name is required"),
  subject: z.string().trim().min(1, "a subject is required"),
  bodyHtml: z.string().min(1, "the template body can't be empty"),
});
export type TemplateInput = z.infer<typeof TemplateInputSchema>;

/** Distinct `{{tokens}}` in the input that are not part of the supported vocabulary (FR-011). */
export function unsupportedTemplateTokens(input: { subject: string; bodyHtml: string }): string[] {
  return [...new Set([...findUnsupportedTokens(input.subject), ...findUnsupportedTokens(input.bodyHtml)])];
}

/** Compose preview request: a saved template OR inline content, rendered for a contact. */
export const PreviewRequestSchema = z
  .object({
    contactId: z.string().min(1),
    templateId: z.string().min(1).optional(),
    inline: z.object({ subject: z.string(), bodyHtml: z.string() }).optional(),
  })
  .refine((d) => Boolean(d.templateId) || Boolean(d.inline), {
    message: "a templateId or inline content is required",
    path: ["templateId"],
  });
export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
