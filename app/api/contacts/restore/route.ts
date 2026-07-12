import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { RestoreRequestSchema } from "@/lib/validation/contacts";
import { restoreBatch } from "@/lib/contacts/soft-delete";

/**
 * POST /api/contacts/restore — undo a soft-delete batch (US4, FR-023). Rows whose email now
 * collides with a live contact are left deleted and counted in `skipped`. 404 when the batch
 * is unknown or already committed for this user.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { deletedBatch } = RestoreRequestSchema.parse(await req.json());
  return ok(await restoreBatch(user.id, deletedBatch));
});
