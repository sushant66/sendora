import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { resendRecord } from "@/lib/send/service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/history/:id/resend — resend one record's snapshot to the same recipient (US5).
 * 404 if not owned; 409 `no_active_account` if no Gmail is connected.
 */
export const POST = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok(await resendRecord(user.id, id, user.name));
});
