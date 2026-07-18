import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { noContent } from "@/lib/http/responses";
import { setActiveAccount } from "@/lib/email/account-service";

const ActivateSchema = z.object({ provider: z.enum(["gmail", "yahoo"]) });

/** POST /api/email-account/activate — make the given provider's account the sole active sender. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { provider } = ActivateSchema.parse(await req.json());
  await setActiveAccount(user.id, provider);
  return noContent();
});
