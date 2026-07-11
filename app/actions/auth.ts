"use server";

import { signIn, signOut } from "@/lib/auth/config";

/** Start the Google OAuth sign-in flow and land the user on their dashboard. */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

/** Sign the user out and return them to the public landing page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
