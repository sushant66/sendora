import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { restoreResume } from "@/lib/resumes/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/resumes/:id/restore — reactivate an archived resume (US4). 404 if not archived/owned. */
export const POST = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const resume = await restoreResume(user.id, id);
  return ok(resume);
});
