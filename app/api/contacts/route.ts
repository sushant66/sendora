import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok, created } from "@/lib/http/responses";
import { ContactInputSchema } from "@/lib/validation/contacts";
import { createContact, listContacts } from "@/lib/contacts/service";

/** GET /api/contacts?query=&cursor= — search + list the caller's contacts (US1). */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const result = await listContacts(user.id, {
    query: searchParams.get("query") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  return ok(result);
});

/** POST /api/contacts — manual add. 409 if the email already exists. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = ContactInputSchema.parse(await req.json());
  const contact = await createContact(user.id, input);
  return created(contact);
});
