ALTER TABLE "connected_email_account" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Backfill so the partial unique index below can never conflict: revoked accounts are never
-- the selected sender, and each user keeps at most one active row (the most recently connected).
UPDATE "connected_email_account" SET "is_active" = false WHERE "status" = 'revoked';--> statement-breakpoint
UPDATE "connected_email_account" AS c SET "is_active" = false
WHERE "is_active" = true AND "id" <> (
  SELECT "id" FROM "connected_email_account" AS o
  WHERE o."user_id" = c."user_id" AND o."is_active" = true
  ORDER BY o."connected_at" DESC, o."id" DESC
  LIMIT 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_one_active_per_user_idx" ON "connected_email_account" USING btree ("user_id") WHERE "connected_email_account"."is_active" = true;
