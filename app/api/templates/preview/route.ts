import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { PreviewRequestSchema } from "@/lib/validation/templates";
import { previewTemplate } from "@/lib/templates/preview";

/**
 * POST /api/templates/preview — render a template (or inline content) for a contact (US2).
 * Output never contains a literal {{token}} (FR-012, SC-004); empty fields become warnings.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const request = PreviewRequestSchema.parse(await req.json());
  return ok(await previewTemplate(user.id, request));
});
