import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { noContent } from "@/lib/http/responses";
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
  const { provider, email, appPassword } = CredentialsSchema.parse(await req.json());
  await connectWithCredentials(user.id, provider, email, appPassword);
  return noContent();
});
