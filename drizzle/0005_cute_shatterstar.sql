DROP INDEX "recruiter_contact_user_email_idx";--> statement-breakpoint
ALTER TABLE "recruiter_contact" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recruiter_contact" ADD COLUMN "deleted_batch" text;--> statement-breakpoint
CREATE INDEX "recruiter_contact_deleted_batch_idx" ON "recruiter_contact" USING btree ("deleted_batch");--> statement-breakpoint
CREATE UNIQUE INDEX "recruiter_contact_user_email_idx" ON "recruiter_contact" USING btree ("user_id","email_normalized") WHERE "recruiter_contact"."deleted_at" IS NULL;