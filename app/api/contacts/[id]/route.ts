import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, noContent } from "@/lib/http/responses";
import { ContactInputSchema } from "@/lib/validation/contacts";
import { deleteContact, updateContact } from "@/lib/contacts/service";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/contacts/:id — edit a single contact. 404 if not owned. */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = ContactInputSchema.parse(await req.json());
  const contact = await updateContact(user.id, id, input);
  return ok(contact);
});

/** DELETE /api/contacts/:id — delete a single contact. 404 if not owned. */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteContact(user.id, id);
  return noContent();
});
