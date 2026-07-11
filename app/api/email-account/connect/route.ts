import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { buildConnectUrl } from "@/lib/email/account-service";

/** POST /api/email-account/connect — begin incremental Google OAuth for gmail.send. */
export const POST = route(async () => {
  const user = await requireUser();
  return ok({ authorizeUrl: buildConnectUrl(user.id) });
});
