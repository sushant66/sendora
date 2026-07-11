import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { listHistory } from "@/lib/history/service";

/** GET /api/history?cursor= — the caller's send records, newest first (US5, FR-020). */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const cursor = new URL(req.url).searchParams.get("cursor") ?? undefined;
  return ok(await listHistory(user.id, { cursor }));
});
