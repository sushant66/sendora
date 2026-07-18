import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { buildConnectUrl } from "@/lib/email/account-service";

const ConnectSchema = z.object({ provider: z.enum(["gmail", "yahoo"]).default("gmail") });

/** POST /api/email-account/connect — begin OAuth for a redirect-based provider (Gmail). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { provider } = ConnectSchema.parse(await req.json().catch(() => ({})));
  return ok({ authorizeUrl: buildConnectUrl(user.id, provider) });
});
