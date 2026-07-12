import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { getRecontactInfo } from "@/lib/history/service";

/**
 * POST /api/history/recontact — body `{ contactIds: [...] }`: which of these contacts were
 * already emailed, and when last (US5, FR-021). Powers the compose re-contact warning.
 *
 * Uses POST rather than a query string so a large recipient selection (select-all, a big
 * imported batch) can't overflow the request URL and silently drop this safety warning.
 */
const RecontactRequestSchema = z.object({
  contactIds: z.array(z.string().min(1)).max(2000).default([]),
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { contactIds } = RecontactRequestSchema.parse(await req.json());
  return ok(await getRecontactInfo(user.id, contactIds));
});
