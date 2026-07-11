import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { SendRequestSchema } from "@/lib/validation/send";
import { sendEmails } from "@/lib/send/service";

/**
 * POST /api/send — send a single email or a bulk batch (US2/US4). One uniform contract;
 * `contactIds` length drives single vs bulk. Requires an active connected account, else
 * 409 `no_active_account` (FR-019a). Partial failures are reported per recipient (FR-018).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const request = SendRequestSchema.parse(await req.json());
  const summary = await sendEmails(user.id, request, user.name);
  return ok(summary);
});
