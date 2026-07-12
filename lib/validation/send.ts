import { z } from "zod";
import { hasMalformedMergeSyntax } from "@/lib/templates/merge";

const MALFORMED_MERGE_MESSAGE = "Unclosed merge field. Fields must look like {{first_name}}, with no spaces.";

/** Flag an unclosed/malformed `{{` in edited content before it can ship as a literal (SC-002). */
function checkOverrideMergeSyntax(
  override: { subject: string; bodyHtml: string } | undefined,
  ctx: z.RefinementCtx,
): void {
  if (!override) return;
  if (hasMalformedMergeSyntax(override.subject)) {
    ctx.addIssue({ code: "custom", path: ["override", "subject"], message: MALFORMED_MERGE_MESSAGE });
  }
  if (hasMalformedMergeSyntax(override.bodyHtml)) {
    ctx.addIssue({ code: "custom", path: ["override", "bodyHtml"], message: MALFORMED_MERGE_MESSAGE });
  }
}

/**
 * Send request (User Story 2 single + User Story 4 bulk). One uniform contract:
 * `contactIds` length drives single vs bulk (contracts/http-api.md). `override` carries the
 * edited subject/body from the compose/preview step.
 */
/** Max recipients in a single send. Shared by the compose client guard and server validation. */
export const MAX_SEND_RECIPIENTS = 200;

export const SendRequestSchema = z
  .object({
    contactIds: z.array(z.string().min(1)).min(1, "select at least one recipient").max(MAX_SEND_RECIPIENTS, "too many recipients for one send"),
    templateId: z.string().min(1).optional(),
    override: z
      .object({
        subject: z.string().trim().min(1, "a subject is required"),
        bodyHtml: z.string().min(1, "the email body can't be empty"),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.templateId) || Boolean(d.override), {
    message: "a template or edited content is required",
    path: ["templateId"],
  })
  .superRefine((d, ctx) => checkOverrideMergeSyntax(d.override, ctx));
export type SendRequest = z.infer<typeof SendRequestSchema>;

/**
 * Test-send request (feature 002, US3, FR-015). Mirrors the real send's override shape but
 * targets the job seeker's own inbox and persists nothing. `contactId` is an optional preview
 * target; omit it to render against clearly labelled sample data.
 */
export const TestSendRequestSchema = z
  .object({
    contactId: z.string().min(1).optional(),
    templateId: z.string().min(1).optional(),
    override: z
      .object({
        subject: z.string().trim().min(1, "Add a subject and body first."),
        bodyHtml: z.string().min(1, "Add a subject and body first."),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.templateId) || Boolean(d.override), {
    message: "Add a subject and body first.",
    path: ["bodyHtml"],
  })
  .superRefine((d, ctx) => checkOverrideMergeSyntax(d.override, ctx));
export type TestSendRequest = z.infer<typeof TestSendRequestSchema>;
