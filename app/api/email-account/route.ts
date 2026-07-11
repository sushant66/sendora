import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, noContent } from "@/lib/http/responses";
import { getAccountStatus, disconnect } from "@/lib/email/account-service";

/** GET /api/email-account — the caller's connected-account status (FR-019). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getAccountStatus(user.id));
});

/** DELETE /api/email-account — disconnect (status → revoked). */
export const DELETE = route(async () => {
  const user = await requireUser();
  await disconnect(user.id);
  return noContent();
});
