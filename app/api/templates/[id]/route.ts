import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, noContent } from "@/lib/http/responses";
import { TemplateInputSchema } from "@/lib/validation/templates";
import { updateTemplate, deleteTemplate } from "@/lib/templates/service";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/templates/:id — edit a custom template. System templates → 403. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = TemplateInputSchema.parse(await req.json());
  return ok(await updateTemplate(user.id, id, input));
});

/** DELETE /api/templates/:id — delete a custom template. System templates → 403. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteTemplate(user.id, id);
  return noContent();
});
