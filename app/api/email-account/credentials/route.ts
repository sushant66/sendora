import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { noContent } from "@/lib/http/responses";
import { rateLimit } from "@/lib/http/rate-limit";
import { TooManyRequestsError } from "@/lib/errors";
import { connectWithCredentials } from "@/lib/email/account-service";

const CredentialsSchema = z.object({
  provider: z.enum(["gmail", "yahoo"]),
  email: z.email(),
  appPassword: z.string().min(1),
});

/**
 * POST /api/email-account/credentials — connect a credentials-based provider (Yahoo app
 * password). The submitted email + password are verified against the provider before storage.
 * Runs on the Node runtime (SMTP verify needs net/tls).
 */
export const runtime = "nodejs";

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  // Each attempt opens a live outbound SMTP auth to the provider, so cap per-user attempts to
  // stop a burst of connections (and password guessing) from the server's IP.
  if (!rateLimit(`credentials:${user.id}`, 5, 60_000)) throw new TooManyRequestsError();
  const { provider, email, appPassword } = CredentialsSchema.parse(await req.json());
  await connectWithCredentials(user.id, provider, email, appPassword);
  return noContent();
});
