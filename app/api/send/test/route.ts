import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { TestSendRequestSchema } from "@/lib/validation/send";
import { sendTestEmail } from "@/lib/send/test-send";

/**
 * POST /api/send/test — render the current draft and send one test to the job seeker's own
 * inbox (US3, FR-015). Creates no history. 409 no_active_account when no inbox is connected;
 * 422 when there is nothing to send.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const request = TestSendRequestSchema.parse(await req.json());
  return ok(await sendTestEmail(user.id, request, user.name));
});
