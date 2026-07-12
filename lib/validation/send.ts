import { z } from "zod";

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
  });
export type SendRequest = z.infer<typeof SendRequestSchema>;
