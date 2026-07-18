import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEnv } from "@/lib/validation/env";
import { completeConnection, verifyState } from "@/lib/email/account-service";
import { logger } from "@/lib/observability/logger";

/**
 * GET /api/email-account/callback — OAuth redirect target for a redirect-based provider (Gmail).
 * Session-authenticated; verifies the signed `state` (which carries the provider), exchanges the
 * code, and redirects back to the settings page with a status. Errors redirect with an error flag
 * (never a raw 500), so the user always lands somewhere actionable.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const settings = new URL("/settings/email-account", getEnv().APP_URL);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", getEnv().APP_URL));

  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const verified = state ? verifyState(state, user.id) : { valid: false as const };

  if (error || !code || !verified.valid || !verified.provider) {
    settings.searchParams.set("error", error ?? "connect_failed");
    return NextResponse.redirect(settings);
  }

  try {
    await completeConnection(user.id, verified.provider, code, user.email);
    settings.searchParams.set("connected", "1");
  } catch (err) {
    logger.error("email-account connect failed", { error: String(err) });
    settings.searchParams.set("error", "connect_failed");
  }
  return NextResponse.redirect(settings);
}
