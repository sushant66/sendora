import { eq } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { senderProfiles, type SenderProfileRow } from "@/lib/db/schema";
import type { ProfileInput } from "@/lib/validation/profile";
import type { SenderProfile, WorkPreference } from "./types";

/**
 * Sender-profile service (feature 002, US1). One row per user, created lazily on first save.
 * All queries are scoped to `userId` (FR-006/FR-024). `getProfile` returns an empty profile
 * shape when none is saved, so callers never branch on existence.
 */

const EMPTY: SenderProfile = {
  displayName: null,
  title: null,
  pitch: null,
  skills: null,
  link: null,
  location: null,
  workPreference: null,
};

function toProfile(row: SenderProfileRow): SenderProfile {
  return {
    displayName: row.displayName,
    title: row.title,
    pitch: row.pitch,
    skills: row.skills,
    link: row.link,
    location: row.location,
    workPreference: (row.workPreference as WorkPreference | null) ?? null,
  };
}

/** The caller's profile, or an all-null profile when none is saved yet. */
export async function getProfile(userId: string, db: Db = defaultDb): Promise<SenderProfile> {
  const [row] = await db.select().from(senderProfiles).where(eq(senderProfiles.userId, userId)).limit(1);
  return row ? toProfile(row) : { ...EMPTY };
}

/** Upsert the caller's profile (lazy insert on first save). Returns the saved profile. */
export async function saveProfile(userId: string, input: ProfileInput, db: Db = defaultDb): Promise<SenderProfile> {
  const values = {
    displayName: input.displayName,
    title: input.title,
    pitch: input.pitch,
    skills: input.skills,
    link: input.link,
    location: input.location,
    workPreference: input.workPreference,
  };

  const [existing] = await db
    .select({ id: senderProfiles.id })
    .from(senderProfiles)
    .where(eq(senderProfiles.userId, userId))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(senderProfiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(senderProfiles.userId, userId))
      .returning();
    return toProfile(row!);
  }

  const [row] = await db
    .insert(senderProfiles)
    .values({ userId, ...values })
    .returning();
  return toProfile(row!);
}
