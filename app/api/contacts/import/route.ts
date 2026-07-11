import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { ImportRequestSchema } from "@/lib/validation/contacts";
import { importContacts } from "@/lib/contacts/service";

/**
 * POST /api/contacts/import — import a parsed, normalized row set (US1).
 * The server re-validates as the authoritative trust boundary; valid rows import even
 * when others are invalid/duplicate (never all-or-nothing), and every skip is reported.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const request = ImportRequestSchema.parse(await req.json());
  const summary = await importContacts(user.id, request);
  return ok(summary);
});
