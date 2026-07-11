import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, notFound } from "@/lib/http/responses";
import { getHistoryDetail } from "@/lib/history/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/history/:id — the full immutable snapshot of one sent email (US5). 404 if not owned. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const detail = await getHistoryDetail(user.id, id);
  if (!detail) return notFound();
  return ok(detail);
});
