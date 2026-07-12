CREATE TABLE "resume" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"version" integer NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "send_batch" ADD COLUMN "attached_resume_id" text;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resume_user_active_label_idx" ON "resume" USING btree ("user_id","label") WHERE "resume"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "resume_user_label_version_idx" ON "resume" USING btree ("user_id","label","version");--> statement-breakpoint
CREATE INDEX "resume_user_label_idx" ON "resume" USING btree ("user_id","label");--> statement-breakpoint
ALTER TABLE "send_batch" ADD CONSTRAINT "send_batch_attached_resume_id_resume_id_fk" FOREIGN KEY ("attached_resume_id") REFERENCES "public"."resume"("id") ON DELETE set null ON UPDATE no action;