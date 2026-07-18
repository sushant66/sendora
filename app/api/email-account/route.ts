import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, noContent } from "@/lib/http/responses";
import { getAccountStatus, disconnect } from "@/lib/email/account-service";

const ProviderSchema = z.enum(["gmail", "yahoo"]);

/** GET /api/email-account — the caller's active (selected) account summary (FR-019). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getAccountStatus(user.id));
});

/** DELETE /api/email-account?provider=gmail — disconnect that provider (status → revoked). */
export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser();
  const provider = ProviderSchema.parse(new URL(req.url).searchParams.get("provider"));
  await disconnect(user.id, provider);
  return noContent();
});
