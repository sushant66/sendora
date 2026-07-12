import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { BulkDeleteRequestSchema } from "@/lib/validation/contacts";
import { softDeleteContacts } from "@/lib/contacts/soft-delete";

/**
 * POST /api/contacts/bulk-delete — soft-delete contacts in one undoable batch (US4, FR-020).
 * `ids` for a loaded-row selection, or `matchAll` (+ query, excludedIds) for "select all N
 * matching". Only the caller's live rows are affected.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = BulkDeleteRequestSchema.parse(await req.json());
  return ok(await softDeleteContacts(user.id, input));
});
