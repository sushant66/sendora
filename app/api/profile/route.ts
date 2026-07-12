import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { ProfileInputSchema } from "@/lib/validation/profile";
import { getProfile, saveProfile } from "@/lib/profile/service";

/** GET /api/profile — the current user's sender profile, or an empty shape if unset (US1). */
export const GET = route(async (_req: Request) => {
  const user = await requireUser();
  return ok(await getProfile(user.id));
});

/** PUT /api/profile — upsert the sender profile (lazy create on first save). All fields
 *  optional; blank strings normalize to null. 422 on an invalid URL or work preference. */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const input = ProfileInputSchema.parse(await req.json());
  return ok(await saveProfile(user.id, input));
});
