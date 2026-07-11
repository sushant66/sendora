import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { getRecontactInfo } from "@/lib/history/service";

/**
 * GET /api/history/recontact?contactIds=a,b,c — which of these contacts were already
 * emailed, and when last (US5, FR-021). Powers the compose re-contact warning.
 */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const raw = new URL(req.url).searchParams.get("contactIds") ?? "";
  const contactIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ok(await getRecontactInfo(user.id, contactIds));
});
