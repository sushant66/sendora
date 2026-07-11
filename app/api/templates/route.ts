import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, created } from "@/lib/http/responses";
import { TemplateInputSchema } from "@/lib/validation/templates";
import { listTemplates, createTemplate } from "@/lib/templates/service";

/** GET /api/templates — starter (system) + the caller's custom templates (US2/US3). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ items: await listTemplates(user.id) });
});

/** POST /api/templates — create a custom template (US3). 422 on unsupported merge fields. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = TemplateInputSchema.parse(await req.json());
  return created(await createTemplate(user.id, input));
});
