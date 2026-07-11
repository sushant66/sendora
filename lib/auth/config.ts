import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db/client";
import { getEnv } from "@/lib/validation/env";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

const env = getEnv();

/**
 * Auth.js (NextAuth v5) — Google sign-in for authentication.
 *
 * The base login requests only identity scopes. The Gmail `gmail.send` scope is
 * requested later via incremental authorization when the job seeker connects a
 * sending account (User Story 2), keeping login consent minimal.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  pages: { signIn: "/sign-in" },
});
