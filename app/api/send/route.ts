import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { SendRequestSchema } from "@/lib/validation/send";
import { sendEmails } from "@/lib/send/service";

// SMTP providers (Yahoo) send serially over one pooled connection in the loop, which is slower
// than Gmail's REST API. Send records are only persisted once the whole loop finishes, so a
// mid-batch timeout would leave the batch stuck `in_progress` with nothing written — give the
// loop the full Vercel ceiling so realistic batches complete well within it. The pooled
// connection authenticates once and reuses the session, so per-message cost is small.
export const runtime = "nodejs";
export const maxDuration = 300;

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
