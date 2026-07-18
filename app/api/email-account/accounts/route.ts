import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { listConnectedAccounts } from "@/lib/email/account-service";

/** GET /api/email-account/accounts — every connected account + connectable providers (settings). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok(await listConnectedAccounts(user.id));
});
