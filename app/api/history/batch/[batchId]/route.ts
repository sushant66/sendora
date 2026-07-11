import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { getBatchRecords } from "@/lib/history/service";

type Ctx = { params: Promise<{ batchId: string }> };

/** GET /api/history/batch/:batchId — per-recipient records of one send event (US5). */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { batchId } = await ctx.params;
  return ok(await getBatchRecords(user.id, batchId));
});
