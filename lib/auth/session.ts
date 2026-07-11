import { auth } from "./config";
import { UnauthorizedError } from "@/lib/errors";

export { UnauthorizedError };

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Returns the authenticated job seeker, or null if unauthenticated.
 * Every data query MUST be scoped to this user's id (FR-022).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

/** Like getCurrentUser but throws when unauthenticated (for route handlers). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
